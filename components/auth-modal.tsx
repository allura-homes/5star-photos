"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { X, Mail, Lock, User, Loader2, Sparkles } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  freePreviewsRemaining?: number
}

type AuthMode = "login" | "signup"

export function AuthModal({ isOpen, onClose, onSuccess, freePreviewsRemaining = 3 }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>("signup")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setEmail("")
      setPassword("")
      setDisplayName("")
      setError(null)
    }
  }, [isOpen])

  const waitForProfile = async (userId: string, maxAttempts = 5): Promise<boolean> => {
    for (let i = 0; i < maxAttempts; i++) {
      const { data: profile } = await supabase.from("profiles").select("id").eq("id", userId).single()

      if (profile) {
        return true
      }

      // Wait 500ms before retrying
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    return false
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      let supabaseClient
      try {
        supabaseClient = supabase
      } catch (clientError) {
        console.error("[v0] Supabase client error:", clientError)
        setError("Authentication service is not properly configured. Please contact support.")
        setIsLoading(false)
        return
      }

      if (mode === "signup") {
        const { data, error: signUpError } = await supabaseClient.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: displayName || email.split("@")[0],
              role: "viewer",
            },
          },
        })

        if (signUpError) {
          setError(signUpError.message)
          setIsLoading(false)
          return
        }

        // If we got a session back, user is logged in (no confirmation needed)
        if (data.session && data.user) {
          const profileReady = await waitForProfile(data.user.id, 10)
          if (!profileReady) {
            console.log("Profile still being created, but user is authenticated")
          }

          await new Promise((resolve) => setTimeout(resolve, 500))

          setIsLoading(false)
          onSuccess()
          return
        }

        // If no session, email confirmation is required
        setError("Please check your email to confirm your account")
        setIsLoading(false)
      } else {
        // Login
        const { error: signInError } = await supabaseClient.auth.signInWithPassword({
          email,
          password,
        })

        if (signInError) {
          setError(signInError.message)
          setIsLoading(false)
          return
        }

        await new Promise((resolve) => setTimeout(resolve, 500))

        setIsLoading(false)
        onSuccess()
      }
    } catch (err) {
      console.error("[v0] Auth error:", err)
      setError("An unexpected error occurred")
      setIsLoading(false)
    }
  }

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "unset"
    }
    return () => {
      document.body.style.overflow = "unset"
    }
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="relative w-full max-w-md">
              {/* Liquid Glass Effect Container */}
              <div className="relative overflow-hidden rounded-3xl">
                {/* Animated gradient background */}
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-cyan-500/20" />

                {/* Glass morphism layer */}
                <div className="absolute inset-0 backdrop-blur-xl bg-slate-900/70" />

                {/* Animated orbs for liquid effect */}
                <div className="absolute -top-20 -left-20 w-40 h-40 bg-purple-500/30 rounded-full blur-3xl animate-pulse" />
                <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-pink-500/30 rounded-full blur-3xl animate-pulse delay-1000" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-60 h-60 bg-cyan-500/20 rounded-full blur-3xl animate-pulse delay-500" />

                {/* Content */}
                <div className="relative p-8">
                  {/* Close button */}
                  <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                  >
                    <X className="w-5 h-5 text-white" />
                  </button>

                  {/* Header with sparkles */}
                  <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 mb-4">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span className="text-sm font-medium text-amber-300">
                        {freePreviewsRemaining} free preview{freePreviewsRemaining !== 1 ? "s" : ""} available
                      </span>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">
                      {mode === "signup" ? "Create your account" : "Welcome back"}
                    </h2>
                    <p className="text-slate-400">
                      {mode === "signup" ? "Sign up to enhance your photos" : "Sign in to continue"}
                    </p>
                  </div>

                  {/* Error message */}
                  {error && (
                    <div className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                      <p className="text-red-400 text-sm text-center">{error}</p>
                    </div>
                  )}

                  {/* Email Form */}
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {mode === "signup" && (
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                        <input
                          type="text"
                          placeholder="Display name (optional)"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
                        />
                      </div>
                    )}

                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                      <input
                        type="email"
                        placeholder="Email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
                      />
                    </div>

                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                      <input
                        type="password"
                        placeholder="Password (min 6 characters)"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          {mode === "signup" ? "Creating account..." : "Signing in..."}
                        </>
                      ) : mode === "signup" ? (
                        "Create Account"
                      ) : (
                        "Sign In"
                      )}
                    </button>
                  </form>

                  {/* Toggle mode */}
                  <p className="text-center text-slate-400 text-sm mt-6">
                    {mode === "signup" ? (
                      <>
                        Already have an account?{" "}
                        <button
                          type="button"
                          onClick={() => setMode("login")}
                          className="text-purple-400 hover:text-purple-300 font-medium"
                        >
                          Sign in
                        </button>
                      </>
                    ) : (
                      <>
                        Don&apos;t have an account?{" "}
                        <button
                          type="button"
                          onClick={() => setMode("signup")}
                          className="text-purple-400 hover:text-purple-300 font-medium"
                        >
                          Sign up
                        </button>
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
