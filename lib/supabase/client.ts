import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

// Use window global to persist singleton across module reloads
declare global {
  interface Window {
    __supabaseClient?: SupabaseClient
  }
}

export function createClient(): SupabaseClient {
  // Check for existing client on window (survives module reloads)
  if (typeof window !== "undefined" && window.__supabaseClient) {
    return window.__supabaseClient
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const client = createBrowserClient(supabaseUrl, supabaseAnonKey)
  
  // Store on window for persistence
  if (typeof window !== "undefined") {
    window.__supabaseClient = client
  }

  return client
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
    window.__supabaseClient = undefined
  }
}
