import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Header } from "@/components/header"
import { BeforeAfterSlider } from "@/components/before-after-slider"
import { SignupForm } from "@/components/auth/signup-form"
import {
  WELCOME_CREDITS,
  BETA_BONUS_CREDITS,
  BETA_BONUS_VALUE_CENTS,
  CREDIT_COSTS,
  formatPrice,
  photosFromCredits,
} from "@/lib/plans"
import { Sparkles, Infinity as InfinityIcon, CreditCard, Wand2, Check } from "lucide-react"

const totalCredits = WELCOME_CREDITS + BETA_BONUS_CREDITS
const bonusValue = formatPrice(BETA_BONUS_VALUE_CENTS)

export const metadata: Metadata = {
  title: `Beta access: ${BETA_BONUS_CREDITS} bonus credits free (a ${bonusValue} value) | 5star.photos`,
  description: `Join the 5star.photos beta and get ${BETA_BONUS_CREDITS} bonus credits that never expire on top of ${WELCOME_CREDITS} welcome credits. Transform your listing photos with AI in seconds.`,
  robots: { index: false, follow: false },
}

export default async function BetaPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) redirect("/library")

  return (
    <div>
      <Header />

      <main className="px-4 sm:px-6 pt-28 pb-20">
        <div className="max-w-6xl mx-auto grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <section className="flex flex-col gap-8">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-fuchsia-200">
              <Sparkles className="size-3.5" aria-hidden="true" />
              Private beta
            </span>

            <div className="flex flex-col gap-4">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white text-balance leading-tight">
                Get {BETA_BONUS_CREDITS} bonus credits that never expire
              </h1>
              <p className="text-xl md:text-2xl font-semibold text-amber-400">A {bonusValue} value, free.</p>
              <p className="text-lg text-[#C9CCDA] leading-relaxed text-pretty max-w-xl">
                Beta members start with {totalCredits} credits: {WELCOME_CREDITS} welcome credits plus a{" "}
                {BETA_BONUS_CREDITS}-credit bonus that stays in your account for as long as you have one. Enough to
                take {photosFromCredits(totalCredits)} listing photos from upload to hi-res download, no card needed.
              </p>
            </div>

            <div className="aspect-[3/2] w-full rounded-2xl overflow-hidden">
              <BeforeAfterSlider
                beforeImage="/images/hero/living1-before.jpg"
                afterImage="/images/hero/living1-after.jpg"
                beforeAlt="Living room before enhancement"
                afterAlt="Living room after 5star.photos enhancement"
              />
            </div>

            <ul className="grid gap-4 sm:grid-cols-3">
              <li className="glass-card rounded-2xl p-5 flex flex-col gap-2">
                <InfinityIcon className="size-5 text-fuchsia-300" aria-hidden="true" />
                <p className="font-semibold text-white">Never expires</p>
                <p className="text-sm text-[#C9CCDA] text-pretty">
                  Monthly plan credits reset; your beta bonus does not. Spend it whenever you like.
                </p>
              </li>
              <li className="glass-card rounded-2xl p-5 flex flex-col gap-2">
                <CreditCard className="size-5 text-fuchsia-300" aria-hidden="true" />
                <p className="font-semibold text-white">No card required</p>
                <p className="text-sm text-[#C9CCDA] text-pretty">
                  Create an account with email or Google. Upgrade later only if you want more.
                </p>
              </li>
              <li className="glass-card rounded-2xl p-5 flex flex-col gap-2">
                <Wand2 className="size-5 text-fuchsia-300" aria-hidden="true" />
                <p className="font-semibold text-white">Every model, one click</p>
                <p className="text-sm text-[#C9CCDA] text-pretty">
                  A transform costs {CREDIT_COSTS.transform} credits and runs every model your plan includes at once.
                </p>
              </li>
            </ul>
          </section>

          <section
            aria-labelledby="beta-signup-heading"
            className="glass-card-strong rounded-3xl p-6 sm:p-8 lg:sticky lg:top-28"
          >
            <div className="flex flex-col gap-1 mb-6">
              <h2 id="beta-signup-heading" className="text-2xl font-bold text-white">
                Claim your beta credits
              </h2>
              <p className="text-slate-300 text-sm">Takes about a minute. Credits land the moment you confirm your email.</p>
            </div>

            <dl className="rounded-2xl border border-white/15 bg-white/5 p-4 mb-6 flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between text-slate-300">
                <dt>Welcome credits</dt>
                <dd className="font-medium text-white">{WELCOME_CREDITS}</dd>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <dt className="flex items-center gap-1.5">
                  Beta bonus <span className="text-xs text-fuchsia-200">(never expires)</span>
                </dt>
                <dd className="font-medium text-white">+{BETA_BONUS_CREDITS}</dd>
              </div>
              <div className="flex items-center justify-between border-t border-white/10 pt-2 text-white">
                <dt className="font-semibold">You start with</dt>
                <dd className="font-bold text-amber-400">{totalCredits} credits</dd>
              </div>
            </dl>

            <SignupForm
              redirect="/library"
              source="beta"
              submitLabel={`Get my ${BETA_BONUS_CREDITS} bonus credits`}
              successNote={`Your ${totalCredits} credits, including the ${BETA_BONUS_CREDITS} that never expire, will be waiting when you sign in.`}
            />

            <ul className="mt-6 flex flex-col gap-1.5 text-xs text-slate-400">
              <li className="flex items-center gap-2">
                <Check className="size-3.5 text-emerald-400" aria-hidden="true" />
                Bonus applied automatically to accounts created on this page
              </li>
              <li className="flex items-center gap-2">
                <Check className="size-3.5 text-emerald-400" aria-hidden="true" />
                Full pricing on the{" "}
                <Link href="/pricing" className="underline hover:text-slate-200">
                  plans page
                </Link>
              </li>
            </ul>
          </section>
        </div>
      </main>
    </div>
  )
}
