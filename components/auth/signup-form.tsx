"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { createClient, clearAuthState } from "@/lib/supabase/client"
import { WELCOME_CREDITS } from "@/lib/plans"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Mail, Lock, User, Eye, EyeOff, Check } from "lucide-react"

const MIN_PASSWORD_LENGTH = 8
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function passwordStrength(password: string): { score: 0 | 1 | 2 | 3; label: string; tone: string } {
  if (!password) return { score: 0, label: "", tone: "" }
  let points = 0
  if (password.length >= MIN_PASSWORD_LENGTH) points++
  if (password.length >= 12) points++
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) points++
  if (/\d/.test(password)) points++
  if (/[^A-Za-z0-9]/.test(password)) points++
  if (points <= 1) return { score: 1, label: "Weak", tone: "bg-red-400" }
  if (points <= 3) return { score: 2, label: "Good", tone: "bg-amber-400" }
  return { score: 3, label: "Strong", tone: "bg-emerald-400" }
}

export interface SignupFormProps {
  /** Sanitized same-origin path to land on after confirmation. */
  redirect: string
  /** Recorded on the profile (e.g. "beta") so the DB trigger can grant campaign bonuses. */
  source?: string
  /** Extra copy for the confirmation screen, e.g. what bonus is waiting. */
  successNote?: string
  submitLabel?: string
}

export function SignupForm({ redirect, source, successNote, submitLabel = "Create account" }: SignupFormProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean; confirm?: boolean }>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const trimmedEmail = email.trim().toLowerCase()
  const emailError = touched.email && !EMAIL_PATTERN.test(trimmedEmail) ? "Enter a valid email address" : null
  const passwordError =
    touched.password && password.length < MIN_PASSWORD_LENGTH
      ? `Use at least ${MIN_PASSWORD_LENGTH} characters`
      : null
  const confirmError = touched.confirm && confirm !== password ? "Passwords don't match" : null
  const strength = passwordStrength(password)
  const formValid =
    EMAIL_PATTERN.test(trimmedEmail) && password.length >= MIN_PASSWORD_LENGTH && confirm === password

  const callbackUrl = () => {
    if (process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL) return process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL
    const params = new URLSearchParams({ next: redirect })
    if (source) params.set("source", source)
    return `${window.location.origin}/auth/callback?${params.toString()}`
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched({ email: true, password: true, confirm: true })
    if (!formValid) return

    setIsLoading(true)
    setError(null)

    // Discard any stale/expired session left in storage before signing up,
    // otherwise GoTrue can hang trying to auto-refresh a dead token.
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

    const { error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        emailRedirectTo: callbackUrl(),
        data: {
          display_name: displayName.trim() || trimmedEmail.split("@")[0],
          role: "viewer",
          ...(source ? { signup_source: source } : {}),
        },
      },
    })

    if (error) {
      setError(error.message)
      setIsLoading(false)
      return
    }

    setSuccess(true)
    setIsLoading(false)
  }

  const handleGoogleSignup = async () => {
    setIsLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl() },
    })

    if (error) {
      setError(error.message)
      setIsLoading(false)
    }
  }

  const inputClass = "pl-10 bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-500"
  const invalidClass = "border-red-400/70 focus-visible:ring-red-400/40"

  if (success) {
    return (
      <div className="text-center flex flex-col items-center gap-4">
        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
          <Mail className="w-8 h-8 text-green-400" aria-hidden="true" />
        </div>
        <h2 className="text-2xl font-bold text-white">Check your email</h2>
        <p className="text-slate-400 text-pretty">
          We&apos;ve sent a confirmation link to <strong className="text-white">{trimmedEmail}</strong>. Click it to
          activate your account.
        </p>
        <p className="text-slate-400 text-pretty">
          {successNote ?? `Your ${WELCOME_CREDITS} welcome credits will be waiting when you sign in.`}
        </p>
        <Button asChild variant="outline" className="w-full bg-transparent">
          <Link href="/">Go Home</Link>
        </Button>
      </div>
    )
  }

  return (
    <>
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-6" role="alert">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSignup} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-2">
          <Label htmlFor="displayName" className="text-slate-300">
            Display name <span className="text-slate-500">(optional)</span>
          </Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden="true" />
            <Input
              id="displayName"
              type="text"
              autoComplete="name"
              placeholder="Your name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="email" className="text-slate-300">
            Email
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              aria-invalid={Boolean(emailError)}
              aria-describedby={emailError ? "email-error" : undefined}
              className={`${inputClass} ${emailError ? invalidClass : ""}`}
              required
            />
          </div>
          {emailError && (
            <p id="email-error" className="text-xs text-red-400">
              {emailError}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="password" className="text-slate-300">
            Password
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden="true" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, password: true }))}
              aria-invalid={Boolean(passwordError)}
              aria-describedby="password-hint"
              className={`${inputClass} pr-10 ${passwordError ? invalidClass : ""}`}
              minLength={MIN_PASSWORD_LENGTH}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <div className="flex items-center gap-2" aria-hidden="true">
            {[1, 2, 3].map((step) => (
              <span
                key={step}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  strength.score >= step ? strength.tone : "bg-white/10"
                }`}
              />
            ))}
          </div>
          <p id="password-hint" className={`text-xs ${passwordError ? "text-red-400" : "text-slate-500"}`}>
            {passwordError ??
              (strength.label
                ? `${strength.label} password`
                : `At least ${MIN_PASSWORD_LENGTH} characters. Mixing letters, numbers and symbols makes it stronger.`)}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm" className="text-slate-300">
            Confirm password
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden="true" />
            <Input
              id="confirm"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, confirm: true }))}
              aria-invalid={Boolean(confirmError)}
              aria-describedby={confirmError ? "confirm-error" : undefined}
              className={`${inputClass} pr-10 ${confirmError ? invalidClass : ""}`}
              required
            />
            {confirm && confirm === password && (
              <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" aria-hidden="true" />
            )}
          </div>
          {confirmError && (
            <p id="confirm-error" className="text-xs text-red-400">
              {confirmError}
            </p>
          )}
        </div>

        <Button type="submit" className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating account...
            </>
          ) : (
            submitLabel
          )}
        </Button>
      </form>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-700" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-slate-800/50 text-slate-500">or continue with</span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full border-slate-700 text-slate-300 hover:bg-slate-700/50 bg-transparent"
        onClick={handleGoogleSignup}
        disabled={isLoading}
      >
        <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="currentColor"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="currentColor"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="currentColor"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        Continue with Google
      </Button>

      <p className="text-center text-slate-400 text-sm mt-6">
        Already have an account?{" "}
        <Link
          href={`/auth/login${redirect !== "/library" ? `?redirect=${encodeURIComponent(redirect)}` : ""}`}
          className="text-amber-400 hover:text-amber-300"
        >
          Sign in
        </Link>
      </p>

      <p className="text-center text-slate-500 text-xs mt-4 text-pretty">
        By signing up, you agree to our{" "}
        <Link href="/terms" className="underline hover:text-slate-300">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline hover:text-slate-300">
          Privacy Policy
        </Link>
        .
      </p>
    </>
  )
}
