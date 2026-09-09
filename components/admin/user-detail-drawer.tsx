"use client"

import { useEffect, useState, useCallback } from "react"
import { Loader2, X, ExternalLink, ShieldCheck, ShieldOff, Ban, RotateCcw, CreditCard, UserCog } from "lucide-react"
import {
  getUserDetail,
  setAdminRole,
  setUserSuspended,
  type AdminUserDetail,
} from "@/lib/actions/admin-actions"
import {
  adminRefundPayment,
  adminCancelSubscription,
  adminReactivateSubscription,
} from "@/lib/actions/admin-billing-actions"
import { PLANS } from "@/lib/plans"
import type { AdminRole } from "@/lib/admin-auth"
import { Button } from "@/components/ui/button"
import { AdjustCreditsDialog, type AdjustTarget } from "@/components/admin/adjust-credits-dialog"
import { ReasonDialog, type ReasonDialogConfig } from "@/components/admin/reason-dialog"
import {
  Pill,
  STRIPE_DASHBOARD,
  formatDate,
  formatDateTime,
  subscriptionTone,
} from "@/components/admin/admin-ui"

function roleLabel(role: AdminRole | null): string {
  if (role === "super_admin") return "Super admin"
  if (role === "support") return "Support"
  return "Customer"
}

export function UserDetailDrawer({
  userId,
  isSuperAdmin,
  onClose,
  onChanged,
}: {
  userId: string | null
  isSuperAdmin: boolean
  onClose: () => void
  onChanged: () => void
}) {
  const [detail, setDetail] = useState<AdminUserDetail | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [adjustTarget, setAdjustTarget] = useState<AdjustTarget | null>(null)
  const [reasonConfig, setReasonConfig] = useState<ReasonDialogConfig | null>(null)

  const load = useCallback(async () => {
    if (!userId) return
    setIsLoading(true)
    const result = await getUserDetail(userId)
    setIsLoading(false)
    if (result.ok && result.user) setDetail(result.user)
  }, [userId])

  useEffect(() => {
    if (userId) {
      setDetail(null)
      load()
    }
  }, [userId, load])

  const refresh = () => {
    load()
    onChanged()
  }

  if (!userId) return null

  const hasSubscription = Boolean(detail?.stripeSubscriptionId)
  const pendingCancel = detail?.cancelAtPeriodEnd

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="User details">
      <button
        type="button"
        aria-label="Close details"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md h-full overflow-y-auto bg-slate-950 border-l border-white/10 p-6">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-white truncate">{detail?.displayName || detail?.email || "User"}</h2>
            {detail && <p className="text-sm text-slate-400 truncate">{detail.email}</p>}
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-white/10" aria-label="Close">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {isLoading || !detail ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {detail.isSuspended && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                Suspended {formatDate(detail.suspendedAt)} — sign-in is blocked and sessions are revoked.
              </div>
            )}

            {/* Status row */}
            <div className="flex flex-wrap gap-2">
              <Pill tone={detail.adminRole ? "brand" : "neutral"}>{roleLabel(detail.adminRole)}</Pill>
              <Pill tone={detail.plan !== "free" ? "brand" : "neutral"}>{PLANS[detail.plan]?.name ?? detail.plan}</Pill>
              {detail.subscriptionStatus && (
                <Pill tone={subscriptionTone(detail.subscriptionStatus)}>{detail.subscriptionStatus}</Pill>
              )}
              {pendingCancel && <Pill tone="warning">Cancels at period end</Pill>}
            </div>

            {/* Credits */}
            <section className="rounded-xl border border-white/10 bg-white/5 p-4">
              <h3 className="text-sm font-medium text-slate-300 mb-3">Credits</h3>
              <p className="text-3xl font-semibold text-amber-400">{detail.totalCredits}</p>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-400">
                <div>
                  <span className="block text-slate-500">Plan</span>
                  {detail.planCredits}
                </div>
                <div>
                  <span className="block text-slate-500">Top-up</span>
                  {detail.topupCredits}
                </div>
                <div>
                  <span className="block text-slate-500">Bonus</span>
                  {detail.bonusCredits}
                </div>
              </div>
              <Button
                variant="ghost"
                className="mt-3 h-8 px-3 text-sm text-[#FF3EDB] hover:bg-[#FF3EDB]/10"
                onClick={() =>
                  setAdjustTarget({ id: detail.id, email: detail.email, total: detail.totalCredits })
                }
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Adjust credits
              </Button>
            </section>

            {/* Billing */}
            <section className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
              <h3 className="text-sm font-medium text-slate-300 mb-3">Billing</h3>
              <dl className="flex flex-col gap-2 text-slate-400">
                <div className="flex justify-between gap-4">
                  <dt>Interval</dt>
                  <dd className="text-slate-200">{detail.billingInterval ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Renews / ends</dt>
                  <dd className="text-slate-200">{formatDate(detail.currentPeriodEnd)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Jobs run</dt>
                  <dd className="text-slate-200">{detail.jobCount}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Joined</dt>
                  <dd className="text-slate-200">{formatDate(detail.createdAt)}</dd>
                </div>
              </dl>
              {detail.stripeCustomerId && (
                <a
                  href={`${STRIPE_DASHBOARD}/customers/${detail.stripeCustomerId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-sm text-sky-400 hover:underline"
                >
                  Open in Stripe <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </section>

            {/* Recent ledger */}
            <section className="rounded-xl border border-white/10 bg-white/5 p-4">
              <h3 className="text-sm font-medium text-slate-300 mb-3">Recent credit activity</h3>
              {detail.recentTransactions.length === 0 ? (
                <p className="text-sm text-slate-500">No transactions yet.</p>
              ) : (
                <ul className="flex flex-col gap-2 text-sm">
                  {detail.recentTransactions.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-3">
                      <span className="text-slate-400 truncate">{t.description || t.type}</span>
                      <span className={t.amount < 0 ? "text-emerald-400" : "text-slate-300"}>
                        {t.amount < 0 ? `+${Math.abs(t.amount)}` : `-${t.amount}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Super-admin only controls */}
            {isSuperAdmin && (
              <section className="rounded-xl border border-white/10 bg-white/5 p-4">
                <h3 className="text-sm font-medium text-slate-300 mb-3">Super-admin controls</h3>
                <div className="flex flex-col gap-2">
                  {/* Role management */}
                  {detail.adminRole !== "super_admin" && (
                    <Button
                      variant="ghost"
                      className="justify-start h-9 text-sm text-slate-200 hover:bg-white/10"
                      onClick={() =>
                        setReasonConfig({
                          title: detail.adminRole ? "Change staff role" : "Grant staff access",
                          description: `Set the staff role for ${detail.email}.`,
                          confirmLabel: detail.adminRole === "support" ? "Promote to super admin" : "Make support",
                          onConfirm: (reason) =>
                            setAdminRole(detail.id, detail.adminRole === "support" ? "super_admin" : "support", reason),
                          successMessage: "Role updated.",
                        })
                      }
                    >
                      <UserCog className="w-4 h-4 mr-2" />
                      {detail.adminRole === "support" ? "Promote to super admin" : "Make support staff"}
                    </Button>
                  )}
                  {detail.adminRole && (
                    <Button
                      variant="ghost"
                      className="justify-start h-9 text-sm text-slate-200 hover:bg-white/10"
                      onClick={() =>
                        setReasonConfig({
                          title: "Revoke staff access",
                          description: `Remove all admin access from ${detail.email}.`,
                          confirmLabel: "Revoke access",
                          destructive: true,
                          onConfirm: (reason) => setAdminRole(detail.id, null, reason),
                          successMessage: "Staff access revoked.",
                        })
                      }
                    >
                      <ShieldOff className="w-4 h-4 mr-2" />
                      Revoke staff access
                    </Button>
                  )}

                  {/* Subscription controls */}
                  {hasSubscription && !pendingCancel && (
                    <Button
                      variant="ghost"
                      className="justify-start h-9 text-sm text-slate-200 hover:bg-white/10"
                      onClick={() =>
                        setReasonConfig({
                          title: "Cancel subscription",
                          description: `Cancel ${detail.email}'s subscription at the end of the current period. They keep access until ${formatDate(detail.currentPeriodEnd)}.`,
                          confirmLabel: "Cancel at period end",
                          destructive: true,
                          onConfirm: (reason) => adminCancelSubscription(detail.id, reason, false),
                          successMessage: "Subscription set to cancel at period end.",
                        })
                      }
                    >
                      <Ban className="w-4 h-4 mr-2" />
                      Cancel subscription
                    </Button>
                  )}
                  {hasSubscription && pendingCancel && (
                    <Button
                      variant="ghost"
                      className="justify-start h-9 text-sm text-slate-200 hover:bg-white/10"
                      onClick={() =>
                        setReasonConfig({
                          title: "Reactivate subscription",
                          description: `Undo the pending cancellation for ${detail.email}.`,
                          confirmLabel: "Reactivate",
                          onConfirm: (reason) => adminReactivateSubscription(detail.id, reason),
                          successMessage: "Subscription reactivated.",
                        })
                      }
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Reactivate subscription
                    </Button>
                  )}

                  {/* Refund */}
                  <Button
                    variant="ghost"
                    className="justify-start h-9 text-sm text-slate-200 hover:bg-white/10"
                    onClick={() =>
                      setReasonConfig({
                        title: "Refund a payment",
                        description: `Issue a Stripe refund for ${detail.email}. Find the payment id in the Stripe dashboard.`,
                        confirmLabel: "Issue refund",
                        destructive: true,
                        extraField: {
                          id: "payment-intent",
                          label: "Payment intent or charge id",
                          placeholder: "pi_... or ch_...",
                        },
                        onConfirm: (reason, extra) => adminRefundPayment(detail.id, extra ?? "", reason),
                        successMessage: "Refund issued.",
                      })
                    }
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Refund a payment
                  </Button>

                  {/* Suspend / reinstate */}
                  {detail.isSuspended ? (
                    <Button
                      variant="ghost"
                      className="justify-start h-9 text-sm text-emerald-300 hover:bg-emerald-500/10"
                      onClick={() =>
                        setReasonConfig({
                          title: "Reinstate account",
                          description: `Lift the suspension on ${detail.email} and allow sign-in again.`,
                          confirmLabel: "Reinstate",
                          onConfirm: (reason) => setUserSuspended(detail.id, false, reason),
                          successMessage: "Account reinstated.",
                        })
                      }
                    >
                      <ShieldCheck className="w-4 h-4 mr-2" />
                      Reinstate account
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      className="justify-start h-9 text-sm text-red-300 hover:bg-red-500/10"
                      onClick={() =>
                        setReasonConfig({
                          title: "Suspend account",
                          description: `Block ${detail.email} from signing in and revoke their active sessions.`,
                          confirmLabel: "Suspend account",
                          destructive: true,
                          onConfirm: (reason) => setUserSuspended(detail.id, true, reason),
                          successMessage: "Account suspended.",
                        })
                      }
                    >
                      <Ban className="w-4 h-4 mr-2" />
                      Suspend account
                    </Button>
                  )}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      <AdjustCreditsDialog
        target={adjustTarget}
        onClose={() => setAdjustTarget(null)}
        onAdjusted={() => refresh()}
      />
      <ReasonDialog config={reasonConfig} onClose={() => setReasonConfig(null)} onDone={refresh} />
    </div>
  )
}
