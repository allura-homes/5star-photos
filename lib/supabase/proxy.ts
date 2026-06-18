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

  // Protected routes that require authentication
  // Note: Most routes handle auth client-side via useAuthContext
  // Only add routes here that MUST be server-protected
  const protectedPaths = ["/dashboard", "/account", "/history"]
  const isProtectedPath = protectedPaths.some((path) => request.nextUrl.pathname.startsWith(path))

  // Admin-only routes
  const adminPaths = ["/admin"]
  const isAdminPath = adminPaths.some((path) => request.nextUrl.pathname.startsWith(path))

  // Redirect unauthenticated users from protected routes
  if (isProtectedPath && !user) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/login"
    url.searchParams.set("redirect", request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  // Check admin access
  if (isAdminPath && user) {
    // Fetch user's role from profiles
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

    if (profile?.role !== "admin") {
      const url = request.nextUrl.clone()
      url.pathname = "/"
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
