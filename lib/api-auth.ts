import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import type { User } from "@supabase/supabase-js"

/**
 * Authentication guard for Route Handlers.
 *
 * Builds a Supabase client from the cookies on the incoming request and
 * verifies the session against Supabase Auth (`getUser()` hits the auth
 * server, unlike `getSession()` which only decodes the local JWT).
 *
 * Usage:
 *   const auth = await requireUser(request)
 *   if (!auth.ok) return auth.response
 *   const { user } = auth
 */
export type RequireUserResult =
  | { ok: true; user: User; isAdmin: boolean }
  | { ok: false; response: NextResponse }

export async function requireUser(request: NextRequest): Promise<RequireUserResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error("[api-auth] Supabase env vars missing")
    return {
      ok: false,
      response: NextResponse.json({ error: "Server misconfigured", code: "CONFIG" }, { status: 500 }),
    }
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      // Route handlers built this way don't refresh cookies; the proxy/middleware does.
      setAll() {},
    },
  })

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Please sign in to continue.", code: "UNAUTHENTICATED" }, { status: 401 }),
    }
  }

  let isAdmin = false
  try {
    const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single()
    isAdmin = Boolean(profile?.is_admin)
  } catch {
    // Non-fatal: treat as non-admin
  }

  return { ok: true, user, isAdmin }
}

/**
 * Headers to forward when a route handler calls another internal route
 * handler server-to-server, so the downstream `requireUser` check sees the
 * same session.
 */
export function forwardAuthHeaders(request: NextRequest): Record<string, string> {
  const cookie = request.headers.get("cookie")
  return cookie ? { cookie } : {}
}

/** Generic client-safe error payload. Log details server-side, never leak provider bodies. */
export function safeError(message: string, code: string, status = 500) {
  return NextResponse.json({ error: message, code }, { status })
}
