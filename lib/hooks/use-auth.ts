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

// Race a promise against a timeout. Used to guard Supabase auth/DB calls that
// can hang indefinitely inside the sandboxed v0 preview iframe (the auth token
// auto-refresh and PostgREST queries both stall on the Web Locks API there).
// Returns `fallback` if the promise doesn't settle within `ms`.
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ])
}

// A session is considered expired (or about to expire) when its expires_at is
// at or before now (with a small skew buffer). getSession() auto-refreshes an
// expired access token via the network BEFORE returning, and that refresh is
// what hangs after a long period of inactivity - so we detect this and bail to
// a clean unauthenticated state instead of waiting on the stuck refresh.
function isSessionExpired(session: { expires_at?: number } | null | undefined): boolean {
  if (!session?.expires_at) return false
  const expiresAtMs = session.expires_at * 1000
  return expiresAtMs <= Date.now() + 5000
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
  const authResolvedRef = useRef(false)

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
      // Race getSession against a timeout: it auto-refreshes an expired token
      // over the network, which can hang in the preview iframe. See checkAuth.
      const { data: { session }, error } = await withTimeout(
        supabase.auth.getSession(),
        4000,
        { data: { session: null }, error: null } as Awaited<ReturnType<typeof supabase.auth.getSession>>,
      )

      if (error || (session && isSessionExpired(session))) {
        if (error ? isRefreshTokenError(error) : true) {
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

      const user = session?.user ?? null

      if (user) {
        const profile = await withTimeout(fetchProfile(user.id), 4000, null)
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
    // Only run on client side
    if (typeof window === "undefined") {
      setState(prev => ({ ...prev, isLoading: false }))
      return
    }
    
    const supabase = createClient()
    let isMounted = true

    const setUnauthenticated = () => {
      if (!isMounted) return
      authResolvedRef.current = true
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
      authResolvedRef.current = true
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
        // getSession() reads from local storage but will auto-refresh an
        // EXPIRED access token over the network before returning. That refresh
        // hangs inside the preview iframe after a long period of inactivity, so
        // we race it against a short timeout. If it doesn't settle, we treat the
        // user as unauthenticated rather than spinning forever.
        const { data: { session }, error } = await withTimeout(
          supabase.auth.getSession(),
          4000,
          { data: { session: null }, error: null } as Awaited<ReturnType<typeof supabase.auth.getSession>>,
        )

        if (!isMounted) return

        if (error && isRefreshTokenError(error)) {
          clearAuthState()
          setUnauthenticated()
          return
        }

        // Proactively discard a stale/expired session so GoTrue never gets
        // stuck trying to auto-refresh a dead token (the "spins after a week"
        // bug). This guarantees a clean slate for the next login attempt.
        if (session && isSessionExpired(session)) {
          clearAuthState()
          setUnauthenticated()
          return
        }

        const user = session?.user ?? null

        if (user) {
          // Guard the profile query too - a hanging DB call must not block auth
          // from resolving. Worst case the user is authenticated with no profile.
          const profile = await withTimeout(fetchProfile(user.id), 4000, null)
          setAuthenticated(user, profile)
        } else {
          setUnauthenticated()
        }
      } catch {
        if (isMounted) setUnauthenticated()
      }
    }
    
    // Add timeout to prevent infinite loading state
    const authTimeout = setTimeout(() => {
      if (isMounted && !authResolvedRef.current) {
        console.warn("[v0] Auth check timeout - setting unauthenticated")
        setUnauthenticated()
      }
    }, AUTH_TIMEOUT)
    
    checkAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return
      
      if (event === "SIGNED_OUT" || !session?.user) {
        setUnauthenticated()
        return
      }

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        const profile = await withTimeout(fetchProfile(session.user.id), 4000, null)
        setAuthenticated(session.user, profile)
      }
    })

    return () => {
      isMounted = false
      clearTimeout(authTimeout)
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
