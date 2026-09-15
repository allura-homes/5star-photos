"use client"

import type React from "react"
import { useState } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Loader2, Lock, Eye, EyeOff } from "lucide-react"

const MIN_PASSWORD_LENGTH = 8

export function ChangePasswordForm() {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const formValid = password.length >= MIN_PASSWORD_LENGTH && password === confirm

  const reset = () => {
    setOpen(false)
    setPassword("")
    setConfirm("")
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formValid) return

    setIsLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      // Supabase requires a recent sign-in for password changes (Secure
      // password change). Point the user at the normal reset flow instead
      // of leaving them stuck on a cryptic GoTrue error.
      setError(
        error.message.toLowerCase().includes("recent")
          ? "For security, please sign out and use \"Forgot password?\" on the sign-in page to set a new password."
          : error.message,
      )
      setIsLoading(false)
      return
    }

    toast.success("Password updated")
    setIsLoading(false)
    reset()
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 self-start px-5 py-2.5 rounded-xl bg-white/10 text-white font-medium hover:bg-white/15 transition-colors"
      >
        <Lock className="w-4 h-4" aria-hidden="true" />
        Change password
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3" role="alert">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="new_password" className="text-sm text-slate-300">
          New password
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden="true" />
          <input
            id="new_password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={MIN_PASSWORD_LENGTH}
            placeholder="••••••••"
            className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50"
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
        <p className="text-xs text-slate-500">At least {MIN_PASSWORD_LENGTH} characters.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirm_password" className="text-sm text-slate-300">
          Confirm new password
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden="true" />
          <input
            id="confirm_password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            className="w-full pl-10 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50"
          />
        </div>
        {confirm.length > 0 && confirm !== password && <p className="text-xs text-red-400">Passwords don&apos;t match</p>}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isLoading || !formValid}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 text-white font-medium hover:bg-white/15 disabled:opacity-60 transition-colors"
        >
          {isLoading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
          Update password
        </button>
        <button type="button" onClick={reset} className="text-sm text-slate-400 hover:text-white transition-colors">
          Cancel
        </button>
      </div>
    </form>
  )
}
