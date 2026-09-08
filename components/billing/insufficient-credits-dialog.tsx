"use client"

import Link from "next/link"
import { Coins, Sparkles } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { PLANS, TOPUP_PACKS, isSubscribed, type PlanId } from "@/lib/plans"

export interface CreditShortfall {
  required: number
  available: number
  plan: PlanId
  pastDue?: boolean
}

interface InsufficientCreditsDialogProps {
  shortfall: CreditShortfall | null
  onClose: () => void
}

export function InsufficientCreditsDialog({ shortfall, onClose }: InsufficientCreditsDialogProps) {
  const open = shortfall !== null
  const plan = shortfall?.plan ?? "free"
  const subscribed = isSubscribed(plan)
  const nextPlan = plan === "free" ? PLANS.startup : plan === "startup" ? PLANS.pro : plan === "pro" ? PLANS.max : null
  const smallestPack = TOPUP_PACKS[0]

  return (
    <Dialog open={open} onOpenChange={(isOpen: boolean) => !isOpen && onClose()}>
      <DialogContent className="max-w-md bg-[#141830] border-white/10 text-white">
        <DialogHeader>
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#FF3EDB]/15 text-[#FF3EDB]">
            <Coins className="size-6" aria-hidden="true" />
          </div>
          <DialogTitle className="text-center text-xl">
            {shortfall?.pastDue ? "Payment needs attention" : "You're out of credits"}
          </DialogTitle>
          <DialogDescription className="text-center text-slate-400">
            {shortfall?.pastDue ? (
              "Your last payment didn't go through. Update your payment method to keep creating."
            ) : (
              <>
                This needs <span className="font-semibold text-white">{shortfall?.required}</span> credits and you have{" "}
                <span className="font-semibold text-white">{shortfall?.available ?? 0}</span>.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {!shortfall?.pastDue && (
          <div className="flex flex-col gap-3">
            {nextPlan && (
              <Link
                href={`/pricing?highlight=${nextPlan.id}`}
                className="flex items-center justify-between rounded-xl border border-[#FF3EDB]/40 bg-[#FF3EDB]/10 p-4 transition-colors hover:bg-[#FF3EDB]/15"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <Sparkles className="size-4 text-[#FF3EDB]" aria-hidden="true" />
                    {plan === "free" ? `Subscribe to ${nextPlan.name}` : `Upgrade to ${nextPlan.name}`}
                  </span>
                  <span className="text-xs text-slate-400">
                    {nextPlan.monthlyCredits} credits every month
                    {plan === "free" ? "" : " and every model"}
                  </span>
                </div>
                <span className="text-sm font-semibold">${(nextPlan.monthlyPriceCents / 100).toFixed(0)}/mo</span>
              </Link>
            )}

            {subscribed && (
              <Link
                href="/account#credits"
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/10"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold">Buy a credit pack</span>
                  <span className="text-xs text-slate-400">One-off top-up for this project. Never expires while subscribed.</span>
                </div>
                <span className="text-sm text-slate-300">from ${(smallestPack.priceCents / 100).toFixed(0)}</span>
              </Link>
            )}
          </div>
        )}

        <DialogFooter className="sm:justify-center">
          {shortfall?.pastDue ? (
            <Button asChild className="bg-[#FF3EDB] text-white hover:bg-[#FF3EDB]/90">
              <Link href="/account#billing">Update payment method</Link>
            </Button>
          ) : (
            <Button variant="ghost" onClick={onClose} className="text-slate-300 hover:text-white hover:bg-white/10">
              Not now
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
