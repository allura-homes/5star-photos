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

  const client = createBrowserClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      // The default @supabase/ssr browser client uses the Web Locks API
      // (navigator.locks) to serialize access to the auth token. Inside
      // sandboxed iframes (v0 preview, some embeds) lock acquisition can
      // hang forever, which causes getUser()/signInWithPassword() to never
      // resolve. Override with a no-op lock that just runs the callback so
      // auth calls never block on navigator.locks.
      lock: async (_name, _acquireTimeout, fn) => fn(),
    },
  })

  // Store on window for persistence
  if (typeof window !== "undefined") {
    window.__supabaseClient = client
  }

  return client
}

// Clear auth state - call this when catching refresh token errors
export function clearAuthState(): void {
  if (typeof window === "undefined") return

  // 1. Clear Supabase auth cookies
  document.cookie.split(";").forEach((c) => {
    const name = c.trim().split("=")[0]
    if (name.includes("supabase") || name.includes("sb-")) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
    }
  })

  // 2. Clear localStorage / sessionStorage. The @supabase/ssr browser client
  // persists the session (including the refresh token) in localStorage under
  // a key like "sb-<project-ref>-auth-token". After a long period of inactivity
  // that refresh token expires; if it is left behind, GoTrue gets stuck trying
  // to auto-refresh the dead token and new signInWithPassword calls hang forever
  // (the "spins after a week" symptom). Removing these keys guarantees a clean
  // slate so a fresh login always succeeds.
  try {
    for (const storage of [window.localStorage, window.sessionStorage]) {
      const keysToRemove: string[] = []
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i)
        if (key && (key.startsWith("sb-") || key.includes("supabase"))) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach((key) => storage.removeItem(key))
    }
  } catch {
    // Storage access can throw in some sandboxed contexts - ignore.
  }

  // 3. Drop the cached client so the next createClient() rebuilds it fresh.
  window.__supabaseClient = undefined
}
