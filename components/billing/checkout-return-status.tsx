"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CheckCircle2, Loader2, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { useAuthContext } from "@/lib/contexts/auth-context"
import { getCheckoutSessionStatus, getMyBalance } from "@/lib/actions/billing-actions"
import { PLANS, isPaidPlanId } from "@/lib/plans"

const POLL_INTERVAL_MS = 1500
const POLL_TIMEOUT_MS = 20_000

type Phase = "checking" | "waiting" | "done" | "slow" | "failed"

export function CheckoutReturnStatus({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const { refreshProfile } = useAuthContext()
  const [phase, setPhase] = useState<Phase>("checking")
  const [message, setMessage] = useState<string>("Confirming your payment")
  const startedAt = useRef(Date.now())

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    async function run() {
      let session: Awaited<ReturnType<typeof getCheckoutSessionStatus>>
      try {
        session = await getCheckoutSessionStatus(sessionId)
      } catch (err) {
        if (cancelled) return
        setPhase("failed")
        setMessage(err instanceof Error ? err.message : "We could not verify this checkout.")
        return
      }
      if (cancelled) return

      if (session.status === "open") {
        // User backed out of Stripe without paying.
        router.replace("/pricing")
        return
      }
      if (session.status !== "complete") {
        setPhase("failed")
        setMessage("This checkout did not complete. No charge was made.")
        return
      }

      const isTopup = session.kind === "topup"
      const targetPlan = isPaidPlanId(session.plan) ? session.plan : null
      const expectedCredits = session.credits ?? 0
      setPhase("waiting")
      setMessage(isTopup ? "Adding your credits" : "Activating your plan")

      // Snapshot the current balance so a top-up can be detected as a delta.
      const before = await getMyBalance()
      const baselineTopup = before?.topupCredits ?? 0

      const poll = async () => {
        if (cancelled) return
        const balance = await getMyBalance()
        const landed = isTopup
          ? (balance?.topupCredits ?? 0) >= baselineTopup + expectedCredits
          : balance?.plan === targetPlan && balance.planCredits > 0

        if (landed) {
          await refreshProfile()
          setPhase("done")
          setMessage(
            isTopup
              ? `${expectedCredits} credits added to your balance.`
              : `Welcome to ${targetPlan ? PLANS[targetPlan].name : "your new plan"}. ${expectedCredits} credits are ready.`,
          )
          toast.success(isTopup ? "Credits added" : "Plan activated")
          timer = setTimeout(() => router.replace("/library"), 1800)
          return
        }

        if (Date.now() - startedAt.current > POLL_TIMEOUT_MS) {
          setPhase("slow")
          setMessage("Payment received. Your credits are on the way and will appear in a minute.")
          return
        }
        timer = setTimeout(poll, POLL_INTERVAL_MS)
      }
      poll()
    }

    run()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [sessionId, router, refreshProfile])

  const busy = phase === "checking" || phase === "waiting"

  return (
    <section
      aria-live="polite"
      className="glass-card w-full max-w-md rounded-3xl p-8 flex flex-col items-center gap-5 text-center"
    >
      {busy && <Loader2 className="size-10 animate-spin text-[#FF3EDB]" aria-hidden="true" />}
      {phase === "done" && <CheckCircle2 className="size-10 text-emerald-400" aria-hidden="true" />}
      {(phase === "slow" || phase === "failed") && (
        <AlertTriangle className="size-10 text-amber-400" aria-hidden="true" />
      )}

      <h1 className="text-xl font-bold text-white text-balance">
        {phase === "done" ? "All set" : phase === "failed" ? "Something went wrong" : phase === "slow" ? "Almost there" : "One moment"}
      </h1>
      <p className="text-sm text-slate-400 leading-relaxed text-pretty">{message}</p>

      {!busy && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/library"
            className="inline-flex h-11 items-center justify-center rounded-xl gradient-magenta-violet px-5 text-sm font-semibold text-white"
          >
            Go to Library
          </Link>
          <Link
            href="/account"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-white/10 px-5 text-sm font-semibold text-white hover:bg-white/15"
          >
            View billing
          </Link>
        </div>
      )}
    </section>
  )
}
