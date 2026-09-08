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
import { adminAdjustCredits } from "@/lib/actions/admin-billing-actions"

export interface AdjustTarget {
  id: string
  email: string
  total: number
}

interface AdjustCreditsDialogProps {
  target: AdjustTarget | null
  onClose: () => void
  onAdjusted: (userId: string, newTotal: number) => void
}

export function AdjustCreditsDialog({ target, onClose, onAdjusted }: AdjustCreditsDialogProps) {
  const [delta, setDelta] = useState("")
  const [reason, setReason] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const parsed = Number.parseInt(delta, 10)
  const valid = Number.isInteger(parsed) && parsed !== 0 && reason.trim().length >= 3
  const preview = target && Number.isInteger(parsed) ? Math.max(0, target.total + parsed) : null

  const reset = () => {
    setDelta("")
    setReason("")
  }

  const handleSubmit = async () => {
    if (!target || !valid) return
    setIsSaving(true)
    const result = await adminAdjustCredits(target.id, parsed, reason)
    setIsSaving(false)

    if (!result.ok) {
      toast.error(result.error ?? "Adjustment failed")
      return
    }
    toast.success(`${parsed > 0 ? "Added" : "Removed"} ${Math.abs(parsed)} credits for ${target.email}`)
    onAdjusted(target.id, result.total ?? 0)
    reset()
    onClose()
  }

  return (
    <Dialog
      open={Boolean(target)}
      onOpenChange={(open) => {
        if (!open) {
          reset()
          onClose()
        }
      }}
    >
      <DialogContent className="bg-slate-900 border-white/10 text-white">
        <DialogHeader>
          <DialogTitle>Adjust credits</DialogTitle>
          <DialogDescription className="text-slate-400">
            {target?.email} currently has <span className="text-white font-medium">{target?.total}</span> credits.
            Positive numbers grant, negative numbers remove.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="adjust-delta" className="text-slate-300">
              Change
            </Label>
            <Input
              id="adjust-delta"
              type="number"
              step={1}
              placeholder="e.g. 50 or -10"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              className="bg-slate-950/60 border-slate-700 text-white"
            />
            {preview !== null && (
              <p className="text-xs text-slate-400">
                New balance: <span className="text-white">{preview}</span>
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="adjust-reason" className="text-slate-300">
              Reason
            </Label>
            <Input
              id="adjust-reason"
              placeholder="Refund for failed batch, support goodwill..."
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
          <Button onClick={handleSubmit} disabled={!valid || isSaving} className="gradient-magenta-violet text-white">
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
