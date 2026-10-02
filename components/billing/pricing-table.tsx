"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Check, Loader2, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
  photosFromCredits,
  type BillingInterval,
  type PaidPlanId,
  type PlanId,
} from "@/lib/plans"

function perCreditCents(plan: PaidPlanId, interval: BillingInterval): number {
  const months = interval === "year" ? 12 : 1
  return planPriceCents(plan, interval) / (PLANS[plan].monthlyCredits * months)
}

export function PricingTable() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated, isLoading, isProfileLoading, profile, refreshProfile } = useAuthContext()
  const [interval, setInterval] = useState<BillingInterval>("month")
  const [busyPlan, setBusyPlan] = useState<PaidPlanId | null>(null)
  const [confirmPlan, setConfirmPlan] = useState<PaidPlanId | null>(null)
  const profilePending = isAuthenticated && (isProfileLoading || !profile)

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
      const upgrade = comparePlans(plan, currentPlan) > 0 || (interval === "year" && currentInterval === "month")
      toast.success(
        upgrade
          ? `You're now on ${PLANS[plan].name}. New credits are available right away.`
          : `Your plan changes to ${PLANS[plan].name} at the end of this billing period.`,
      )
      setConfirmPlan(null)
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
                tabIndex={active ? 0 : -1}
                disabled={busyPlan !== null}
                onKeyDown={(event) => {
                  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
                    event.preventDefault()
                    const next = event.key === "Home" ? "month" : event.key === "End" ? "year" : interval === "month" ? "year" : "month"
                    setInterval(next)
                    const radios = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
                    radios?.[next === "month" ? 0 : 1]?.focus()
                  }
                }}
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

      <p className="text-center text-sm leading-relaxed text-muted-foreground">
        All prices in USD. {interval === "year" ? "Annual plans are billed upfront; credits still refill monthly." : "Monthly plans are billed every month. Switch to annual to save two months."}
      </p>

      <ul className="grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <li className="flex flex-col gap-6 rounded-3xl border border-border bg-foreground/5 p-6">
          <div className="flex flex-col gap-1">
            <h3 className="text-xl font-bold text-foreground">Free</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">Your photos. Your proof. No commitment.</p>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-4xl font-bold text-foreground">$0</p>
            <p className="text-sm text-muted-foreground">No credit card required</p>
          </div>
          <div className="flex flex-col gap-1 rounded-2xl bg-foreground/5 p-4">
            <p className="text-2xl font-bold text-foreground">{WELCOME_CREDITS} <span className="text-sm font-medium text-muted-foreground">credits, once</span></p>
            <p className="text-sm text-muted-foreground">About {photosFromCredits(WELCOME_CREDITS)} finished photos</p>
          </div>
          <ul className="flex flex-col gap-3">
            {["Try your own listing photos", "V1–V4 included during beta", "Full-resolution downloads", "Upgrade when you need more"].map((line) => (
              <li key={line} className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground"><Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />{line}</li>
            ))}
          </ul>
          <Button variant="outline" size="lg" asChild className="mt-auto w-full">
            <Link href={isAuthenticated ? (isSubscriber ? "/account" : "/library") : "/auth/signup"}>
              {isAuthenticated ? (isSubscriber ? "Manage plan" : "Open library") : "Start free"}
            </Link>
          </Button>
        </li>
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
              className={`relative flex flex-col gap-6 rounded-3xl p-5 ${
                featured
                  ? "bg-gradient-to-b from-[#FF3EDB]/15 to-[#6A1FBF]/10 border border-[#FF3EDB]/40 glow-magenta"
                  : "glass-card"
              }`}
            >
              {featured && (
                <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full gradient-magenta-violet px-3 py-1 text-xs font-bold text-white">
                  <Sparkles className="size-3" aria-hidden="true" />
                  {planId === "pro" ? "Recommended" : "Selected for you"}
                </span>
              )}

              <div className="flex flex-col gap-1">
                <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                <p className="text-sm text-muted-foreground">{plan.tagline}</p>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-white">{formatPrice(Math.round(perMonth))}</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {interval === "year" ? `${formatPrice(price)} billed yearly` : `${formatPrice(price)} billed monthly`}
                </p>
                {interval === "year" && <p className="text-sm text-primary">Save {formatPrice(plan.monthlyPriceCents * 12 - price)} per year</p>}
              </div>

              <div className="flex flex-col gap-1 rounded-2xl bg-white/5 p-4">
                <p className="flex items-baseline gap-1.5 text-2xl font-bold text-white">
                  {plan.monthlyCredits}
                  <span className="text-sm font-medium text-slate-300">credits / month</span>
                </p>
                <p className="text-sm text-slate-300">
                  About {photosFromCredits(plan.monthlyCredits)} finished photos
                </p>
                <p className="text-sm text-muted-foreground">
                  {perCreditCents(planId, interval).toFixed(1)}¢ per credit
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
                onClick={() => isSubscriber ? setConfirmPlan(planId) : choose(planId)}
                disabled={isLoading || profilePending || busyPlan !== null || isCurrent}
                className={`mt-auto inline-flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                  featured
                    ? "gradient-magenta-violet text-white hover:scale-[1.02]"
                    : "bg-white/10 text-white hover:bg-white/15"
                }`}
              >
                {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                {profilePending ? "Loading your plan…" : ctaLabel(planId)}
              </button>
            </li>
          )
        })}
      </ul>

      <p className="text-center text-sm leading-relaxed text-muted-foreground">
        Photo estimates include one upload, one transform and one hi-res download ({CREDIT_COSTS.upload + CREDIT_COSTS.transform + CREDIT_COSTS.download_hires} credits).
        Additional edits and downloads use more credits. Monthly plan credits do not roll over.
        All plans currently include V1–V4 during beta; Pro and Max also include additional models as they become available.
      </p>

      <Dialog open={confirmPlan !== null} onOpenChange={(open) => { if (!open && !busyPlan) setConfirmPlan(null) }}>
        <DialogContent showCloseButton={!busyPlan}>
          <DialogHeader>
            <DialogTitle>Change your subscription?</DialogTitle>
            <DialogDescription>
              {confirmPlan && `${PLANS[confirmPlan].name} is ${formatPrice(planPriceCents(confirmPlan, interval))} billed ${interval === "year" ? "yearly" : "monthly"}, with ${PLANS[confirmPlan].monthlyCredits} credits each month.`}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Upgrades and switches from monthly to annual may create an immediate prorated charge.
            A downgrade keeps your current credit allowance until your billing period ends.
          </p>
          <DialogFooter>
            <Button variant="outline" disabled={!!busyPlan} onClick={() => setConfirmPlan(null)}>Keep current plan</Button>
            <Button disabled={!!busyPlan} onClick={() => { if (confirmPlan) void choose(confirmPlan) }}>
              {busyPlan ? "Updating…" : "Confirm plan change"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!isAuthenticated && !isLoading && (
        <p className="text-center text-sm text-muted-foreground">
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
