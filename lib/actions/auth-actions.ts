"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

/**
 * Gets the correct base URL for the current environment (server-side)
 */
function getServerURL(requestOrigin: string | null): string {
  // Priority order:
  // 1. NEXT_PUBLIC_SITE_URL (production domain like https://5star.photos)
  // 2. Request origin header (works for most deployments)
  // 3. NEXT_PUBLIC_VERCEL_URL (Vercel preview URLs)
  // 4. Fallback to localhost

  // For production, always use the configured site URL
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL
  }

  // Use request origin if available (works for v0 preview, Vercel, etc.)
  if (requestOrigin) {
    return requestOrigin
  }

  // Fallback to Vercel URL
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    const url = process.env.NEXT_PUBLIC_VERCEL_URL
    return url.startsWith("http") ? url : `https://${url}`
  }

  return "http://localhost:3000"
}

/**
 * Server Action to initiate Google OAuth sign-in.
 * Using a server action gives us reliable access to the origin header.
 */
export async function signInWithGoogle(returnPath?: string) {
  const supabase = await createClient()
  const requestHeaders = await headers()
  const origin = requestHeaders.get("origin")

  const baseUrl = getServerURL(origin)

  // Build the callback URL with optional return path
  const callbackUrl = returnPath
    ? `${baseUrl}/auth/callback?next=${encodeURIComponent(returnPath)}`
    : `${baseUrl}/auth/callback`

  console.log("[v0] Initiating Google OAuth with redirectTo:", callbackUrl)

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl,
    },
  })

  if (error) {
    console.error("[v0] Error initiating Google OAuth:", error)
    return redirect(`/?error=OAuthSigninFailed&message=${encodeURIComponent(error.message)}`)
  }

  if (data.url) {
    return redirect(data.url)
  } else {
    console.error("[v0] signInWithOAuth did not return a URL")
    return redirect("/?error=OAuthConfigurationError")
  }
}

/**
 * Server Action for email/password sign up
 */
export async function signUpWithEmail(email: string, password: string, returnPath?: string) {
  const supabase = await createClient()
  const requestHeaders = await headers()
  const origin = requestHeaders.get("origin")

  const baseUrl = getServerURL(origin)

  const callbackUrl = returnPath
    ? `${baseUrl}/auth/callback?next=${encodeURIComponent(returnPath)}`
    : `${baseUrl}/auth/callback`

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: callbackUrl,
    },
  })

  if (error) {
    return { error: error.message }
  }

  return { data, needsConfirmation: !data.session }
}

/**
 * Server Action for email/password sign in
 */
export async function signInWithEmail(email: string, password: string) {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  return { data }
}

/**
 * Server Action to sign out
 */
export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/")
}
