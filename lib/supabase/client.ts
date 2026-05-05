import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

// Singleton instance to prevent multiple clients competing for auth locks
let supabaseInstance: SupabaseClient | null = null
let authListenerSetup = false

export function createClient(): SupabaseClient {
  // Return existing instance if available
  if (supabaseInstance) {
    return supabaseInstance
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Check if environment variables are available
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("[v0] Supabase environment variables not yet available, will retry on next call")
    // Return a minimal mock client that won't crash but also won't work
    // This allows the app to render while env vars are loading
    return {
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        getUser: async () => ({ data: { user: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signInWithOAuth: async () => ({ data: null, error: new Error("Supabase not initialized") }),
        signOut: async () => ({ error: null }),
      },
      from: () => ({
        select: () => ({ data: null, error: new Error("Supabase not initialized") }),
        insert: () => ({ data: null, error: new Error("Supabase not initialized") }),
        update: () => ({ data: null, error: new Error("Supabase not initialized") }),
        delete: () => ({ data: null, error: new Error("Supabase not initialized") }),
      }),
      storage: {
        from: () => ({
          upload: async () => ({ data: null, error: new Error("Supabase not initialized") }),
          getPublicUrl: () => ({ data: { publicUrl: "" } }),
        }),
      },
    } as unknown as SupabaseClient
  }

  supabaseInstance = createBrowserClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowStateExpirySeconds: 300,
    },
  })

  // Set up auth error listener to handle invalid refresh tokens
  if (!authListenerSetup && typeof window !== "undefined") {
    authListenerSetup = true
    
    // Listen for auth errors and clear invalid sessions
    supabaseInstance.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED" && !session) {
        // Token refresh failed - clear any stale cookies
        console.log("[v0] Token refresh failed, clearing session")
        document.cookie.split(";").forEach((c) => {
          const name = c.trim().split("=")[0]
          if (name.includes("supabase") || name.includes("sb-")) {
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
          }
        })
      }
    })
  }

  return supabaseInstance
}

// Clear invalid auth state - call this when catching refresh token errors
export function clearAuthState(): void {
  if (typeof window !== "undefined") {
    document.cookie.split(";").forEach((c) => {
      const name = c.trim().split("=")[0]
      if (name.includes("supabase") || name.includes("sb-")) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
      }
    })
    supabaseInstance = null
    authListenerSetup = false
  }
}
