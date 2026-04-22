import { createServerClient } from "@supabase/ssr"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"

// Helper to safely get cookies - v0 preview environment has issues with next/headers
async function safeGetCookies(): Promise<{ getAll: () => { name: string; value: string }[]; set: (name: string, value: string, options?: unknown) => void } | null> {
  try {
    // Dynamic import to avoid issues at module load time
    const { cookies } = await import("next/headers")
    const cookieStore = await cookies()
    
    // Verify methods exist before returning
    if (cookieStore && typeof cookieStore.getAll === "function") {
      // Test that getAll actually works (catches production edge cases)
      const testCookies = cookieStore.getAll()
      if (Array.isArray(testCookies)) {
        return cookieStore as { getAll: () => { name: string; value: string }[]; set: (name: string, value: string, options?: unknown) => void }
      }
    }
    return null
  } catch (error) {
    console.error("[v0] Cookie retrieval error:", error)
    return null
  }
}

export async function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Supabase environment variables are missing. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your Vercel project environment variables in the 'Vars' section of the sidebar.",
    )
  }

  // Try to get cookie store safely
  const cookieStore = await safeGetCookies()
  
  // If cookies are available, use SSR client with cookie support
  if (cookieStore) {
    return createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          try {
            return cookieStore.getAll()
          } catch {
            return []
          }
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // Called from Server Component or v0 preview
          }
        },
      },
    })
  }
  
  // Fallback: use basic Supabase client without cookie support
  // This won't have auth session, but will allow database operations
  return createSupabaseClient(supabaseUrl, supabaseKey)
}
