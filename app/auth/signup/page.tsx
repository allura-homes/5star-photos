"use client"

import { Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { safeRedirectPath } from "@/lib/safe-redirect"
import { WELCOME_CREDITS, PHOTO_COST, photosFromCredits } from "@/lib/plans"
import { SignupForm } from "@/components/auth/signup-form"
import { Loader2, ArrowLeft, Sparkles } from "lucide-react"

function SignupPageContent() {
  const searchParams = useSearchParams()
  const redirect = safeRedirectPath(searchParams.get("redirect"))

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Back to home
        </Link>

        <div className="glass-card rounded-2xl p-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-white mb-2">Create your account</h1>
            <p className="text-slate-400">Start enhancing your listing photos today</p>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-fuchsia-400/25 bg-fuchsia-500/10 p-4 mb-6">
            <Sparkles className="w-5 h-5 shrink-0 text-fuchsia-300 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-white">{WELCOME_CREDITS} free credits, no card needed</p>
              <p className="text-xs text-slate-300 text-pretty">
                Enough for {photosFromCredits(WELCOME_CREDITS)} finished photos: upload, transform and download in
                full resolution ({PHOTO_COST} credits each).
              </p>
            </div>
          </div>

          <SignupForm redirect={redirect} />
        </div>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
        </div>
      }
    >
      <SignupPageContent />
    </Suspense>
  )
}
