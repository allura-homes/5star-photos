import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

// Simple singleton pattern
let supabaseInstance: SupabaseClient | null = null

export function createClient(): SupabaseClient {
  if (supabaseInstance) {
    return supabaseInstance
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  supabaseInstance = createBrowserClient(supabaseUrl, supabaseAnonKey)

  return supabaseInstance
}

// Clear auth state - call this when catching refresh token errors
export function clearAuthState(): void {
  if (typeof window !== "undefined") {
    document.cookie.split(";").forEach((c) => {
      const name = c.trim().split("=")[0]
      if (name.includes("supabase") || name.includes("sb-")) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
      }
    })
    supabaseInstance = null
  }
}
