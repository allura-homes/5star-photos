"use server"

import { createClient } from "@/lib/supabase/server"
import { createDirectClient } from "@/lib/supabase/direct"
import { stripe, getPriceIdByLookupKey, getSiteUrl } from "@/lib/stripe"
import { getBalance, type CreditBalance } from "@/lib/credits"
import {
  PLANS,
  getTopupPack,
  isPaidPlanId,
  isBillingInterval,
  planLookupKey,
  topupLookupKey,
  comparePlans,
  type PaidPlanId,
  type BillingInterval,
} from "@/lib/plans"

async function requireSessionUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Please sign in to continue.")
  return user
}

async function getOrCreateCustomer(userId: string, email: string | undefined): Promise<string> {
  const admin = createDirectClient()
  const { data: profile } = await admin.from("profiles").select("stripe_customer_id").eq("id", userId).single()
  if (profile?.stripe_customer_id) return profile.stripe_customer_id

  const customer = await stripe.customers.create({ email, metadata: { supabase_user_id: userId } })
  await admin.from("profiles").update({ stripe_customer_id: customer.id }).eq("id", userId)
  return customer.id
}

export interface CheckoutSessionResult {
  clientSecret: string
}

// Subscription checkout (new subscribers). Existing subscribers change plans via
// changePlan() so Stripe prorates instead of creating a second subscription.
export async function createSubscriptionCheckout(
  planInput: string,
  intervalInput: string,
): Promise<CheckoutSessionResult> {
  if (!isPaidPlanId(planInput)) throw new Error("Unknown plan.")
  if (!isBillingInterval(intervalInput)) throw new Error("Unknown billing interval.")
  const plan: PaidPlanId = planInput
  const interval: BillingInterval = intervalInput

  const user = await requireSessionUser()
  const balance = await getBalance(user.id)
  if (balance && balance.plan !== "free" && balance.subscriptionStatus !== "canceled") {
    throw new Error("You already have a subscription. Change your plan from the Account page.")
  }

  const customerId = await getOrCreateCustomer(user.id, user.email)
  const priceId = await getPriceIdByLookupKey(planLookupKey(plan, interval))

  const session = await stripe.checkout.sessions.create({
    ui_mode: "embedded_page",
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    return_url: `${getSiteUrl()}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
    allow_promotion_codes: true,
    subscription_data: {
      metadata: { supabase_user_id: user.id, plan, interval },
    },
    metadata: { supabase_user_id: user.id, kind: "subscription", plan, interval },
  })

  if (!session.client_secret) throw new Error("Stripe did not return a checkout client secret.")
  return { clientSecret: session.client_secret }
}

// One-time top-up purchase. Only subscribers may buy packs.
export async function createTopupCheckout(packId: string): Promise<CheckoutSessionResult> {
  const pack = getTopupPack(packId)
  if (!pack) throw new Error("Unknown credit pack.")

  const user = await requireSessionUser()
  const balance = await getBalance(user.id)
  if (!balance || balance.plan === "free") {
    throw new Error("Top-up packs are available on any paid plan. Subscribe to Start-up or higher first.")
  }
  if (balance.subscriptionStatus === "past_due" || balance.subscriptionStatus === "unpaid") {
    throw new Error("Update your payment method before buying more credits.")
  }

  const customerId = await getOrCreateCustomer(user.id, user.email)
  const priceId = await getPriceIdByLookupKey(topupLookupKey(pack.id))

  const session = await stripe.checkout.sessions.create(
    {
      ui_mode: "embedded_page",
      mode: "payment",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      return_url: `${getSiteUrl()}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      payment_intent_data: {
        metadata: { supabase_user_id: user.id, pack: pack.id, credits: String(pack.credits) },
      },
      metadata: { supabase_user_id: user.id, kind: "topup", pack: pack.id, credits: String(pack.credits) },
    },
    // Prevents a double-click from creating two sessions for the same pack in the same minute.
    { idempotencyKey: `topup:${user.id}:${pack.id}:${Math.floor(Date.now() / 60_000)}` },
  )

  if (!session.client_secret) throw new Error("Stripe did not return a checkout client secret.")
  return { clientSecret: session.client_secret }
}

// Upgrade/downgrade an active subscription in place. Upgrades prorate immediately;
// downgrades take effect at the period end so the user keeps what they paid for.
export async function changePlan(planInput: string, intervalInput: string): Promise<{ ok: true }> {
  if (!isPaidPlanId(planInput)) throw new Error("Unknown plan.")
  if (!isBillingInterval(intervalInput)) throw new Error("Unknown billing interval.")

  const user = await requireSessionUser()
  const admin = createDirectClient()
  const { data: profile } = await admin
    .from("profiles")
    .select("plan, stripe_subscription_id, billing_interval")
    .eq("id", user.id)
    .single()

  if (!profile?.stripe_subscription_id) throw new Error("No active subscription to change.")

  const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id)
  const item = subscription.items.data[0]
  if (!item) throw new Error("Subscription has no items.")

  const priceId = await getPriceIdByLookupKey(planLookupKey(planInput, intervalInput))
  const isUpgrade = comparePlans(planInput, profile.plan) > 0 || (intervalInput === "year" && profile.billing_interval === "month")

  await stripe.subscriptions.update(subscription.id, {
    items: [{ id: item.id, price: priceId }],
    proration_behavior: isUpgrade ? "always_invoice" : "none",
    // Downgrades still switch the price now; the webhook keeps the old credit
    // allotment until the current period ends.
    metadata: { supabase_user_id: user.id, plan: planInput, interval: intervalInput },
  })

  return { ok: true }
}

export async function createPortalSession(): Promise<{ url: string }> {
  const user = await requireSessionUser()
  const customerId = await getOrCreateCustomer(user.id, user.email)
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${getSiteUrl()}/account`,
  })
  return { url: session.url }
}

// Fresh balance for the signed-in user. Used by /checkout/return to poll until
// the Stripe webhook has landed, and by the Account page.
export async function getMyBalance(): Promise<CreditBalance | null> {
  const user = await requireSessionUser()
  return getBalance(user.id)
}

export async function getCheckoutSessionStatus(sessionId: string): Promise<{
  status: string | null
  kind: string | null
  plan: string | null
  credits: number | null
}> {
  const user = await requireSessionUser()
  if (!sessionId || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) throw new Error("Invalid session.")

  const session = await stripe.checkout.sessions.retrieve(sessionId)
  if (session.metadata?.supabase_user_id !== user.id) throw new Error("Session does not belong to this user.")

  const kind = session.metadata?.kind ?? null
  const plan = session.metadata?.plan ?? null
  const credits =
    kind === "topup"
      ? Number(session.metadata?.credits ?? 0)
      : isPaidPlanId(plan)
        ? PLANS[plan].monthlyCredits
        : null

  return { status: session.status, kind, plan, credits }
}
