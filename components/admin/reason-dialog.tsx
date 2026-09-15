"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export interface ReasonDialogConfig {
  title: string
  description: string
  confirmLabel: string
  destructive?: boolean
  extraField?: { id: string; label: string; placeholder: string }
  onConfirm: (reason: string, extra?: string) => Promise<{ ok: boolean; error?: string }>
  successMessage: string
}

/**
 * A single confirm dialog that collects a required audit reason (and an
 * optional extra field, e.g. a Stripe payment id) before running a privileged
 * admin action. Kept generic so suspend / role change / refund / cancel all
 * share one component and one audit-reason contract.
 */
export function ReasonDialog({
  config,
  onClose,
  onDone,
}: {
  config: ReasonDialogConfig | null
  onClose: () => void
  onDone: () => void
}) {
  const [reason, setReason] = useState("")
  const [extra, setExtra] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const needsExtra = Boolean(config?.extraField)
  const valid = reason.trim().length >= 3 && (!needsExtra || extra.trim().length > 0)

  const reset = () => {
    setReason("")
    setExtra("")
  }

  const handleConfirm = async () => {
    if (!config || !valid) return
    setIsSaving(true)
    const result = await config.onConfirm(reason, needsExtra ? extra : undefined)
    setIsSaving(false)
    if (!result.ok) {
      toast.error(result.error ?? "Action failed")
      return
    }
    toast.success(config.successMessage)
    reset()
    onDone()
    onClose()
  }

  return (
    <Dialog
      open={Boolean(config)}
      onOpenChange={(open) => {
        if (!open) {
          reset()
          onClose()
        }
      }}
    >
      <DialogContent className="bg-slate-900 border-white/10 text-white">
        <DialogHeader>
          <DialogTitle>{config?.title}</DialogTitle>
          <DialogDescription className="text-slate-400">{config?.description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {config?.extraField && (
            <div className="flex flex-col gap-2">
              <Label htmlFor={config.extraField.id} className="text-slate-300">
                {config.extraField.label}
              </Label>
              <Input
                id={config.extraField.id}
                placeholder={config.extraField.placeholder}
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                className="bg-slate-950/60 border-slate-700 text-white font-mono text-sm"
              />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="reason-field" className="text-slate-300">
              Reason (recorded in the audit log)
            </Label>
            <Input
              id="reason-field"
              placeholder="Why are you doing this?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="bg-slate-950/60 border-slate-700 text-white"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isSaving} className="text-slate-300">
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!valid || isSaving}
            className={config?.destructive ? "bg-red-600 hover:bg-red-500 text-white" : "gradient-magenta-violet text-white"}
          >
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {config?.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
