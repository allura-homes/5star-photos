import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

// Use a global variable to ensure singleton survives hot module reloading
// and page navigations in Next.js
declare global {
  var __supabaseClient: SupabaseClient | undefined
  var __supabaseAuthListenerSetup: boolean | undefined
}

export function createClient(): SupabaseClient {
  // Return existing global instance if available (survives HMR and navigation)
  if (typeof window !== "undefined" && globalThis.__supabaseClient) {
    return globalThis.__supabaseClient
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // If env vars aren't available, throw an error early rather than creating
  // multiple clients when they become available
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase environment variables not configured. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.")
  }

  const client = createBrowserClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowStateExpirySeconds: 300,
    },
  })

  // Store in global for persistence
  if (typeof window !== "undefined") {
    globalThis.__supabaseClient = client
  }

  // Set up auth error listener to handle invalid refresh tokens
  if (typeof window !== "undefined" && !globalThis.__supabaseAuthListenerSetup) {
    globalThis.__supabaseAuthListenerSetup = true
    
    // Listen for auth errors and clear invalid sessions
    client.auth.onAuthStateChange((event, session) => {
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

  return client
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
    globalThis.__supabaseClient = undefined
    globalThis.__supabaseAuthListenerSetup = undefined
  }
}
