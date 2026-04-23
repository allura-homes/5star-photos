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

  // Set up global error handler for unhandled auth errors (like refresh token failures)
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
        event.preventDefault() // Prevent the error from showing in console
        console.log("[v0] Caught refresh token error, clearing session")
        clearAuthState()
        // Reload to get a fresh state
        window.location.reload()
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
