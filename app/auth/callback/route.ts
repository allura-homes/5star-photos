import { createClient } from "@/lib/supabase/server"
import { createDirectClient } from "@/lib/supabase/direct"
import { NextResponse } from "next/server"
import { safeRedirectPath } from "@/lib/safe-redirect"
import { grantBonusCredits } from "@/lib/credits"
import { BETA_BONUS_CREDITS } from "@/lib/plans"

const CAMPAIGN_BONUSES: Record<string, number> = { beta: BETA_BONUS_CREDITS }

/**
 * Email sign-ups carry `signup_source` in user metadata and the DB trigger grants the
 * bonus. OAuth can't carry metadata, so the callback applies it here instead. The
 * `signup_source is null` guard makes this a one-time grant per account.
 */
async function applyCampaignBonus(userId: string, source: string | null) {
  if (!source || !(source in CAMPAIGN_BONUSES)) return
  const admin = createDirectClient()
  const { data: claimed } = await admin
    .from("profiles")
    .update({ signup_source: source })
    .eq("id", userId)
    .is("signup_source", null)
    .select("id")
  if (!claimed || claimed.length === 0) return
  await grantBonusCredits(userId, CAMPAIGN_BONUSES[source], "Beta bonus credits (never expire)")
}

/**
 * Auth callback handler for email confirmations and OAuth redirects.
 * This route exchanges the auth code for a session.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = safeRedirectPath(searchParams.get("next"))
  const source = searchParams.get("source")

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

  // Password recovery links always land on the reset-password screen so the
  // user sets a new password before going anywhere else in the app - never
  // honor `next` for this flow.
  if (type === "recovery") {
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) console.error("[v0] Recovery code exchange error:", error.message)
    } else if (token_hash) {
      const { error } = await supabase.auth.verifyOtp({ token_hash, type: "recovery" })
      if (error) console.error("[v0] Recovery OTP verification error:", error.message)
    }
    return NextResponse.redirect(`${origin}/auth/reset-password`)
  }

  // First try code exchange (OAuth and magic link with PKCE)
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.session) {
      await applyCampaignBonus(data.session.user.id, source)
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
      await applyCampaignBonus(data.session.user.id, source)
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
