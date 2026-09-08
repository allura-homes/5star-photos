"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Check, Loader2, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { useAuthContext } from "@/lib/contexts/auth-context"
import { changePlan } from "@/lib/actions/billing-actions"
import {
  PLANS,
  PAID_PLAN_IDS,
  CREDIT_COSTS,
  WELCOME_CREDITS,
  planPriceCents,
  formatPrice,
  comparePlans,
  isPaidPlanId,
  type BillingInterval,
  type PaidPlanId,
  type PlanId,
} from "@/lib/plans"

const PHOTO_COST = CREDIT_COSTS.upload + CREDIT_COSTS.transform + CREDIT_COSTS.download_hires

function photosFromCredits(credits: number): number {
  return Math.floor(credits / PHOTO_COST)
}

function perCreditCents(plan: PaidPlanId, interval: BillingInterval): number {
  const months = interval === "year" ? 12 : 1
  return planPriceCents(plan, interval) / (PLANS[plan].monthlyCredits * months)
}

export function PricingTable() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated, isLoading, profile, refreshProfile } = useAuthContext()
  const [interval, setInterval] = useState<BillingInterval>("month")
  const [busyPlan, setBusyPlan] = useState<PaidPlanId | null>(null)

  const highlightParam = searchParams.get("highlight")
  const highlighted: PaidPlanId = isPaidPlanId(highlightParam) ? highlightParam : "pro"
  const currentPlan: PlanId = profile?.plan ?? "free"
  const currentInterval = profile?.billing_interval ?? null
  const isSubscriber = currentPlan !== "free" && profile?.subscription_status !== "canceled"

  async function choose(plan: PaidPlanId) {
    if (!isAuthenticated) {
      router.push(`/auth/signup?redirect=${encodeURIComponent(`/checkout?plan=${plan}&interval=${interval}`)}`)
      return
    }
    if (!isSubscriber) {
      router.push(`/checkout?plan=${plan}&interval=${interval}`)
      return
    }
    setBusyPlan(plan)
    try {
      await changePlan(plan, interval)
      await refreshProfile()
      const upgrade = comparePlans(plan, currentPlan) > 0
      toast.success(
        upgrade
          ? `You're now on ${PLANS[plan].name}. New credits are available right away.`
          : `Your plan changes to ${PLANS[plan].name} at the end of this billing period.`,
      )
      router.push("/account")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change your plan.")
    } finally {
      setBusyPlan(null)
    }
  }

  function ctaLabel(plan: PaidPlanId): string {
    if (!isAuthenticated) return "Start free, then upgrade"
    if (!isSubscriber) return `Get ${PLANS[plan].name}`
    if (plan === currentPlan && interval === currentInterval) return "Current plan"
    if (plan === currentPlan) return interval === "year" ? "Switch to annual" : "Switch to monthly"
    return comparePlans(plan, currentPlan) > 0 ? `Upgrade to ${PLANS[plan].name}` : `Downgrade to ${PLANS[plan].name}`
  }

  return (
    <section aria-labelledby="plans" className="flex flex-col gap-8">
      <div className="flex flex-col items-center gap-4">
        <h2 id="plans" className="sr-only">
          Plans
        </h2>
        <div
          role="radiogroup"
          aria-label="Billing interval"
          className="inline-flex items-center rounded-full border border-white/10 bg-white/5 p-1"
        >
          {(["month", "year"] as BillingInterval[]).map((value) => {
            const active = interval === value
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setInterval(value)}
                className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
                  active ? "bg-white text-[#12101E]" : "text-slate-300 hover:text-white"
                }`}
              >
                {value === "month" ? "Monthly" : "Annual"}
                {value === "year" && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      active ? "bg-[#FF3EDB] text-white" : "bg-[#FF3EDB]/20 text-[#FF3EDB]"
                    }`}
                  >
                    2 months free
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <ul className="grid gap-5 md:grid-cols-3 items-stretch">
        {PAID_PLAN_IDS.map((planId) => {
          const plan = PLANS[planId]
          const featured = planId === highlighted
          const price = planPriceCents(planId, interval)
          const perMonth = interval === "year" ? price / 12 : price
          const isCurrent = isSubscriber && planId === currentPlan && interval === currentInterval
          const busy = busyPlan === planId

          return (
            <li
              key={planId}
              className={`relative flex flex-col gap-6 rounded-3xl p-6 sm:p-7 ${
                featured
                  ? "bg-gradient-to-b from-[#FF3EDB]/15 to-[#6A1FBF]/10 border border-[#FF3EDB]/40 glow-magenta"
                  : "glass-card"
              }`}
            >
              {featured && (
                <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full gradient-magenta-violet px-3 py-1 text-xs font-bold text-white">
                  <Sparkles className="size-3" aria-hidden="true" />
                  Most popular
                </span>
              )}

              <div className="flex flex-col gap-1">
                <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                <p className="text-sm text-slate-400">{plan.tagline}</p>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-white">{formatPrice(Math.round(perMonth))}</span>
                  <span className="text-slate-400">/month</span>
                </div>
                <p className="text-xs text-slate-300">
                  {interval === "year"
                    ? `${formatPrice(price)} billed yearly`
                    : `or ${formatPrice(Math.round(planPriceCents(planId, "year") / 12))}/month billed yearly`}
                </p>
              </div>

              <div className="flex flex-col gap-1 rounded-2xl bg-white/5 p-4">
                <p className="flex items-baseline gap-1.5 text-2xl font-bold text-white">
                  {plan.monthlyCredits}
                  <span className="text-sm font-medium text-slate-300">credits / month</span>
                </p>
                <p className="text-sm text-slate-300">
                  About {photosFromCredits(plan.monthlyCredits)} finished photos ·{" "}
                  {perCreditCents(planId, interval).toFixed(1)}c per credit
                </p>
              </div>

              <ul className="flex flex-col gap-2.5">
                {plan.highlights.map((line) => (
                  <li key={line} className="flex items-start gap-2 text-sm text-slate-200">
                    <Check className="mt-0.5 size-4 shrink-0 text-[#FF3EDB]" aria-hidden="true" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => choose(planId)}
                disabled={isLoading || busy || isCurrent}
                className={`mt-auto inline-flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                  featured
                    ? "gradient-magenta-violet text-white hover:scale-[1.02]"
                    : "bg-white/10 text-white hover:bg-white/15"
                }`}
              >
                {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                {ctaLabel(planId)}
              </button>
            </li>
          )
        })}
      </ul>

      {!isAuthenticated && !isLoading && (
        <p className="text-center text-sm text-slate-400">
          No card needed to start.{" "}
          <Link href="/auth/signup" className="text-white underline underline-offset-4 hover:text-[#FF3EDB]">
            Create a free account
          </Link>{" "}
          and get {WELCOME_CREDITS} credits today.
        </p>
      )}
    </section>
  )
}
