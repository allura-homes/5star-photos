"use server"

import { createClient } from "@/lib/supabase/server"
import { createDirectClient } from "@/lib/supabase/direct"
import { spendCredits } from "@/lib/credits"

const MAX_ADJUSTMENT = 10_000

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Please sign in to continue.")

  const admin = createDirectClient()
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") throw new Error("Admin access required.")
  return user
}

/**
 * Grant (positive delta) or remove (negative delta) credits for any user.
 * Goes through the same atomic `spend_credits` RPC as every other balance
 * change so the ledger stays consistent; grants land in the plan bucket.
 */
export async function adminAdjustCredits(
  userId: string,
  delta: number,
  reason: string,
): Promise<{ ok: boolean; total?: number; error?: string }> {
  const actor = await requireAdmin()

  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > MAX_ADJUSTMENT) {
    return { ok: false, error: `Enter a whole number between -${MAX_ADJUSTMENT} and ${MAX_ADJUSTMENT}.` }
  }
  const trimmedReason = reason.trim()
  if (trimmedReason.length < 3) return { ok: false, error: "Add a short reason for the audit trail." }

  // spend_credits debits on positive amounts, so a grant is a negative spend.
  const result = await spendCredits(userId, -delta, "admin_adjust", {
    description: `Admin adjustment by ${actor.email ?? actor.id}: ${trimmedReason}`,
  })

  if (!result.ok) {
    return {
      ok: false,
      error:
        result.code === "insufficient" ? "User does not have that many credits to remove." : "Adjustment failed.",
    }
  }
  return { ok: true, total: result.total }
}
