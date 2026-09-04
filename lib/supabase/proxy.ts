import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

/**
 * Updates the Supabase session and handles auth redirects.
 * This runs on every request via middleware.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // If Supabase is not configured, just pass through the request
  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({
          request,
        })
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
      },
    },
    auth: {
      detectSessionInUrl: false,
      // NOTE: We intentionally do NOT set autoRefreshToken/persistSession to
      // false here. This middleware is the durable fix for the recurring
      // "login spins forever after a week of inactivity" bug. By letting the
      // server refresh an expired access token (using the still-valid refresh
      // token) and writing the fresh tokens back via the setAll cookie handler,
      // the browser client always loads an already-valid session. That avoids
      // the client-side network token refresh, which hangs inside the sandboxed
      // v0 preview iframe and causes the infinite spinner.
    },
  })

  // IMPORTANT: Do not run code between createServerClient and
  // supabase.auth.getUser(). getUser() is what triggers the server-side token
  // refresh; the refreshed tokens are persisted by the setAll handler above.
  // Wrapped in try/catch so a transient auth/network error in middleware can
  // never throw a 500 and block the whole app - we just treat it as no user.
  let user = null
  try {
    const result = await supabase.auth.getUser()
    user = result.data.user
  } catch (error) {
    console.log("[v0] middleware getUser failed, treating as unauthenticated:", error)
  }

  const pathname = request.nextUrl.pathname

  // ---------------------------------------------------------------------
  // Single-pipeline navigation (stable release)
  // The legacy Quick Enhance -> Batch Jobs -> Preview -> Download pipeline is
  // retired for signed-in users. Everything lives in Library -> Transform.
  // Admins keep read-only access to the legacy pages for support.
  // ---------------------------------------------------------------------
  const legacyUserPaths = ["/batch-jobs", "/preview", "/download", "/jobs"]
  const isLegacyPath = legacyUserPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`))

  // Signed-in users who land on the guest upload page go straight to Library.
  if (pathname === "/enhance" && user) {
    const url = request.nextUrl.clone()
    url.pathname = "/library"
    url.search = ""
    return NextResponse.redirect(url)
  }

  // Dead legacy link "/about" now lives at "/help".
  if (pathname === "/about") {
    const url = request.nextUrl.clone()
    url.pathname = "/help"
    return NextResponse.redirect(url, 308)
  }

  // Protected routes that require authentication
  // Note: Most routes handle auth client-side via useAuthContext
  // Only add routes here that MUST be server-protected
  const protectedPaths = ["/dashboard", "/account", "/history", "/library", "/transform", "/batch-transform"]
  const isProtectedPath = protectedPaths.some((path) => pathname.startsWith(path))

  // Admin-only routes
  const adminPaths = ["/admin"]
  const isAdminPath = adminPaths.some((path) => pathname.startsWith(path))

  // Redirect unauthenticated users from protected routes
  if ((isProtectedPath || isLegacyPath) && !user) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/login"
    url.search = ""
    url.searchParams.set("redirect", pathname)
    return NextResponse.redirect(url)
  }

  // Admin role is needed for /admin/* and for the retired legacy pages.
  if ((isAdminPath || isLegacyPath) && user) {
    // Fetch user's role from profiles
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

    if (profile?.role !== "admin") {
      const url = request.nextUrl.clone()
      url.pathname = "/library"
      url.search = ""
      return NextResponse.redirect(url)
    }
  } else if (isAdminPath && !user) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/login"
    url.searchParams.set("redirect", request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
