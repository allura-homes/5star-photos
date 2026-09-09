"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient, clearAuthState } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Phone, ShieldCheck, ArrowLeft } from "lucide-react"

const E164_PATTERN = /^\+[1-9]\d{7,14}$/
const RESEND_COOLDOWN_SECONDS = 30

/** Strips everything but leading "+" and digits so users can type with spaces/dashes/parens. */
function normalizePhone(raw: string): string {
  const trimmed = raw.trim()
  const hasPlus = trimmed.startsWith("+")
  const digits = trimmed.replace(/[^\d]/g, "")
  return hasPlus ? `+${digits}` : digits ? `+${digits}` : ""
}

export function PhoneLoginForm({ redirect }: { redirect: string }) {
  const [step, setStep] = useState<"phone" | "code">("phone")
  const [phone, setPhone] = useState("")
  const [code, setCode] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  const router = useRouter()
  const codeInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  useEffect(() => {
    if (step === "code") codeInputRef.current?.focus()
  }, [step])

  const normalizedPhone = normalizePhone(phone)
  const phoneValid = E164_PATTERN.test(normalizedPhone)

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!phoneValid) {
      setError("Enter your phone number with country code, e.g. +1 555 123 4567")
      return
    }

    setIsLoading(true)
    setError(null)

    let supabase = createClient()
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const expiresAt = session?.expires_at ? session.expires_at * 1000 : 0
      if (session && expiresAt && expiresAt < Date.now()) {
        await supabase.auth.signOut().catch(() => {})
        clearAuthState()
        supabase = createClient()
      }
    } catch {
      clearAuthState()
      supabase = createClient()
    }

    // shouldCreateUser: false — this is a *login* method for a phone number
    // that was already verified from Account settings, not a new-signup path.
    const { error } = await supabase.auth.signInWithOtp({
      phone: normalizedPhone,
      options: { shouldCreateUser: false },
    })

    if (error) {
      const message = /signups?\s*not\s*allowed/i.test(error.message)
        ? "We couldn't find an account with that phone number. Verify a phone number from Account settings first, or sign in with email."
        : error.message
      setError(message)
      setIsLoading(false)
      return
    }

    setIsLoading(false)
    setCooldown(RESEND_COOLDOWN_SECONDS)
    setStep("code")
  }

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (code.trim().length < 6) {
      setError("Enter the 6-digit code we texted you")
      return
    }

    setIsLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.verifyOtp({
      phone: normalizedPhone,
      token: code.trim(),
      type: "sms",
    })

    if (error) {
      setError(error.message)
      setIsLoading(false)
      return
    }

    router.push(redirect)
  }

  const inputClass = "pl-10 bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-500"

  if (step === "code") {
    return (
      <form onSubmit={verifyCode} className="flex flex-col gap-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3" role="alert">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            setStep("phone")
            setCode("")
            setError(null)
          }}
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white self-start transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          Use a different number
        </button>

        <p className="text-sm text-slate-400">
          Enter the 6-digit code we texted to <strong className="text-white">{normalizedPhone}</strong>.
        </p>

        <div className="flex flex-col gap-2">
          <Label htmlFor="otp-code" className="text-slate-300">
            Verification code
          </Label>
          <div className="relative">
            <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden="true" />
            <Input
              ref={codeInputRef}
              id="otp-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className={`${inputClass} tracking-widest`}
              required
            />
          </div>
        </div>

        <Button type="submit" className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Verifying...
            </>
          ) : (
            "Verify & sign in"
          )}
        </Button>

        <button
          type="button"
          onClick={() => sendCode()}
          disabled={cooldown > 0 || isLoading}
          className="text-sm text-amber-400 hover:text-amber-300 disabled:text-slate-500 disabled:cursor-not-allowed transition-colors"
        >
          {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={sendCode} className="flex flex-col gap-4">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3" role="alert">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="phone" className="text-slate-300">
          Phone number
        </Label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden="true" />
          <Input
            id="phone"
            type="tel"
            autoComplete="tel"
            placeholder="+1 555 123 4567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputClass}
            required
          />
        </div>
        <p className="text-xs text-slate-500">
          Must be a phone number you&apos;ve already verified in Account settings.
        </p>
      </div>

      <Button type="submit" className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Sending code...
          </>
        ) : (
          "Text me a code"
        )}
      </Button>
    </form>
  )
}
