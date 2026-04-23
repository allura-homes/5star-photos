import { createClient } from "@supabase/supabase-js"

/**
 * Creates a Supabase client directly without any SSR/cookie handling.
 * Use this for API routes in v0 preview where cookies don't work properly.
 */
export function createDirectClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase environment variables are missing")
  }

  return createClient(supabaseUrl, supabaseKey)
}
