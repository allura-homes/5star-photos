"use client"

import { createClient, clearAuthState } from "@/lib/supabase/client"
import { useEffect, useState, useCallback, useRef } from "react"
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
  
  const fetchingProfileRef = useRef<Promise<UserProfile | null> | null>(null)

  const fetchProfile = useCallback(async (userId: string, retryCount = 0): Promise<UserProfile | null> => {
    const supabase = createClient()
    
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

        return profile
      } catch (error) {
        console.error("[v0] Exception fetching profile:", error)
        return null
      } finally {
        fetchingProfileRef.current = null
      }
    })()

    fetchingProfileRef.current = fetchPromise
    return fetchPromise
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!state.user) return
    const profile = await fetchProfile(state.user.id)
    if (profile) {
      setState(prev => ({
        ...prev,
        profile,
        isAdmin: profile.role === "admin",
        canUploadFree: profile.free_previews_used < profile.free_previews_limit,
        freePreviewsRemaining: Math.max(0, profile.free_previews_limit - profile.free_previews_used),
      }))
    }
  }, [state.user, fetchProfile])

  const refreshAuth = useCallback(async () => {
    const supabase = createClient()
    setState((prev) => ({ ...prev, isLoading: true }))

    try {
      const { data: { user }, error } = await supabase.auth.getUser()

      if (error) {
        if (isRefreshTokenError(error)) {
          clearAuthState()
        }
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

      if (user) {
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
      } else {
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
    } catch {
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
  }, [fetchProfile])

  useEffect(() => {
    const supabase = createClient()
    let isMounted = true

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

    // Initial auth check
    const checkAuth = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        
        if (!isMounted) return
        
        if (error && isRefreshTokenError(error)) {
          clearAuthState()
          setUnauthenticated()
          return
        }
        
        if (user) {
          const profile = await fetchProfile(user.id)
          setAuthenticated(user, profile)
        } else {
          setUnauthenticated()
        }
      } catch {
        if (isMounted) setUnauthenticated()
      }
    }
    
    checkAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return
      
      if (event === "SIGNED_OUT" || !session?.user) {
        setUnauthenticated()
        return
      }

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        const profile = await fetchProfile(session.user.id)
        setAuthenticated(session.user, profile)
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [fetchProfile])

  const signOut = useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
  }, [])

  return {
    ...state,
    signOut,
    refreshProfile,
    refreshAuth,
  }
}
