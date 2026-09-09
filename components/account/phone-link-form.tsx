"use client"

import type React from "react"
import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Loader2, Smartphone, ShieldCheck, CheckCircle2 } from "lucide-react"

const E164_PATTERN = /^\+[1-9]\d{7,14}$/

function normalizePhone(raw: string): string {
  const trimmed = raw.trim()
  const hasPlus = trimmed.startsWith("+")
  const digits = trimmed.replace(/[^\d]/g, "")
  return hasPlus ? `+${digits}` : digits ? `+${digits}` : ""
}

interface PhoneLinkFormProps {
  initialPhone: string | null
  initialVerified: boolean
}

export function PhoneLinkForm({ initialPhone, initialVerified }: PhoneLinkFormProps) {
  const [linkedPhone, setLinkedPhone] = useState(initialPhone)
  const [verified, setVerified] = useState(initialVerified)
  const [step, setStep] = useState<"idle" | "code">("idle")
  const [phone, setPhone] = useState("")
  const [code, setCode] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const router = useRouter()
  const codeRef = useRef<HTMLInputElement>(null)

  const normalizedPhone = normalizePhone(phone)
  const phoneValid = E164_PATTERN.test(normalizedPhone)

  const requestVerification = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phoneValid) {
      setError("Enter your phone number with country code, e.g. +1 555 123 4567")
      return
    }

    setIsLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ phone: normalizedPhone })

    if (error) {
      setError(error.message)
      setIsLoading(false)
      return
    }

    setIsLoading(false)
    setStep("code")
    setTimeout(() => codeRef.current?.focus(), 0)
  }

  const confirmVerification = async (e: React.FormEvent) => {
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
      type: "phone_change",
    })

    if (error) {
      setError(error.message)
      setIsLoading(false)
      return
    }

    setLinkedPhone(normalizedPhone)
    setVerified(true)
    setStep("idle")
    setPhone("")
    setCode("")
    setIsLoading(false)
    toast.success("Phone number verified — you can now sign in with a text code")
    router.refresh()
  }

  if (linkedPhone && verified && step === "idle") {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" aria-hidden="true" />
          <span>
            <strong className="text-white">{linkedPhone}</strong> verified for text sign-in
          </span>
        </div>
        <ReplaceNumberTrigger onStart={() => setStep("idle")} setPhoneState={setPhone} clearLinked={() => {
          setLinkedPhone(null)
          setVerified(false)
        }} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3" role="alert">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {step === "code" ? (
        <form onSubmit={confirmVerification} className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex flex-col gap-1.5 flex-1">
            <label htmlFor="otp" className="text-sm text-slate-300">
              Code sent to {normalizedPhone}
            </label>
            <div className="relative">
              <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden="true" />
              <input
                ref={codeRef}
                id="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50 tracking-widest"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 text-white font-medium hover:bg-white/15 disabled:opacity-60 transition-colors"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            Verify
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("idle")
              setCode("")
              setError(null)
            }}
            className="text-sm text-slate-400 hover:text-white transition-colors sm:mb-2.5"
          >
            Cancel
          </button>
        </form>
      ) : (
        <form onSubmit={requestVerification} className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex flex-col gap-1.5 flex-1">
            <label htmlFor="phone" className="text-sm text-slate-300">
              {linkedPhone ? "Replace phone number" : "Phone number"}
            </label>
            <div className="relative">
              <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden="true" />
              <input
                id="phone"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555 123 4567"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 text-white font-medium hover:bg-white/15 disabled:opacity-60 transition-colors"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            Send code
          </button>
        </form>
      )}

      <p className="text-xs text-slate-500 text-pretty">
        Once verified, use the Phone tab on the sign-in page to log in with a text code instead of a password.
      </p>
    </div>
  )
}

/** Small affordance to let a user with an already-verified number start over. */
function ReplaceNumberTrigger({
  onStart,
  setPhoneState,
  clearLinked,
}: {
  onStart: () => void
  setPhoneState: (v: string) => void
  clearLinked: () => void
}) {
  return (
    <button
      type="button"
      onClick={() => {
        setPhoneState("")
        clearLinked()
        onStart()
      }}
      className="text-sm text-fuchsia-300 hover:text-fuchsia-200 transition-colors"
    >
      Change number
    </button>
  )
}
