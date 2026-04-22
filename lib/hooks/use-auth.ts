"use client"

import { createClient, clearAuthState } from "@/lib/supabase/client"
import { useEffect, useState, useCallback, useRef, useMemo } from "react"
import type { User } from "@supabase/supabase-js"

// Helper to check if an error is a refresh token error
function isRefreshTokenError(error: unknown): boolean {
  if (!error) return false
  const message = error instanceof Error ? error.message : String(error)
  return message.includes("refresh_token_not_found") || 
         message.includes("Invalid Refresh Token") ||
         message.includes("Refresh Token Not Found")
}

export type UserRole = "viewer" | "user" | "admin"

export interface UserProfile {
  id: string
  email: string
  display_name: string | null
  avatar_url: string | null
  role: UserRole
  tokens: number
  free_previews_used: number
  free_previews_limit: number
  created_at: string
  updated_at: string
}

export interface AuthState {
  user: User | null
  profile: UserProfile | null
  isLoading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
  canUploadFree: boolean
  freePreviewsRemaining: number
}

const AUTH_TIMEOUT = 10000

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    isLoading: true,
    isAuthenticated: false,
    isAdmin: false,
    canUploadFree: true,
    freePreviewsRemaining: 3,
  })

  // Create supabase client once and memoize it
  const supabase = useMemo(() => createClient(), [])
  const fetchingProfileRef = useRef<Promise<UserProfile | null> | null>(null)

  const fetchProfile = useCallback(async (userId: string, retryCount = 0): Promise<UserProfile | null> => {
    // Return existing promise if already fetching (and not a retry)
    if (fetchingProfileRef.current && retryCount === 0) {
      return fetchingProfileRef.current
    }

    const fetchPromise = (async () => {
      try {
        const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle()

        if (error) {
          // Retry on lock errors (up to 3 times)
          if (error.message.includes("Lock") && retryCount < 3) {
            await new Promise((resolve) => setTimeout(resolve, 500 * (retryCount + 1)))
            fetchingProfileRef.current = null
            return fetchProfile(userId, retryCount + 1)
          }
          if (!error.message.includes("Lock")) {
            console.error("[v0] Error fetching profile:", error.message)
          }
          return null
        }

        return profile as UserProfile
      } catch (error) {
        if (error instanceof Error) {
          // Identify transient/retryable errors
          const isTransient = error.message.includes("Lock") || 
            error.message.includes("Failed to fetch") ||
            error.message.includes("NetworkError") ||
            error.message.includes("Too Many R") ||
            error.message.includes("not valid JSON")
          
          if (isTransient && retryCount < 3) {
            // Silent retry - don't log transient errors
            const delay = error.message.includes("Too Many R") ? 2000 : 500 * (retryCount + 1)
            await new Promise((resolve) => setTimeout(resolve, delay))
            fetchingProfileRef.current = null
            return fetchProfile(userId, retryCount + 1)
          }
          // Only log after all retries exhausted and it's not a transient error
          // (transient errors that exhausted retries are expected in poor network conditions)
          if (!isTransient && retryCount >= 3) {
            console.error("[v0] Error fetching profile after retries:", error.message)
          }
        }
        return null
      } finally {
        if (retryCount === 0) {
          fetchingProfileRef.current = null
        }
      }
    })()

    if (retryCount === 0) {
      fetchingProfileRef.current = fetchPromise
    }
    return fetchPromise
  }, [supabase])

  const refreshProfile = useCallback(async () => {
    if (!state.user) return

    const profile = await fetchProfile(state.user.id)
    if (profile) {
      setState((prev) => ({
        ...prev,
        profile,
        isAdmin: profile.role === "admin",
        canUploadFree: profile.free_previews_used < profile.free_previews_limit,
        freePreviewsRemaining: Math.max(0, profile.free_previews_limit - profile.free_previews_used),
      }))
    }
  }, [state.user, fetchProfile])

  const refreshAuth = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }))

    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser()

      // Handle refresh token errors by clearing auth state
      if (error && isRefreshTokenError(error)) {
        console.log("[v0] Invalid refresh token, clearing auth state")
        clearAuthState()
        setState({
          user: null,
          profile: null,
          isLoading: false,
          isAuthenticated: false,
          isAdmin: false,
          canUploadFree: true,
          freePreviewsRemaining: 3,
        })
        return
      }

      if (error && error.message !== "Auth session missing!") {
        console.error("[v0] Error refreshing auth:", error.message)
      }

      if (error || !user) {
        setState({
          user: null,
          profile: null,
          isLoading: false,
          isAuthenticated: false,
          isAdmin: false,
          canUploadFree: true,
          freePreviewsRemaining: 3,
        })
        return
      }

      const profile = await fetchProfile(user.id)
      setState({
        user,
        profile,
        isLoading: false,
        isAuthenticated: true,
        isAdmin: profile?.role === "admin" || false,
        canUploadFree: profile ? profile.free_previews_used < profile.free_previews_limit : true,
        freePreviewsRemaining: profile ? Math.max(0, profile.free_previews_limit - profile.free_previews_used) : 3,
      })
    } catch (error) {
      console.error("[v0] Exception in refreshAuth:", error)
      setState({
        user: null,
        profile: null,
        isLoading: false,
        isAuthenticated: false,
        isAdmin: false,
        canUploadFree: true,
        freePreviewsRemaining: 3,
      })
    }
  }, [supabase, fetchProfile])

  useEffect(() => {
    let isMounted = true
    let debounceTimer: NodeJS.Timeout | null = null
    let lastUserId: string | null = null

    const setUnauthenticated = () => {
      if (!isMounted) return
      setState({
        user: null,
        profile: null,
        isLoading: false,
        isAuthenticated: false,
        isAdmin: false,
        canUploadFree: true,
        freePreviewsRemaining: 3,
      })
    }

    const setAuthenticated = (user: User, profile: UserProfile | null) => {
      if (!isMounted) return
      setState({
        user,
        profile,
        isLoading: false,
        isAuthenticated: true,
        isAdmin: profile?.role === "admin" || false,
        canUploadFree: profile ? profile.free_previews_used < profile.free_previews_limit : true,
        freePreviewsRemaining: profile ? Math.max(0, profile.free_previews_limit - profile.free_previews_used) : 3,
      })
    }

    // Set up auth state listener with debouncing to prevent lock contention
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Clear any pending debounce
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }

      // Debounce auth changes to prevent rapid-fire lock contention
      debounceTimer = setTimeout(async () => {
        if (!isMounted) return
        
        if (session?.user) {
          // Skip if same user (prevents duplicate fetches)
          if (lastUserId === session.user.id && event !== "TOKEN_REFRESHED") {
            return
          }
          lastUserId = session.user.id
          
          // Set authenticated immediately with null profile, then fetch profile
          setAuthenticated(session.user, null)
          
          // Fetch profile separately (non-blocking)
          const profile = await fetchProfile(session.user.id)
          if (isMounted && profile) {
            setState(prev => ({
              ...prev,
              profile,
              isAdmin: profile.role === "admin",
              canUploadFree: profile.free_previews_used < profile.free_previews_limit,
              freePreviewsRemaining: Math.max(0, profile.free_previews_limit - profile.free_previews_used),
            }))
          }
        } else {
          lastUserId = null
          setUnauthenticated()
        }
      }, 100) // 100ms debounce
    })

    return () => {
      isMounted = false
      if (debounceTimer) clearTimeout(debounceTimer)
      subscription.unsubscribe()
    }
  }, [supabase, fetchProfile])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [supabase])

  return {
    ...state,
    signOut,
    refreshProfile,
    refreshAuth,
  }
}
