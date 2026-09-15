import { NextResponse } from "next/server"
import type Stripe from "stripe"

import { stripe } from "@/lib/stripe"
import { createDirectClient } from "@/lib/supabase/direct"
import { setPlanCredits, addTopupCredits } from "@/lib/credits"
import { PLANS, isPaidPlanId, isBillingInterval, comparePlans, type PaidPlanId } from "@/lib/plans"

export const runtime = "nodejs"

type Admin = ReturnType<typeof createDirectClient>

async function alreadyProcessed(admin: Admin, event: Stripe.Event): Promise<boolean> {
  const { error } = await admin.from("stripe_events").insert({ id: event.id, type: event.type })
  // 23505 = unique_violation: we've seen this event before.
  return error?.code === "23505"
}

async function userIdForCustomer(admin: Admin, customerId: string | null | undefined): Promise<string | null> {
  if (!customerId) return null
  const { data } = await admin.from("profiles").select("id").eq("stripe_customer_id", customerId).maybeSingle()
  return data?.id ?? null
}

function planFromSubscription(sub: Stripe.Subscription): { plan: PaidPlanId; interval: "month" | "year" } | null {
  const price = sub.items.data[0]?.price
  const plan = price?.metadata?.plan ?? sub.metadata?.plan
  const interval = price?.recurring?.interval ?? sub.metadata?.interval
  if (!isPaidPlanId(plan) || !isBillingInterval(interval)) return null
  return { plan, interval }
}

function periodEnd(sub: Stripe.Subscription): string | null {
  const end = sub.items.data[0]?.current_period_end
  return end ? new Date(end * 1000).toISOString() : null
}

async function syncSubscription(admin: Admin, sub: Stripe.Subscription, opts: { grantCredits: boolean }) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id
  const userId = sub.metadata?.supabase_user_id || (await userIdForCustomer(admin, customerId))
  if (!userId) {
    console.error("[stripe-webhook] No user for customer", customerId)
    return
  }

  const resolved = planFromSubscription(sub)
  if (!resolved) {
    console.error("[stripe-webhook] Could not resolve plan for subscription", sub.id)
    return
  }

  const { data: current } = await admin
    .from("profiles")
    .select("plan, plan_credits, stripe_subscription_id")
    .eq("id", userId)
    .single()

  const activeStates: Stripe.Subscription.Status[] = ["active", "trialing"]
  const isActive = activeStates.includes(sub.status)
  const previousPlan = current?.plan ?? "free"
  const isUpgrade = isPaidPlanId(previousPlan) ? comparePlans(resolved.plan, previousPlan) > 0 : true
  const isNewSubscription = current?.stripe_subscription_id !== sub.id

  // On a downgrade, keep the higher allotment until the period rolls over; the
  // invoice.paid handler resets to the new plan's credits at renewal.
  const effectivePlan = isActive && !isUpgrade && !isNewSubscription && isPaidPlanId(previousPlan) ? previousPlan : resolved.plan

  await admin
    .from("profiles")
    .update({
      plan: isActive ? effectivePlan : previousPlan === "free" ? "free" : previousPlan,
      billing_interval: resolved.interval,
      stripe_subscription_id: sub.id,
      subscription_status: sub.status,
      current_period_end: periodEnd(sub),
      cancel_at_period_end: sub.cancel_at_period_end ?? false,
    })
    .eq("id", userId)

  if (opts.grantCredits && isActive && (isNewSubscription || isUpgrade)) {
    const target = PLANS[resolved.plan].monthlyCredits
    // Upgrade mid-cycle: top the bucket up to the new allotment rather than
    // stacking a full second grant.
    const newBalance = isNewSubscription ? target : Math.max(current?.plan_credits ?? 0, target)
    await setPlanCredits(userId, newBalance, "plan_grant", `${PLANS[resolved.plan].name} plan credits`)
  }
}

async function handleInvoicePaid(admin: Admin, invoice: Stripe.Invoice) {
  // Only renewals reset the bucket; the first invoice is handled by subscription.created.
  if (invoice.billing_reason !== "subscription_cycle") return

  const subId =
    typeof invoice.parent?.subscription_details?.subscription === "string"
      ? invoice.parent.subscription_details.subscription
      : invoice.parent?.subscription_details?.subscription?.id
  if (!subId) return

  const sub = await stripe.subscriptions.retrieve(subId)
  const resolved = planFromSubscription(sub)
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id
  const userId = sub.metadata?.supabase_user_id || (await userIdForCustomer(admin, customerId))
  if (!userId || !resolved) return

  await admin
    .from("profiles")
    .update({
      plan: resolved.plan,
      billing_interval: resolved.interval,
      subscription_status: sub.status,
      current_period_end: periodEnd(sub),
    })
    .eq("id", userId)

  // Annual subscribers still receive credits monthly, so a yearly invoice grants
  // one month's allotment now and the monthly cron grants the rest.
  await setPlanCredits(userId, PLANS[resolved.plan].monthlyCredits, "period_reset", `${PLANS[resolved.plan].name} monthly credits`)
}

async function handleCheckoutCompleted(admin: Admin, session: Stripe.Checkout.Session) {
  if (session.metadata?.kind !== "topup") return
  if (session.payment_status !== "paid") return

  const userId = session.metadata.supabase_user_id
  const credits = Number(session.metadata.credits)
  if (!userId || !Number.isInteger(credits) || credits <= 0) return

  await addTopupCredits(userId, credits, `${credits}-credit top-up pack`)
}

async function handleSubscriptionDeleted(admin: Admin, sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id
  const userId = sub.metadata?.supabase_user_id || (await userIdForCustomer(admin, customerId))
  if (!userId) return

  // Plan credits expire with the subscription; top-ups are kept but frozen until
  // the user subscribes again (spend_credits ignores them on the free plan).
  await admin
    .from("profiles")
    .update({
      plan: "free",
      billing_interval: null,
      plan_credits: 0,
      stripe_subscription_id: null,
      subscription_status: "canceled",
      current_period_end: null,
      cancel_at_period_end: false,
    })
    .eq("id", userId)
}

async function handlePaymentFailed(admin: Admin, invoice: Stripe.Invoice) {
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id
  const userId = await userIdForCustomer(admin, customerId)
  if (!userId) return
  await admin.from("profiles").update({ subscription_status: "past_due" }).eq("id", userId)
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET is not set")
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 })
  }

  const signature = request.headers.get("stripe-signature")
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 })

  let event: Stripe.Event
  try {
    const body = await request.text()
    event = stripe.webhooks.constructEvent(body, signature, secret)
  } catch (err) {
    console.error("[stripe-webhook] Signature verification failed:", err instanceof Error ? err.message : err)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  const admin = createDirectClient()
  if (await alreadyProcessed(admin, event)) {
    return NextResponse.json({ received: true, duplicate: true })
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(admin, event.data.object)
        break
      case "customer.subscription.created":
        await syncSubscription(admin, event.data.object, { grantCredits: true })
        break
      case "customer.subscription.updated":
        await syncSubscription(admin, event.data.object, { grantCredits: true })
        break
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(admin, event.data.object)
        break
      case "invoice.paid":
        await handleInvoicePaid(admin, event.data.object)
        break
      case "invoice.payment_failed":
        await handlePaymentFailed(admin, event.data.object)
        break
      default:
        break
    }
  } catch (err) {
    console.error(`[stripe-webhook] Handler failed for ${event.type}:`, err)
    // Let Stripe retry; drop the idempotency marker so the retry is processed.
    await admin.from("stripe_events").delete().eq("id", event.id)
    return NextResponse.json({ error: "Handler failed" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
