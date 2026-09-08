"use client"

import { useCallback, useState } from "react"
import Link from "next/link"
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js"
import { loadStripe } from "@stripe/stripe-js"
import { AlertTriangle } from "lucide-react"
import { createSubscriptionCheckout, createTopupCheckout } from "@/lib/actions/billing-actions"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "")

type CheckoutTarget = { kind: "subscription"; plan: string; interval: string } | { kind: "topup"; pack: string }

export function EmbeddedCheckoutPanel({ target }: { target: CheckoutTarget }) {
  const [error, setError] = useState<string | null>(null)

  const fetchClientSecret = useCallback(async () => {
    try {
      const result =
        target.kind === "topup"
          ? await createTopupCheckout(target.pack)
          : await createSubscriptionCheckout(target.plan, target.interval)
      return result.clientSecret
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not start checkout."
      setError(message)
      throw err
    }
  }, [target])

  if (error) {
    return (
      <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-4 p-6 text-center">
        <AlertTriangle className="size-8 text-amber-500" aria-hidden="true" />
        <p className="max-w-sm text-sm text-[#12101E] leading-relaxed">{error}</p>
        <Link
          href="/account"
          className="inline-flex h-10 items-center justify-center rounded-xl bg-[#12101E] px-5 text-sm font-semibold text-white"
        >
          Go to Account
        </Link>
      </div>
    )
  }

  return (
    <EmbeddedCheckoutProvider stripe={stripePromise} options={{ fetchClientSecret }}>
      <EmbeddedCheckout />
    </EmbeddedCheckoutProvider>
  )
}
