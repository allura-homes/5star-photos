import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

/**
 * Auth callback handler for email confirmations and OAuth redirects.
 * This route exchanges the auth code for a session.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/library"

  // Handle token_hash for email confirmation (PKCE flow)
  const token_hash = searchParams.get("token_hash")
  const type = searchParams.get("type")

  console.log("[v0] Auth callback called with:", {
    hasCode: !!code,
    hasTokenHash: !!token_hash,
    type,
    origin,
  })

  const supabase = await createClient()

  // First try code exchange (OAuth and magic link with PKCE)
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.session) {
      console.log("[v0] Code exchange successful, redirecting to:", `${origin}${next}`)
      return NextResponse.redirect(`${origin}${next}`)
    }

    if (error) {
      console.error("[v0] Auth callback code exchange error:", error.message)
    }
  }

  // Then try token_hash verification (email confirmation without PKCE)
  if (token_hash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as "email" | "signup" | "recovery" | "invite" | "magiclink" | "email_change",
    })

    if (!error && data.session) {
      console.log("[v0] OTP verification successful, redirecting to:", `${origin}${next}`)
      return NextResponse.redirect(`${origin}${next}`)
    }

    if (error) {
      console.error("[v0] OTP verification error:", error.message)
    }
  }

  // If no code or token_hash, check if user is already authenticated
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (session) {
    console.log("[v0] User already has session, redirecting to:", `${origin}${next}`)
    return NextResponse.redirect(`${origin}${next}`)
  }

  // Auth error - redirect to home with error parameter
  console.error("[v0] Auth callback failed - no valid auth parameters")
  return NextResponse.redirect(`${origin}/?auth_error=true`)
}
