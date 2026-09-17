"use client"

import { useState } from "react"
import { KeyRound, MailCheck, CreditCard, Ban, ShieldCheck, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ReasonDialog, type ReasonDialogConfig } from "@/components/admin/reason-dialog"
import { adminBulkAction, type BulkAction } from "@/lib/actions/admin-account-actions"

interface BulkActionsBarProps {
  selectedIds: string[]
  isSuperAdmin: boolean
  onClear: () => void
  onDone: () => void
}

/**
 * Floating toolbar shown while one or more users are checked in the Users
 * table. Every action collects a required audit reason through ReasonDialog
 * and fans out to adminBulkAction, which reports per-user failures.
 */
export function BulkActionsBar({ selectedIds, isSuperAdmin, onClear, onDone }: BulkActionsBarProps) {
  const [config, setConfig] = useState<ReasonDialogConfig | null>(null)
  const count = selectedIds.length
  const plural = count === 1 ? "user" : "users"

  if (count === 0) return null

  const run = (action: BulkAction, delta?: number) => async (reason: string, extra?: string) => {
    const parsedDelta = action === "adjust_credits" ? Number.parseInt(extra ?? "", 10) : delta
    const result = await adminBulkAction({ action, userIds: selectedIds, reason, delta: parsedDelta })
    if (result.failed.length > 0 && result.succeeded > 0) {
      toast.warning(`${result.succeeded} succeeded, ${result.failed.length} failed.`, {
        description: result.failed[0]?.error,
      })
      onDone()
      onClear()
      return { ok: true }
    }
    return { ok: result.ok, error: result.error ?? result.failed[0]?.error }
  }

  const open = (cfg: ReasonDialogConfig) => setConfig(cfg)

  return (
    <>
      <div
        role="toolbar"
        aria-label="Bulk actions"
        className="sticky bottom-4 z-30 mx-auto mt-4 flex w-fit max-w-full flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 shadow-2xl backdrop-blur-xl"
      >
        <span className="mr-2 text-sm font-medium text-white">
          {count} {plural} selected
        </span>

        <Button
          variant="ghost"
          className="h-8 px-3 text-sm text-slate-200 hover:bg-white/10"
          onClick={() =>
            open({
              title: "Send password reset links",
              description: `Email a password reset link to ${count} ${plural}.`,
              confirmLabel: "Send links",
              onConfirm: run("password_reset"),
              successMessage: `Reset links sent to ${count} ${plural}.`,
            })
          }
        >
          <KeyRound className="mr-2 h-4 w-4" />
          Reset link
        </Button>

        <Button
          variant="ghost"
          className="h-8 px-3 text-sm text-slate-200 hover:bg-white/10"
          onClick={() =>
            open({
              title: "Mark emails as verified",
              description: `Confirm the email address on ${count} ${plural} without them clicking a link.`,
              confirmLabel: "Verify emails",
              onConfirm: run("verify_email"),
              successMessage: `${count} ${plural} marked verified.`,
            })
          }
        >
          <MailCheck className="mr-2 h-4 w-4" />
          Verify email
        </Button>

        <Button
          variant="ghost"
          className="h-8 px-3 text-sm text-[#FF3EDB] hover:bg-[#FF3EDB]/10"
          onClick={() =>
            open({
              title: "Adjust credits",
              description: `Apply the same change to ${count} ${plural}. Positive grants, negative removes.`,
              confirmLabel: "Apply to all",
              extraField: { id: "bulk-delta", label: "Credits (e.g. 50 or -10)", placeholder: "50" },
              onConfirm: run("adjust_credits"),
              successMessage: `Credits adjusted for ${count} ${plural}.`,
            })
          }
        >
          <CreditCard className="mr-2 h-4 w-4" />
          Credits
        </Button>

        {isSuperAdmin && (
          <>
            <Button
              variant="ghost"
              className="h-8 px-3 text-sm text-red-300 hover:bg-red-500/10"
              onClick={() =>
                open({
                  title: "Suspend accounts",
                  description: `Block ${count} ${plural} from signing in and revoke their sessions.`,
                  confirmLabel: "Suspend",
                  destructive: true,
                  onConfirm: run("suspend"),
                  successMessage: `${count} ${plural} suspended.`,
                })
              }
            >
              <Ban className="mr-2 h-4 w-4" />
              Suspend
            </Button>
            <Button
              variant="ghost"
              className="h-8 px-3 text-sm text-emerald-300 hover:bg-emerald-500/10"
              onClick={() =>
                open({
                  title: "Reinstate accounts",
                  description: `Lift the suspension on ${count} ${plural}.`,
                  confirmLabel: "Reinstate",
                  onConfirm: run("reinstate"),
                  successMessage: `${count} ${plural} reinstated.`,
                })
              }
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              Reinstate
            </Button>
          </>
        )}

        <button
          type="button"
          onClick={onClear}
          className="ml-1 rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
          aria-label="Clear selection"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <ReasonDialog
        config={config}
        onClose={() => setConfig(null)}
        onDone={() => {
          onDone()
          onClear()
        }}
      />
    </>
  )
}
