"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { useAuthContext } from "@/lib/contexts/auth-context"
import { User, LogOut, Settings, History, Shield, Coins, ChevronDown, Images } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

export function UserMenu() {
  const { user, profile, isAuthenticated, isAdmin, signOut, isLoading } = useAuthContext()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  if (isLoading) {
    return <div className="w-10 h-10 rounded-full bg-white/10 animate-pulse" />
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center gap-3">
        <Link
          href="/auth/login"
          className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
        >
          Sign in
        </Link>
        <Link
          href="/auth/signup"
          className="px-4 py-2 text-sm font-medium rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 transition-all"
        >
          Get Started
        </Link>
      </div>
    )
  }

  const displayName = profile?.display_name || user?.email?.split("@")[0] || "User"
  const initials = displayName.slice(0, 2).toUpperCase()

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
      >
        {/* Avatar */}
        {profile?.avatar_url ? (
          <img
            src={profile.avatar_url || "/placeholder.svg"}
            alt={displayName}
            className="w-8 h-8 rounded-full object-cover"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <span className="text-xs font-bold text-white">{initials}</span>
          </div>
        )}

        {/* Name and tokens */}
        <div className="hidden sm:flex flex-col items-start">
          <span className="text-sm font-medium text-white">{displayName}</span>
          <div className="flex items-center gap-1 text-xs text-amber-400">
            <Coins className="w-3 h-3" />
            <span>{profile?.tokens || 0} tokens</span>
          </div>
        </div>

        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-64 py-2 rounded-xl bg-slate-800/95 backdrop-blur-xl border border-white/10 shadow-xl z-50"
          >
            {/* User info header */}
            <div className="px-4 py-3 border-b border-white/10">
              <p className="font-medium text-white">{displayName}</p>
              <p className="text-sm text-slate-400 truncate">{user?.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    profile?.role === "admin"
                      ? "bg-red-500/20 text-red-400"
                      : profile?.role === "user"
                        ? "bg-green-500/20 text-green-400"
                        : "bg-slate-500/20 text-slate-400"
                  }`}
                >
                  {profile?.role || "viewer"}
                </span>
                <span className="flex items-center gap-1 text-xs text-amber-400">
                  <Coins className="w-3 h-3" />
                  {profile?.tokens || 0} tokens
                </span>
              </div>
            </div>

            {/* Menu items */}
            <div className="py-2">
              <Link
                href="/library"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-4 py-2 text-sm text-[#FF3EDB] hover:text-[#FF3EDB] hover:bg-[#FF3EDB]/10 transition-colors font-medium"
              >
                <Images className="w-4 h-4" />
                Photo Library
              </Link>
              <Link
                href="/account"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
              >
                <User className="w-4 h-4" />
                Account
              </Link>
              <Link
                href="/history"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
              >
                <History className="w-4 h-4" />
                History
              </Link>
              <Link
                href="/account/settings"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
              >
                <Settings className="w-4 h-4" />
                Settings
              </Link>

              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-white/5 transition-colors"
                >
                  <Shield className="w-4 h-4" />
                  Admin Dashboard
                </Link>
              )}
            </div>

            {/* Sign out */}
            <div className="pt-2 border-t border-white/10">
              <button
                onClick={() => {
                  setIsOpen(false)
                  signOut()
                }}
                className="flex items-center gap-3 w-full px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
