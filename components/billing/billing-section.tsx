"use client"

import { useState } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowUpRight, CreditCard, Loader2, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { createPortalSession } from "@/lib/actions/billing-actions"
import type { CreditBalance } from "@/lib/credits"
import { PLANS, nextPlanUp, formatPrice, planPriceCents } from "@/lib/plans"
import { TopupPacks } from "@/components/billing/topup-packs"

export function BillingSection({ balance }: { balance: CreditBalance }) {
  const [portalBusy, setPortalBusy] = useState(false)
  const plan = PLANS[balance.plan]
  const isFree = balance.plan === "free"
  const pastDue = balance.subscriptionStatus === "past_due" || balance.subscriptionStatus === "unpaid"
  const canceling = balance.subscriptionStatus === "canceled" && !isFree
  const upgrade = nextPlanUp(balance.plan)
  const renews = balance.currentPeriodEnd
    ? new Date(balance.currentPeriodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null
  const frozenTopup = isFree && balance.topupCredits > 0
  const total = Math.max(0, balance.total)
  const ratio = plan.monthlyCredits > 0 ? Math.min(1, balance.planCredits / plan.monthlyCredits) : 0

  async function openPortal() {
    setPortalBusy(true)
    try {
      const { url } = await createPortalSession()
      window.location.assign(url)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open billing portal.")
      setPortalBusy(false)
    }
  }

  return (
    <section aria-labelledby="billing" className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h2 id="billing" className="text-lg font-semibold text-white">
          Plan and credits
        </h2>
        {!isFree && (
          <button
            type="button"
            onClick={openPortal}
            disabled={portalBusy}
            className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/15 transition-colors disabled:opacity-60"
          >
            {portalBusy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <CreditCard className="size-4" aria-hidden="true" />}
            Manage billing
          </button>
        )}
      </div>

      {pastDue && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-400" aria-hidden="true" />
          <div className="flex flex-1 flex-col gap-1">
            <p className="font-semibold text-white">Your last payment did not go through</p>
            <p className="text-sm text-slate-300 leading-relaxed">
              Credits are paused until the card on file is updated. Your balance is safe.
            </p>
          </div>
          <button
            type="button"
            onClick={openPortal}
            disabled={portalBusy}
            className="shrink-0 rounded-lg bg-amber-400 px-3 py-1.5 text-sm font-semibold text-[#12101E] hover:bg-amber-300 disabled:opacity-60"
          >
            Update card
          </button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <div className="glass-card rounded-2xl p-6 flex flex-col gap-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <p className="text-sm text-slate-400">Current plan</p>
              <p className="text-2xl font-bold text-white">{plan.name}</p>
              <p className="text-sm text-slate-400">
                {balance.plan === "free"
                  ? "Welcome credits only. Pick a plan to refill every month."
                  : `${formatPrice(planPriceCents(balance.plan, balance.billingInterval ?? "month"))} per ${
                      balance.billingInterval === "year" ? "year" : "month"
                    }${renews ? ` · ${canceling ? "Ends" : "Renews"} ${renews}` : ""}`}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                isFree ? "bg-white/10 text-slate-200" : "bg-[#FF3EDB]/20 text-[#FF3EDB]"
              }`}
            >
              {plan.allModels ? "All models" : "V1 + V2 + V3"}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <p className="text-4xl font-bold text-white">
                {total} <span className="text-base font-medium text-slate-300">credits available</span>
              </p>
            </div>
            {!isFree && (
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10" aria-hidden="true">
                <div className="h-full rounded-full gradient-magenta-violet" style={{ width: `${ratio * 100}%` }} />
              </div>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400">
              <span>
                {balance.planCredits} {isFree ? "welcome" : "plan"} credits
                {!isFree && ` of ${plan.monthlyCredits}`}
              </span>
              {balance.bonusCredits > 0 && <span>{balance.bonusCredits} bonus credits (never expire)</span>}
              {(balance.topupCredits > 0 || !isFree) && (
                <span>
                  {balance.topupCredits} top-up credits
                  {frozenTopup && " (held until you resubscribe)"}
                </span>
              )}
            </div>
          </div>
        </div>

        {upgrade ? (
          <Link
            href={`/pricing?highlight=${upgrade}`}
            className="group relative flex flex-col justify-between gap-4 rounded-2xl border border-[#FF3EDB]/40 bg-gradient-to-br from-[#FF3EDB]/15 to-[#6A1FBF]/10 p-6 hover:border-[#FF3EDB]/70 transition-colors"
          >
            <div className="flex flex-col gap-2">
              <span className="inline-flex w-fit items-center gap-1 rounded-full bg-[#FF3EDB]/20 px-2.5 py-1 text-xs font-semibold text-[#FF3EDB]">
                <Sparkles className="size-3" aria-hidden="true" />
                {isFree ? "Go monthly" : `Upgrade to ${PLANS[upgrade].name}`}
              </span>
              <p className="text-lg font-bold text-white text-balance">
                {PLANS[upgrade].monthlyCredits} credits every month for{" "}
                {formatPrice(PLANS[upgrade].monthlyPriceCents)}
              </p>
              <p className="text-sm text-slate-300 leading-relaxed">{PLANS[upgrade].tagline}.</p>
            </div>
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-white">
              See plans
              <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
            </span>
          </Link>
        ) : (
          <div className="glass-card rounded-2xl p-6 flex flex-col justify-center gap-2">
            <p className="text-lg font-bold text-white">You are on our biggest plan</p>
            <p className="text-sm text-slate-400 leading-relaxed">
              Need even more? Top-up packs below add credits that never expire while you are subscribed.
            </p>
          </div>
        )}
      </div>

      <TopupPacks compact />
    </section>
  )
}
