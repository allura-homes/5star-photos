"use server"

import { createClient } from "@/lib/supabase/server"
import { createDirectClient } from "@/lib/supabase/direct"
import { chargeForAction, refundCredits, getBalance } from "@/lib/credits"
import { ACTIVE_MODELS } from "@/lib/constants/models"
import { CREDIT_COSTS, planAllowsModel, PLANS, type PlanId } from "@/lib/plans"
import type { ModelProvider } from "@/lib/types"

export type StartTransformResult =
  | {
      ok: true
      transformId: string
      models: { model: ModelProvider; label: string }[]
      lockedModels: { model: ModelProvider; label: string }[]
      plan: PlanId
      creditsRemaining: number
    }
  | {
      ok: false
      error: string
      code: "INSUFFICIENT_CREDITS" | "PAST_DUE" | "NOT_AUTHENTICATED" | "NOT_FOUND" | "START_FAILED"
      plan?: PlanId
      required?: number
      available?: number
    }

async function sessionUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

// Charges one transform (all models included) and returns the models the
// user's plan may run. Every /api/edit-image call must carry the transformId.
export async function startTransform(imageId: string): Promise<StartTransformResult> {
  const user = await sessionUser()
  if (!user) return { ok: false, error: "Please sign in.", code: "NOT_AUTHENTICATED" }

  const admin = createDirectClient()
  const { data: image } = await admin
    .from("images")
    .select("id, original_filename")
    .eq("id", imageId)
    .eq("user_id", user.id)
    .single()
  if (!image) return { ok: false, error: "Image not found.", code: "NOT_FOUND" }

  const balance = await getBalance(user.id)
  const plan: PlanId = balance?.plan ?? "free"

  const allowed = ACTIVE_MODELS.filter((m) => planAllowsModel(plan, m.provider))
  const locked = ACTIVE_MODELS.filter((m) => !planAllowsModel(plan, m.provider))

  const charge = await chargeForAction(user.id, "transform", {
    description: `Transformed ${image.original_filename}`,
    imageId,
  })

  if (!charge.ok) {
    return {
      ok: false,
      error: charge.code === "past_due" ? "Your last payment failed. Update your payment method to keep creating." : "You're out of credits.",
      code: charge.code === "past_due" ? "PAST_DUE" : "INSUFFICIENT_CREDITS",
      required: CREDIT_COSTS.transform,
      available: charge.total,
      plan,
    }
  }

  const { data: chargeRow, error } = await admin
    .from("transform_charges")
    .insert({
      user_id: user.id,
      image_id: imageId,
      amount: CREDIT_COSTS.transform,
      models: allowed.map((m) => m.provider),
    })
    .select("transform_id")
    .single()

  if (error || !chargeRow) {
    console.log("[v0] transform_charges insert failed:", error?.message, error?.details, error?.hint, error?.code)
    await refundCredits(user.id, CREDIT_COSTS.transform, { description: "Refund: transform could not start", imageId })
    return { ok: false, error: "Could not start the transform. Your credits were not charged.", code: "START_FAILED" }
  }

  return {
    ok: true,
    transformId: chargeRow.transform_id,
    models: allowed.map((m) => ({ model: m.provider, label: m.label })),
    lockedModels: locked.map((m) => ({ model: m.provider, label: m.label })),
    plan,
    creditsRemaining: charge.total,
  }
}

// Called after every model has returned. Refunds the transform only when the
// server saw zero successful outputs for it.
export async function finishTransform(transformId: string): Promise<{ refunded: boolean }> {
  const user = await sessionUser()
  if (!user) return { refunded: false }

  const admin = createDirectClient()
  const { data: charge } = await admin
    .from("transform_charges")
    .select("transform_id, image_id, amount, success_count, refunded_at")
    .eq("transform_id", transformId)
    .eq("user_id", user.id)
    .single()

  if (!charge || charge.refunded_at || charge.success_count > 0) return { refunded: false }

  const { data: locked } = await admin
    .from("transform_charges")
    .update({ refunded_at: new Date().toISOString() })
    .eq("transform_id", transformId)
    .is("refunded_at", null)
    .select("transform_id")
  if (!locked || locked.length === 0) return { refunded: false }

  await refundCredits(user.id, charge.amount, {
    description: "Refund: no model produced a result",
    imageId: charge.image_id,
  })
  return { refunded: true }
}

export async function getPlanModels(): Promise<{
  plan: PlanId
  planName: string
  models: { model: ModelProvider; label: string }[]
  lockedModels: { model: ModelProvider; label: string }[]
}> {
  const user = await sessionUser()
  const balance = user ? await getBalance(user.id) : null
  const plan: PlanId = balance?.plan ?? "free"
  return {
    plan,
    planName: PLANS[plan].name,
    models: ACTIVE_MODELS.filter((m) => planAllowsModel(plan, m.provider)).map((m) => ({ model: m.provider, label: m.label })),
    lockedModels: ACTIVE_MODELS.filter((m) => !planAllowsModel(plan, m.provider)).map((m) => ({
      model: m.provider,
      label: m.label,
    })),
  }
}
