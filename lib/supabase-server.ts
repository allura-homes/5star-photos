import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

/**
 * Creates a Supabase client for server-side use (Server Components, Server Actions, Route Handlers).
 * Always create a new client within each function - don't use global variables.
 */
export async function createClient() {
  // Get cookie store - may not have all methods in v0 preview environment
  let cookieStore: Awaited<ReturnType<typeof cookies>> | null = null
  try {
    cookieStore = await cookies()
  } catch {
    // cookies() may fail in certain contexts
  }

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        // Safely handle missing getAll method in v0 preview
        if (cookieStore && typeof cookieStore.getAll === "function") {
          return cookieStore.getAll()
        }
        return []
      },
      setAll(cookiesToSet) {
        try {
          if (cookieStore && typeof cookieStore.set === "function") {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          }
        } catch {
          // The "setAll" method was called from a Server Component or v0 preview.
        }
      },
    },
  })
}
