"use client"

import Link from "next/link"
import { Coins, Lock } from "lucide-react"
import { useAuthContext } from "@/lib/contexts/auth-context"
import { TOPUP_PACKS, formatPrice } from "@/lib/plans"

interface TopupPacksProps {
  /** Compact variant for the Account page. */
  compact?: boolean
}

export function TopupPacks({ compact = false }: TopupPacksProps) {
  const { isAuthenticated, isLoading, profile } = useAuthContext()
  const plan = profile?.plan ?? "free"
  const canBuy = isAuthenticated && plan !== "free" && profile?.subscription_status !== "canceled"
  const pastDue = profile?.subscription_status === "past_due" || profile?.subscription_status === "unpaid"

  return (
    <section aria-labelledby="topups" className="flex flex-col gap-6">
      {!compact && (
        <div className="flex flex-col items-center gap-2 text-center">
          <h2 id="topups" className="text-2xl font-bold text-white">
            Need more this month? Add a top-up.
          </h2>
          <p className="text-slate-400 text-pretty max-w-xl">
            Top-up credits never expire while you are subscribed and are used only after your monthly plan credits run
            out.
          </p>
        </div>
      )}
      {compact && (
        <h2 id="topups" className="text-lg font-semibold text-white">
          Top-up packs
        </h2>
      )}

      <ul className={`grid gap-4 ${compact ? "sm:grid-cols-3" : "sm:grid-cols-3 max-w-3xl mx-auto w-full"}`}>
        {TOPUP_PACKS.map((pack) => {
          const perCredit = pack.priceCents / pack.credits
          return (
            <li
              key={pack.id}
              className={`glass-card rounded-2xl p-5 flex flex-col gap-4 ${canBuy ? "" : "opacity-70"}`}
              aria-disabled={!canBuy}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Coins className="size-5 text-amber-400" aria-hidden="true" />
                  <span className="text-xl font-bold text-white">{pack.credits} credits</span>
                </div>
                {!canBuy && <Lock className="size-4 text-slate-500" aria-hidden="true" />}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-white">{formatPrice(pack.priceCents)}</span>
                <span className="text-xs text-slate-300">{perCredit.toFixed(1)}c per credit</span>
              </div>
              {canBuy && !pastDue ? (
                <Link
                  href={`/checkout?pack=${pack.id}`}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-white/10 text-sm font-semibold text-white hover:bg-white/15 transition-colors"
                >
                  Buy pack
                </Link>
              ) : (
                <span className="inline-flex h-10 items-center justify-center rounded-xl bg-white/5 text-sm text-slate-400 cursor-not-allowed">
                  {pastDue ? "Fix payment first" : "Subscribers only"}
                </span>
              )}
            </li>
          )
        })}
      </ul>

      {!canBuy && !isLoading && (
        <p className="text-center text-sm text-slate-400">
          Top-ups are available on any paid plan.{" "}
          {isAuthenticated ? (
            <Link href="#plans" className="text-white underline underline-offset-4 hover:text-[#FF3EDB]">
              Pick a plan above
            </Link>
          ) : (
            <Link href="/auth/signup" className="text-white underline underline-offset-4 hover:text-[#FF3EDB]">
              Create an account
            </Link>
          )}{" "}
          to unlock them.
        </p>
      )}
    </section>
  )
}
