"use server"

import { createDirectClient } from "@/lib/supabase/direct"
import { requireAdmin, writeAuditLog, AdminAuthError, type AdminIdentity } from "@/lib/admin-auth"
import { getSiteUrl } from "@/lib/stripe"
import { adminAdjustCredits } from "@/lib/actions/admin-billing-actions"
import { setUserSuspended } from "@/lib/actions/admin-actions"
import { revalidatePath } from "next/cache"
import type { SupabaseClient } from "@supabase/supabase-js"

const MAX_BATCH = 100

function toActionError(error: unknown): { ok: false; error: string } {
  if (error instanceof AdminAuthError) return { ok: false, error: error.message }
  console.error("[admin-account] Unexpected error:", error)
  return { ok: false, error: "Something went wrong. Please try again." }
}

async function lookupEmail(admin: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await admin.from("profiles").select("email").eq("id", userId).maybeSingle()
  return data?.email ?? null
}

/**
 * Sends a Supabase password-recovery email to one user. Available to both
 * admin tiers. Goes through the same recovery flow as the public forgot-
 * password page, so the link lands on /auth/callback?type=recovery and the
 * user is forced onto the reset-password screen.
 */
async function sendResetForUser(
  admin: SupabaseClient,
  actor: AdminIdentity,
  userId: string,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  const email = await lookupEmail(admin, userId)
  if (!email) return { ok: false, error: "User not found." }

  const { error } = await admin.auth.resetPasswordForEmail(email, {
    redirectTo: `${getSiteUrl()}/auth/callback`,
  })
  if (error) {
    console.error("[admin-account] resetPasswordForEmail failed:", error.message)
    return { ok: false, error: error.message.includes("rate") ? "Rate limited. Try again in a minute." : "Could not send the reset email." }
  }

  await writeAuditLog(admin, {
    actor,
    action: "user.password_reset_sent",
    targetUserId: userId,
    targetEmail: email,
    reason,
  })
  return { ok: true }
}

/**
 * Marks a user's email as confirmed without them clicking the link. Available
 * to both admin tiers (a support task when a confirmation email never arrived).
 */
async function verifyEmailForUser(
  admin: SupabaseClient,
  actor: AdminIdentity,
  userId: string,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  const email = await lookupEmail(admin, userId)
  if (!email) return { ok: false, error: "User not found." }

  const { error } = await admin.auth.admin.updateUserById(userId, { email_confirm: true })
  if (error) {
    console.error("[admin-account] email_confirm failed:", error.message)
    return { ok: false, error: "Could not mark the email as verified." }
  }

  await writeAuditLog(admin, {
    actor,
    action: "user.email_verified",
    targetUserId: userId,
    targetEmail: email,
    reason,
  })
  return { ok: true }
}

function validateReason(reason: string): string | null {
  const trimmed = reason.trim()
  return trimmed.length >= 3 ? trimmed : null
}

function validateIds(userIds: string[]): string[] | null {
  const unique = Array.from(new Set(userIds.filter((id) => typeof id === "string" && id.length > 0)))
  if (unique.length === 0 || unique.length > MAX_BATCH) return null
  return unique
}

export async function adminSendPasswordReset(
  userId: string,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const actor = await requireAdmin()
    const trimmed = validateReason(reason)
    if (!trimmed) return { ok: false, error: "Add a short reason for the audit trail." }
    const result = await sendResetForUser(createDirectClient(), actor, userId, trimmed)
    revalidatePath("/admin")
    return result
  } catch (error) {
    return toActionError(error)
  }
}

export async function adminVerifyEmail(
  userId: string,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const actor = await requireAdmin()
    const trimmed = validateReason(reason)
    if (!trimmed) return { ok: false, error: "Add a short reason for the audit trail." }
    const result = await verifyEmailForUser(createDirectClient(), actor, userId, trimmed)
    revalidatePath("/admin")
    return result
  } catch (error) {
    return toActionError(error)
  }
}

export interface BulkResult {
  ok: boolean
  succeeded: number
  failed: { userId: string; error: string }[]
  error?: string
}

function summarize(results: { userId: string; result: { ok: boolean; error?: string } }[]): BulkResult {
  const failed = results.filter((r) => !r.result.ok).map((r) => ({ userId: r.userId, error: r.result.error ?? "Failed" }))
  const succeeded = results.length - failed.length
  return {
    ok: failed.length === 0,
    succeeded,
    failed,
    error: failed.length > 0 ? `${failed.length} of ${results.length} failed.` : undefined,
  }
}

/**
 * Runs a per-user action sequentially so one bad row never aborts the batch,
 * and every success/failure is reported back individually.
 */
async function runBatch(
  userIds: string[],
  fn: (userId: string) => Promise<{ ok: boolean; error?: string }>,
): Promise<BulkResult> {
  const results: { userId: string; result: { ok: boolean; error?: string } }[] = []
  for (const userId of userIds) {
    try {
      results.push({ userId, result: await fn(userId) })
    } catch (error) {
      results.push({ userId, result: toActionError(error) })
    }
  }
  revalidatePath("/admin")
  return summarize(results)
}

export type BulkAction = "password_reset" | "verify_email" | "suspend" | "reinstate" | "adjust_credits"

/**
 * Batch entry point for the multi-select toolbar. Authorization is enforced by
 * the per-user action being invoked (suspend/reinstate require super_admin via
 * setUserSuspended; the rest require any staff role).
 */
export async function adminBulkAction(params: {
  action: BulkAction
  userIds: string[]
  reason: string
  delta?: number
}): Promise<BulkResult> {
  const empty: BulkResult = { ok: false, succeeded: 0, failed: [] }
  try {
    const actor = await requireAdmin()
    const ids = validateIds(params.userIds)
    if (!ids) return { ...empty, error: `Select between 1 and ${MAX_BATCH} users.` }
    const reason = validateReason(params.reason)
    if (!reason) return { ...empty, error: "Add a short reason for the audit trail." }

    const admin = createDirectClient()

    switch (params.action) {
      case "password_reset":
        return runBatch(ids, (id) => sendResetForUser(admin, actor, id, reason))
      case "verify_email":
        return runBatch(ids, (id) => verifyEmailForUser(admin, actor, id, reason))
      case "suspend":
        return runBatch(ids, (id) => setUserSuspended(id, true, reason))
      case "reinstate":
        return runBatch(ids, (id) => setUserSuspended(id, false, reason))
      case "adjust_credits": {
        const delta = params.delta
        if (delta === undefined || !Number.isInteger(delta) || delta === 0) {
          return { ...empty, error: "Enter a non-zero whole number of credits." }
        }
        return runBatch(ids, (id) => adminAdjustCredits(id, delta, reason))
      }
      default:
        return { ...empty, error: "Unknown action." }
    }
  } catch (error) {
    return { ...empty, ...toActionError(error) }
  }
}
