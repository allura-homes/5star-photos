"use server"

import { createDirectClient } from "@/lib/supabase/direct"
import {
  requireAdmin,
  requireSuperAdmin,
  writeAuditLog,
  AdminAuthError,
  type AdminRole,
} from "@/lib/admin-auth"
import { PLANS, type PlanId } from "@/lib/plans"
import { revalidatePath } from "next/cache"

function toActionError(error: unknown): { ok: false; error: string } {
  if (error instanceof AdminAuthError) return { ok: false, error: error.message }
  console.error("[admin-actions] Unexpected error:", error)
  return { ok: false, error: "Something went wrong. Please try again." }
}

// A ~100-year ban is Supabase's idiom for an indefinite block: it invalidates
// refresh tokens (revoking sessions) and rejects sign-in until lifted.
const INDEFINITE_BAN = "876000h"

export interface AdminMetrics {
  totalUsers: number
  activeSubscribers: number
  suspendedUsers: number
  pastDueUsers: number
  mrrCents: number
  planBreakdown: Record<PlanId, number>
  newUsers30d: number
  canceled30d: number
  /** The caller's own tier, resolved server-side so UI gating never depends on
   * the flaky client profile fetch. */
  viewerRole: AdminRole
}

/** Overview metrics. MRR is normalized to a monthly figure from active subs. */
export async function getAdminMetrics(): Promise<AdminMetrics> {
  const identity = await requireAdmin()
  const admin = createDirectClient()

  const { data: rows } = await admin
    .from("profiles")
    .select("plan, billing_interval, subscription_status, is_suspended, created_at")

  const profiles = rows ?? []
  const now = Date.now()
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000

  const planBreakdown: Record<PlanId, number> = { free: 0, startup: 0, pro: 0, max: 0 }
  let activeSubscribers = 0
  let suspendedUsers = 0
  let pastDueUsers = 0
  let mrrCents = 0
  let newUsers30d = 0
  let canceled30d = 0

  for (const p of profiles) {
    const plan = (p.plan ?? "free") as PlanId
    if (plan in planBreakdown) planBreakdown[plan] += 1
    if (p.is_suspended) suspendedUsers += 1
    if (p.subscription_status === "past_due") pastDueUsers += 1
    if (p.created_at && now - new Date(p.created_at).getTime() < THIRTY_DAYS) newUsers30d += 1

    const isActive = p.subscription_status === "active" || p.subscription_status === "trialing"
    if (isActive && plan !== "free") {
      activeSubscribers += 1
      const planConfig = PLANS[plan]
      // Normalize annual plans to a monthly-equivalent contribution.
      mrrCents +=
        p.billing_interval === "year"
          ? Math.round(planConfig.annualPriceCents / 12)
          : planConfig.monthlyPriceCents
    }
    if (p.subscription_status === "canceled") canceled30d += 1
  }

  return {
    totalUsers: profiles.length,
    activeSubscribers,
    suspendedUsers,
    pastDueUsers,
    mrrCents,
    planBreakdown,
    newUsers30d,
    canceled30d,
    viewerRole: identity.adminRole,
  }
}

export interface AdminUserRow {
  id: string
  email: string
  displayName: string | null
  role: string
  adminRole: AdminRole | null
  plan: PlanId
  subscriptionStatus: string | null
  isSuspended: boolean
  totalCredits: number
  createdAt: string
}

/** Paginated, searchable user list. Service-role read bypasses self-only RLS. */
export async function listUsers(params: {
  search?: string
  page?: number
  pageSize?: number
} = {}): Promise<{ ok: boolean; users?: AdminUserRow[]; total?: number; error?: string }> {
  try {
    await requireAdmin()
    const admin = createDirectClient()
    const page = Math.max(1, params.page ?? 1)
    const pageSize = Math.min(100, Math.max(10, params.pageSize ?? 25))
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = admin
      .from("profiles")
      .select(
        "id, email, display_name, role, admin_role, plan, subscription_status, is_suspended, plan_credits, topup_credits, bonus_credits, created_at",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(from, to)

    const search = params.search?.trim()
    if (search) {
      // Escape PostgREST or-filter metacharacters in user input.
      const safe = search.replace(/[,()*]/g, " ")
      query = query.or(`email.ilike.%${safe}%,display_name.ilike.%${safe}%`)
    }

    const { data, count, error } = await query
    if (error) throw error

    const users: AdminUserRow[] = (data ?? []).map((p) => ({
      id: p.id,
      email: p.email,
      displayName: p.display_name,
      role: p.role,
      adminRole: (p.admin_role as AdminRole | null) ?? null,
      plan: (p.plan ?? "free") as PlanId,
      subscriptionStatus: p.subscription_status,
      isSuspended: Boolean(p.is_suspended),
      totalCredits: (p.plan_credits ?? 0) + (p.topup_credits ?? 0) + (p.bonus_credits ?? 0),
      createdAt: p.created_at,
    }))

    return { ok: true, users, total: count ?? users.length }
  } catch (error) {
    return toActionError(error)
  }
}

export interface AdminUserDetail extends AdminUserRow {
  planCredits: number
  topupCredits: number
  bonusCredits: number
  billingInterval: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean | null
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  suspendedAt: string | null
  recentTransactions: { id: string; type: string; amount: number; description: string | null; createdAt: string }[]
  jobCount: number
}

/** Full per-user drill-down: billing, credit buckets, recent ledger, job count. */
export async function getUserDetail(
  userId: string,
): Promise<{ ok: boolean; user?: AdminUserDetail; error?: string }> {
  try {
    await requireAdmin()
    const admin = createDirectClient()

    const { data: p, error } = await admin.from("profiles").select("*").eq("id", userId).maybeSingle()
    if (error) throw error
    if (!p) return { ok: false, error: "User not found." }

    const { data: txns } = await admin
      .from("token_transactions")
      .select("id, type, amount, description, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10)

    const { count: jobCount } = await admin
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)

    const user: AdminUserDetail = {
      id: p.id,
      email: p.email,
      displayName: p.display_name,
      role: p.role,
      adminRole: (p.admin_role as AdminRole | null) ?? null,
      plan: (p.plan ?? "free") as PlanId,
      subscriptionStatus: p.subscription_status,
      isSuspended: Boolean(p.is_suspended),
      totalCredits: (p.plan_credits ?? 0) + (p.topup_credits ?? 0) + (p.bonus_credits ?? 0),
      createdAt: p.created_at,
      planCredits: p.plan_credits ?? 0,
      topupCredits: p.topup_credits ?? 0,
      bonusCredits: p.bonus_credits ?? 0,
      billingInterval: p.billing_interval,
      currentPeriodEnd: p.current_period_end,
      cancelAtPeriodEnd: p.cancel_at_period_end,
      stripeCustomerId: p.stripe_customer_id,
      stripeSubscriptionId: p.stripe_subscription_id,
      suspendedAt: p.suspended_at,
      recentTransactions: (txns ?? []).map((t) => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        description: t.description,
        createdAt: t.created_at,
      })),
      jobCount: jobCount ?? 0,
    }

    return { ok: true, user }
  } catch (error) {
    return toActionError(error)
  }
}

/**
 * Grant, change, or revoke a staff role. Super-admin only. A super-admin cannot
 * demote themselves (prevents locking the last god account out by accident).
 */
export async function setAdminRole(
  userId: string,
  adminRole: AdminRole | null,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const actor = await requireSuperAdmin()
    const trimmedReason = reason.trim()
    if (trimmedReason.length < 3) return { ok: false, error: "Add a short reason for the audit trail." }
    if (adminRole !== null && adminRole !== "support" && adminRole !== "super_admin") {
      return { ok: false, error: "Invalid role." }
    }
    if (userId === actor.userId && adminRole !== "super_admin") {
      return { ok: false, error: "You can't remove your own super-admin access." }
    }

    const admin = createDirectClient()
    const { data: target } = await admin
      .from("profiles")
      .select("email, admin_role")
      .eq("id", userId)
      .maybeSingle()
    if (!target) return { ok: false, error: "User not found." }

    const { error } = await admin.from("profiles").update({ admin_role: adminRole }).eq("id", userId)
    if (error) throw error

    await writeAuditLog(admin, {
      actor,
      action: "role.set",
      targetUserId: userId,
      targetEmail: target.email ?? null,
      reason: trimmedReason,
      metadata: { from: target.admin_role ?? null, to: adminRole },
    })

    revalidatePath("/admin")
    return { ok: true }
  } catch (error) {
    return toActionError(error)
  }
}

/**
 * Suspend or reinstate a user. Super-admin only. Suspension bans the auth user
 * (revoking sessions + blocking sign-in) and flags the profile; reinstating
 * lifts the ban. A super-admin cannot suspend themselves.
 */
export async function setUserSuspended(
  userId: string,
  suspended: boolean,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const actor = await requireSuperAdmin()
    const trimmedReason = reason.trim()
    if (trimmedReason.length < 3) return { ok: false, error: "Add a short reason for the audit trail." }
    if (userId === actor.userId) return { ok: false, error: "You can't suspend your own account." }

    const admin = createDirectClient()
    const { data: target } = await admin.from("profiles").select("email").eq("id", userId).maybeSingle()
    if (!target) return { ok: false, error: "User not found." }

    // Block/allow sign-in at the auth layer. ban_duration "none" lifts a ban.
    const { error: authError } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: suspended ? INDEFINITE_BAN : "none",
    })
    if (authError) {
      console.error("[admin-actions] Ban update failed:", authError)
      return { ok: false, error: "Could not update the account's sign-in status." }
    }

    const { error } = await admin
      .from("profiles")
      .update({
        is_suspended: suspended,
        suspended_at: suspended ? new Date().toISOString() : null,
      })
      .eq("id", userId)
    if (error) throw error

    await writeAuditLog(admin, {
      actor,
      action: suspended ? "user.suspend" : "user.reinstate",
      targetUserId: userId,
      targetEmail: target.email ?? null,
      reason: trimmedReason,
    })

    revalidatePath("/admin")
    return { ok: true }
  } catch (error) {
    return toActionError(error)
  }
}

export interface AuditLogRow {
  id: string
  actorEmail: string | null
  action: string
  targetEmail: string | null
  reason: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

/** Recent admin audit entries, newest first. */
export async function listAuditLog(
  limit = 50,
): Promise<{ ok: boolean; entries?: AuditLogRow[]; error?: string }> {
  try {
    await requireAdmin()
    const admin = createDirectClient()
    const { data, error } = await admin
      .from("admin_audit_log")
      .select("id, actor_email, action, target_email, reason, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(Math.min(200, Math.max(1, limit)))
    if (error) throw error

    const entries: AuditLogRow[] = (data ?? []).map((e) => ({
      id: e.id,
      actorEmail: e.actor_email,
      action: e.action,
      targetEmail: e.target_email,
      reason: e.reason,
      metadata: (e.metadata as Record<string, unknown>) ?? {},
      createdAt: e.created_at,
    }))
    return { ok: true, entries }
  } catch (error) {
    return toActionError(error)
  }
}
