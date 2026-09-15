import "server-only"
import { createClient } from "@/lib/supabase/server"
import { createDirectClient } from "@/lib/supabase/direct"
import type { SupabaseClient } from "@supabase/supabase-js"

export type AdminRole = "support" | "super_admin"

export interface AdminIdentity {
  userId: string
  email: string | null
  adminRole: AdminRole
}

export class AdminAuthError extends Error {
  constructor(
    public readonly code: "UNAUTHENTICATED" | "FORBIDDEN",
    message: string,
  ) {
    super(message)
    this.name = "AdminAuthError"
  }
}

/**
 * Resolves the current session's admin identity, or null when the caller is
 * not signed in or holds no staff role. Reads the session with the cookie-bound
 * server client (verified via getUser), then reads admin_role with the
 * service-role client so RLS on profiles can never mask a staff role.
 */
export async function getAdminIdentity(): Promise<AdminIdentity | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const admin = createDirectClient()
  const { data: profile } = await admin
    .from("profiles")
    .select("admin_role, email, is_suspended")
    .eq("id", user.id)
    .maybeSingle()

  // A suspended staff account loses admin powers immediately.
  if (!profile || profile.is_suspended || !profile.admin_role) return null

  return {
    userId: user.id,
    email: profile.email ?? user.email ?? null,
    adminRole: profile.admin_role as AdminRole,
  }
}

/** Throws AdminAuthError unless the caller holds any staff role. */
export async function requireAdmin(): Promise<AdminIdentity> {
  const identity = await getAdminIdentity()
  if (!identity) {
    throw new AdminAuthError("FORBIDDEN", "Admin access required.")
  }
  return identity
}

/** Throws AdminAuthError unless the caller is a super_admin. */
export async function requireSuperAdmin(): Promise<AdminIdentity> {
  const identity = await requireAdmin()
  if (identity.adminRole !== "super_admin") {
    throw new AdminAuthError("FORBIDDEN", "This action requires super-admin access.")
  }
  return identity
}

/**
 * Writes an admin audit row using the service-role client (the audit table has
 * RLS on with no policies, so only this client can touch it). Never throws:
 * an audit failure must not roll back the action it records, but it is logged.
 */
export async function writeAuditLog(
  admin: SupabaseClient,
  entry: {
    actor: AdminIdentity
    action: string
    targetUserId?: string | null
    targetEmail?: string | null
    reason?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  try {
    await admin.from("admin_audit_log").insert({
      actor_id: entry.actor.userId,
      actor_email: entry.actor.email,
      action: entry.action,
      target_user_id: entry.targetUserId ?? null,
      target_email: entry.targetEmail ?? null,
      reason: entry.reason ?? null,
      metadata: entry.metadata ?? {},
    })
  } catch (error) {
    console.error("[admin-auth] Failed to write audit log:", error)
  }
}
