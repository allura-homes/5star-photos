import type { Metadata } from "next"
import { Suspense } from "react"
import { Header } from "@/components/header"
import { PricingTable } from "@/components/billing/pricing-table"
import { TopupPacks } from "@/components/billing/topup-packs"
import { CreditCostTable } from "@/components/billing/credit-cost-table"
import { PLANS, WELCOME_CREDITS } from "@/lib/plans"

export const metadata: Metadata = {
  title: "Pricing - 5star.photos",
  description: `Simple credit-based pricing for AI real estate photo enhancement. Start free with ${WELCOME_CREDITS} credits, then pick a plan from ${PLANS.startup.monthlyPriceCents / 100}/month.`,
}

const FAQ = [
  {
    q: "What is a credit?",
    a: "A credit is the unit every action costs. A finished photo (upload, transform, hi-res download) is 14 credits. Your plan refills credits every month; unused plan credits do not roll over.",
  },
  {
    q: "What happens to top-up credits?",
    a: "Top-up credits never expire while you are subscribed and are only spent after your monthly plan credits run out. If you cancel, they are held and become usable again the moment you resubscribe.",
  },
  {
    q: "Can I change plans later?",
    a: "Yes. Upgrades apply immediately and are prorated. Downgrades take effect at the end of your current billing period so you keep everything you paid for.",
  },
  {
    q: "Which AI models do I get?",
    a: "Every plan runs V1 and V2, our two approved models, on each transform. Pro and Max also run every additional model we have enabled, so you see more candidates side by side and pick the best one.",
  },
  {
    q: "Is there a refund policy?",
    a: "Credits are non-refundable once granted, but a transform that produces no result is refunded automatically. If something goes wrong, contact support and we will make it right.",
  },
]

export default function PricingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 pt-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 flex flex-col gap-16">
          <header className="flex flex-col items-center gap-4 text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-[#FF3EDB]">Pricing</p>
            <h1 className="text-4xl sm:text-5xl font-bold text-white text-balance max-w-3xl">
              Listing photos that stop the scroll, priced per photo
            </h1>
            <p className="text-lg text-slate-400 text-pretty max-w-2xl">
              Every new account starts with {WELCOME_CREDITS} free credits, enough to finish three real photos. When you
              are ready, pick the plan that matches how many homes you list.
            </p>
          </header>

          <Suspense fallback={<div className="min-h-[520px]" aria-hidden="true" />}>
            <PricingTable />
          </Suspense>

          <TopupPacks />

          <CreditCostTable />

          <section aria-labelledby="pricing-faq" className="flex flex-col gap-6 max-w-3xl mx-auto w-full">
            <h2 id="pricing-faq" className="text-2xl font-bold text-white text-center">
              Questions
            </h2>
            <dl className="flex flex-col gap-3">
              {FAQ.map((item) => (
                <div key={item.q} className="glass-card rounded-2xl p-5 flex flex-col gap-2">
                  <dt className="font-semibold text-white">{item.q}</dt>
                  <dd className="text-sm text-slate-400 leading-relaxed">{item.a}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </main>
    </div>
  )
}
