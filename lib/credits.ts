import "server-only"

import { createDirectClient } from "@/lib/supabase/direct"
import { CREDIT_COSTS, type CreditAction, type PlanId, isPlanId } from "@/lib/plans"

export type SpendCode = "ok" | "insufficient" | "past_due" | "forbidden" | "no_profile"

export interface SpendResult {
  ok: boolean
  code: SpendCode
  planCredits: number
  topupCredits: number
  bonusCredits: number
  total: number
  plan: PlanId
}

export interface CreditBalance {
  plan: PlanId
  planCredits: number
  topupCredits: number
  /** Non-expiring credits (beta bonus, internal grants). Spendable on every plan. */
  bonusCredits: number
  total: number
  subscriptionStatus: string | null
  currentPeriodEnd: string | null
  billingInterval: "month" | "year" | null
  stripeCustomerId: string | null
}

const LEDGER_TYPE: Record<CreditAction, string> = {
  upload: "upload",
  transform: "transform",
  save_variation: "save_variation",
  download_hires: "download_hires",
  upscale: "upscale",
}

// Top-up credits are frozen (not lost) while a user is not subscribed; bonus credits always count.
export function usableTotal(plan: PlanId, planCredits: number, topupCredits: number, bonusCredits: number): number {
  return planCredits + (plan === "free" ? 0 : topupCredits) + bonusCredits
}

export async function getBalance(userId: string): Promise<CreditBalance | null> {
  const supabase = createDirectClient()
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "plan, plan_credits, topup_credits, bonus_credits, subscription_status, current_period_end, billing_interval, stripe_customer_id",
    )
    .eq("id", userId)
    .single()

  if (error || !data) return null

  const plan: PlanId = isPlanId(data.plan) ? data.plan : "free"
  const bonus = data.bonus_credits ?? 0

  return {
    plan,
    planCredits: data.plan_credits,
    topupCredits: data.topup_credits,
    bonusCredits: bonus,
    total: usableTotal(plan, data.plan_credits, data.topup_credits, bonus),
    subscriptionStatus: data.subscription_status,
    currentPeriodEnd: data.current_period_end,
    billingInterval: data.billing_interval,
    stripeCustomerId: data.stripe_customer_id,
  }
}

interface SpendOptions {
  description?: string
  imageId?: string | null
  jobId?: string | null
  /** Override the default CREDIT_COSTS price (e.g. download + upscale bundled). */
  amount?: number
}

// Atomically debits credits (plan, then top-up, then bonus) and writes the ledger row.
// A negative amount is a credit back: "bonus_grant" lands in the bonus bucket, everything else in plan.
export async function spendCredits(
  userId: string,
  amount: number,
  type: CreditAction | "refund" | "admin_adjust" | "bonus_grant",
  options: SpendOptions = {},
): Promise<SpendResult> {
  const supabase = createDirectClient()
  const ledgerType = type in LEDGER_TYPE ? LEDGER_TYPE[type as CreditAction] : type

  const { data, error } = await supabase.rpc("spend_credits", {
    p_user: userId,
    p_amount: amount,
    p_type: ledgerType,
    p_description: options.description ?? null,
    p_image_id: options.imageId ?? null,
    p_job_id: options.jobId ?? null,
  })

  if (error || !data || data.length === 0) {
    console.error("[credits] spend_credits failed:", error?.message)
    return { ok: false, code: "no_profile", planCredits: 0, topupCredits: 0, bonusCredits: 0, total: 0, plan: "free" }
  }

  const row = data[0] as {
    ok: boolean
    plan_credits: number
    topup_credits: number
    bonus_credits: number
    code: SpendCode
    plan: string
  }
  const plan: PlanId = isPlanId(row.plan) ? row.plan : "free"
  const bonus = row.bonus_credits ?? 0
  return {
    ok: row.ok,
    code: row.code,
    planCredits: row.plan_credits,
    topupCredits: row.topup_credits,
    bonusCredits: bonus,
    total: usableTotal(plan, row.plan_credits, row.topup_credits, bonus),
    plan,
  }
}

/** Grant non-expiring bonus credits (beta promo, internal accounts). */
export async function grantBonusCredits(userId: string, amount: number, description: string): Promise<SpendResult> {
  return spendCredits(userId, -Math.abs(amount), "bonus_grant", { description })
}

export async function chargeForAction(
  userId: string,
  action: CreditAction,
  options: SpendOptions = {},
): Promise<SpendResult> {
  return spendCredits(userId, options.amount ?? CREDIT_COSTS[action], action, options)
}

export async function refundCredits(userId: string, amount: number, options: SpendOptions = {}): Promise<SpendResult> {
  return spendCredits(userId, -Math.abs(amount), "refund", options)
}

// Used by the webhook to set/reset the monthly plan bucket and to add top-ups.
export async function setPlanCredits(
  userId: string,
  planCredits: number,
  ledgerType: "plan_grant" | "period_reset",
  description: string,
): Promise<void> {
  const supabase = createDirectClient()
  const { data: profile } = await supabase
    .from("profiles")
    .select("topup_credits, bonus_credits")
    .eq("id", userId)
    .single()

  const { error } = await supabase.from("profiles").update({ plan_credits: planCredits }).eq("id", userId)
  if (error) throw new Error(`setPlanCredits failed: ${error.message}`)

  await supabase.from("token_transactions").insert({
    user_id: userId,
    type: ledgerType,
    amount: planCredits,
    description,
    balance_after: planCredits + (profile?.topup_credits ?? 0) + (profile?.bonus_credits ?? 0),
  })
}

export async function addTopupCredits(userId: string, credits: number, description: string): Promise<void> {
  const supabase = createDirectClient()
  const { data: profile, error: readError } = await supabase
    .from("profiles")
    .select("plan_credits, topup_credits, bonus_credits")
    .eq("id", userId)
    .single()
  if (readError || !profile) throw new Error(`addTopupCredits: profile not found`)

  const newTopup = profile.topup_credits + credits
  const { error } = await supabase.from("profiles").update({ topup_credits: newTopup }).eq("id", userId)
  if (error) throw new Error(`addTopupCredits failed: ${error.message}`)

  await supabase.from("token_transactions").insert({
    user_id: userId,
    type: "topup_purchase",
    amount: credits,
    description,
    balance_after: profile.plan_credits + newTopup + (profile.bonus_credits ?? 0),
  })
}

export function insufficientCreditsResponse(result: SpendResult, action: CreditAction) {
  return {
    error:
      result.code === "past_due"
        ? "Your last payment failed. Update your payment method to keep creating."
        : "You're out of credits.",
    code: result.code === "past_due" ? "PAST_DUE" : "INSUFFICIENT_CREDITS",
    required: CREDIT_COSTS[action],
    available: result.total,
    plan: result.plan,
  }
}
