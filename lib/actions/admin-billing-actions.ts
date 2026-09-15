"use server"

import { createDirectClient } from "@/lib/supabase/direct"
import { spendCredits } from "@/lib/credits"
import { stripe } from "@/lib/stripe"
import { requireAdmin, requireSuperAdmin, writeAuditLog, AdminAuthError } from "@/lib/admin-auth"
import { revalidatePath } from "next/cache"

const MAX_ADJUSTMENT = 10_000

function toActionError(error: unknown): { ok: false; error: string } {
  if (error instanceof AdminAuthError) return { ok: false, error: error.message }
  console.error("[admin-billing] Unexpected error:", error)
  return { ok: false, error: "Something went wrong. Please try again." }
}

/**
 * Grant (positive delta) or remove (negative delta) credits for any user.
 * Available to both admin tiers. Goes through the same atomic `spend_credits`
 * RPC as every other balance change so the ledger stays consistent; grants land
 * in the plan bucket. Every adjustment is written to the audit log.
 */
export async function adminAdjustCredits(
  userId: string,
  delta: number,
  reason: string,
): Promise<{ ok: boolean; total?: number; error?: string }> {
  try {
    const actor = await requireAdmin()

    if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > MAX_ADJUSTMENT) {
      return { ok: false, error: `Enter a whole number between -${MAX_ADJUSTMENT} and ${MAX_ADJUSTMENT}.` }
    }
    const trimmedReason = reason.trim()
    if (trimmedReason.length < 3) return { ok: false, error: "Add a short reason for the audit trail." }

    const admin = createDirectClient()
    const { data: target } = await admin.from("profiles").select("email").eq("id", userId).maybeSingle()

    // spend_credits debits on positive amounts, so a grant is a negative spend.
    const result = await spendCredits(userId, -delta, "admin_adjust", {
      description: `Admin adjustment by ${actor.email ?? actor.userId}: ${trimmedReason}`,
    })

    if (!result.ok) {
      return {
        ok: false,
        error:
          result.code === "insufficient" ? "User does not have that many credits to remove." : "Adjustment failed.",
      }
    }

    await writeAuditLog(admin, {
      actor,
      action: "credits.adjust",
      targetUserId: userId,
      targetEmail: target?.email ?? null,
      reason: trimmedReason,
      metadata: { delta, newTotal: result.total },
    })

    revalidatePath("/admin")
    return { ok: true, total: result.total }
  } catch (error) {
    return toActionError(error)
  }
}

/**
 * Refund a specific payment (charge or payment intent) via Stripe. Super-admin
 * only. Stripe is the source of truth; the refund event reconciles through the
 * webhook. We only record the intent in the audit log here.
 */
export async function adminRefundPayment(
  userId: string,
  paymentIntentId: string,
  reason: string,
): Promise<{ ok: boolean; refundId?: string; error?: string }> {
  try {
    const actor = await requireSuperAdmin()
    const trimmedReason = reason.trim()
    if (trimmedReason.length < 3) return { ok: false, error: "Add a short reason for the audit trail." }
    if (!paymentIntentId.startsWith("pi_") && !paymentIntentId.startsWith("ch_")) {
      return { ok: false, error: "Enter a valid Stripe payment intent (pi_) or charge (ch_) id." }
    }

    const admin = createDirectClient()
    const { data: target } = await admin
      .from("profiles")
      .select("email, stripe_customer_id")
      .eq("id", userId)
      .maybeSingle()

    // Idempotency key prevents a double refund if the action is retried.
    const refund = await stripe.refunds.create(
      {
        [paymentIntentId.startsWith("pi_") ? "payment_intent" : "charge"]: paymentIntentId,
        reason: "requested_by_customer",
        metadata: { admin_actor: actor.email ?? actor.userId, supabase_user_id: userId },
      },
      { idempotencyKey: `admin-refund-${paymentIntentId}` },
    )

    await writeAuditLog(admin, {
      actor,
      action: "payment.refund",
      targetUserId: userId,
      targetEmail: target?.email ?? null,
      reason: trimmedReason,
      metadata: { paymentIntentId, refundId: refund.id, amount: refund.amount, currency: refund.currency },
    })

    revalidatePath("/admin")
    return { ok: true, refundId: refund.id }
  } catch (error) {
    if (error && typeof error === "object" && "type" in error) {
      // Stripe error: surface a safe message, log the detail.
      console.error("[admin-billing] Stripe refund failed:", error)
      return { ok: false, error: "Stripe rejected the refund. Check the payment id and try again." }
    }
    return toActionError(error)
  }
}

/**
 * Cancel a user's subscription. Super-admin only. Defaults to cancel-at-period-
 * end so the customer keeps access they paid for; pass immediate=true to cancel
 * now. The subscription.updated/deleted webhook reconciles plan + credits.
 */
export async function adminCancelSubscription(
  userId: string,
  reason: string,
  immediate = false,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const actor = await requireSuperAdmin()
    const trimmedReason = reason.trim()
    if (trimmedReason.length < 3) return { ok: false, error: "Add a short reason for the audit trail." }

    const admin = createDirectClient()
    const { data: target } = await admin
      .from("profiles")
      .select("email, stripe_subscription_id")
      .eq("id", userId)
      .maybeSingle()

    if (!target?.stripe_subscription_id) {
      return { ok: false, error: "This user has no active subscription." }
    }

    if (immediate) {
      await stripe.subscriptions.cancel(target.stripe_subscription_id)
    } else {
      await stripe.subscriptions.update(target.stripe_subscription_id, { cancel_at_period_end: true })
    }

    await writeAuditLog(admin, {
      actor,
      action: immediate ? "subscription.cancel_now" : "subscription.cancel_at_period_end",
      targetUserId: userId,
      targetEmail: target.email ?? null,
      reason: trimmedReason,
      metadata: { subscriptionId: target.stripe_subscription_id, immediate },
    })

    revalidatePath("/admin")
    return { ok: true }
  } catch (error) {
    if (error && typeof error === "object" && "type" in error) {
      console.error("[admin-billing] Stripe cancel failed:", error)
      return { ok: false, error: "Stripe rejected the cancellation. Try again." }
    }
    return toActionError(error)
  }
}

/**
 * Undo a pending cancel-at-period-end. Super-admin only. No-op if the
 * subscription was already fully canceled (a new checkout is required then).
 */
export async function adminReactivateSubscription(
  userId: string,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const actor = await requireSuperAdmin()
    const trimmedReason = reason.trim()
    if (trimmedReason.length < 3) return { ok: false, error: "Add a short reason for the audit trail." }

    const admin = createDirectClient()
    const { data: target } = await admin
      .from("profiles")
      .select("email, stripe_subscription_id")
      .eq("id", userId)
      .maybeSingle()

    if (!target?.stripe_subscription_id) {
      return { ok: false, error: "This user has no subscription to reactivate. They must re-subscribe." }
    }

    await stripe.subscriptions.update(target.stripe_subscription_id, { cancel_at_period_end: false })

    await writeAuditLog(admin, {
      actor,
      action: "subscription.reactivate",
      targetUserId: userId,
      targetEmail: target.email ?? null,
      reason: trimmedReason,
      metadata: { subscriptionId: target.stripe_subscription_id },
    })

    revalidatePath("/admin")
    return { ok: true }
  } catch (error) {
    if (error && typeof error === "object" && "type" in error) {
      console.error("[admin-billing] Stripe reactivate failed:", error)
      return { ok: false, error: "Stripe rejected the reactivation. Try again." }
    }
    return toActionError(error)
  }
}
