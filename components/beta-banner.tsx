"use client"

import { useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { Sparkles, X } from "lucide-react"
import { TOKENS_ENFORCED } from "@/lib/constants/tokens"

const KEY = "5star:beta-banner-dismissed"

function subscribe() {
  return () => {}
}

/**
 * Slim "free beta" notice. Dismissal is remembered for the browser session so
 * it does not nag on every navigation, and it disappears entirely once token
 * enforcement is switched on.
 */
export function BetaBanner() {
  // Read sessionStorage without a hydration mismatch.
  const dismissedAtLoad = useSyncExternalStore(
    subscribe,
    () => (typeof window !== "undefined" ? window.sessionStorage.getItem(KEY) === "1" : false),
    () => false,
  )
  const [dismissed, setDismissed] = useState(false)

  if (TOKENS_ENFORCED || dismissed || dismissedAtLoad) return null

  return (
    <div
      role="status"
      className="mb-6 flex items-center gap-3 rounded-2xl border border-[#FF3EDB]/30 bg-[#FF3EDB]/10 px-4 py-2.5 text-sm text-white"
    >
      <Sparkles className="w-4 h-4 shrink-0 text-[#FF3EDB]" aria-hidden="true" />
      <p className="flex-1 text-pretty">
        <span className="font-semibold">Free beta.</span> Enhance as many photos as you like while we tune the models.{" "}
        <Link href="/help#tokens" className="underline underline-offset-2 text-[#C9CCDA] hover:text-white">
          How tokens will work
        </Link>
      </p>
      <button
        type="button"
        onClick={() => {
          window.sessionStorage.setItem(KEY, "1")
          setDismissed(true)
        }}
        className="rounded-lg p-1 text-[#C9CCDA] hover:bg-white/10 hover:text-white transition-colors"
        aria-label="Dismiss beta notice"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
