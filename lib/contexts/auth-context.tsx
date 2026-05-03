"use client"

import { createContext, useContext, useEffect, type ReactNode } from "react"
import { useAuth, type AuthState } from "@/lib/hooks/use-auth"
import { clearAuthState } from "@/lib/supabase/client"

interface AuthContextValue extends AuthState {
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  refreshAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()

  // Set up global error handler for unhandled auth errors
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason
      const message = error instanceof Error ? error.message : String(error)
      
      // Catch refresh token errors and handle them gracefully
      if (
        message.includes("refresh_token_not_found") ||
        message.includes("Invalid Refresh Token") ||
        message.includes("Refresh Token Not Found")
      ) {
        event.preventDefault()
        console.log("[v0] Caught refresh token error, clearing session")
        clearAuthState()
        window.location.reload()
        return
      }
      
      // Catch network errors from Supabase auth - these are transient
      if (
        message.includes("Failed to fetch") &&
        (message.includes("@supabase") || event.reason?.stack?.includes("supabase"))
      ) {
        event.preventDefault()
        // Don't reload - just let the app continue in unauthenticated state
        // The user can try again or the auth will recover on next page load
        console.log("[v0] Network error during auth, continuing in unauthenticated state")
        return
      }
    }

    window.addEventListener("unhandledrejection", handleUnhandledRejection)
    return () => window.removeEventListener("unhandledrejection", handleUnhandledRejection)
  }, [])

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}

export function useAuthContext() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuthContext must be used within an AuthProvider")
  }
  return context
}
