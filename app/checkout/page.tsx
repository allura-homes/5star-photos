import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Header } from "@/components/header"
import { EmbeddedCheckoutPanel } from "@/components/billing/embedded-checkout"
import { PLANS, getTopupPack, isPaidPlanId, isBillingInterval, planPriceCents, formatPrice } from "@/lib/plans"

export const metadata: Metadata = {
  title: "Checkout - 5star.photos",
  robots: { index: false },
}

interface CheckoutPageProps {
  searchParams: Promise<{ plan?: string; interval?: string; pack?: string }>
}

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const { plan, interval, pack } = await searchParams

  let summary: { title: string; detail: string; price: string; cadence: string }
  let target: { kind: "subscription"; plan: string; interval: string } | { kind: "topup"; pack: string }

  if (pack) {
    const packConfig = getTopupPack(pack)
    if (!packConfig) redirect("/pricing")
    summary = {
      title: `${packConfig.credits} credit top-up`,
      detail: "Added to your balance right after payment. Never expires while you are subscribed.",
      price: formatPrice(packConfig.priceCents),
      cadence: "one time",
    }
    target = { kind: "topup", pack: packConfig.id }
  } else if (isPaidPlanId(plan)) {
    const chosenInterval = isBillingInterval(interval) ? interval : "month"
    const config = PLANS[plan]
    summary = {
      title: `${config.name} plan`,
      detail: `${config.monthlyCredits} credits every month. ${config.allModels ? "Every AI model included." : "V1, V2 and V3 models."}`,
      price: formatPrice(planPriceCents(plan, chosenInterval)),
      cadence: chosenInterval === "year" ? "per year" : "per month",
    }
    target = { kind: "subscription", plan, interval: chosenInterval }
  } else {
    redirect("/pricing")
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 pt-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col gap-8">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 self-start text-sm text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to pricing
          </Link>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
            <section aria-label="Payment" className="rounded-3xl bg-white p-2 sm:p-4 min-h-[480px]">
              <EmbeddedCheckoutPanel target={target} />
            </section>

            <aside className="glass-card rounded-3xl p-6 flex flex-col gap-5 lg:sticky lg:top-28">
              <h1 className="text-lg font-semibold text-white">Order summary</h1>
              <div className="flex flex-col gap-1">
                <p className="text-xl font-bold text-white">{summary.title}</p>
                <p className="text-sm text-slate-400 leading-relaxed">{summary.detail}</p>
              </div>
              <div className="flex items-baseline justify-between border-t border-white/10 pt-4">
                <span className="text-sm text-slate-400">Total</span>
                <span className="text-2xl font-bold text-white">
                  {summary.price} <span className="text-sm font-medium text-slate-400">{summary.cadence}</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Secure payment by Stripe. Cancel or change your plan any time from your Account page.
              </p>
            </aside>
          </div>
        </div>
      </main>
    </div>
  )
}
