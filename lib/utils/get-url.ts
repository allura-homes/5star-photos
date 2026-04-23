/**
 * Gets the correct base URL for the current environment.
 * Works in: localhost, v0 preview, Vercel preview, production
 */
export function getURL(): string {
  // In browser, use window.location.origin
  if (typeof window !== "undefined") {
    return window.location.origin
  }

  const isValidUrl = (url: string | undefined): boolean => {
    if (!url) return false
    // Skip if it looks like an API key
    if (url.startsWith("sk-") || url.startsWith("pk-")) return false
    // Must contain a dot (domain) or be localhost
    if (!url.includes(".") && !url.includes("localhost")) return false
    return true
  }

  // Server-side: check environment variables in order of preference
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL

  let url: string
  if (isValidUrl(siteUrl)) {
    url = siteUrl!
  } else if (isValidUrl(vercelUrl)) {
    url = vercelUrl!
  } else {
    // Fallback to production URL if all else fails
    url = "https://5star.photos"
    console.warn("[v0] No valid URL found in env vars, using fallback:", url)
  }

  // Ensure https:// prefix (except localhost)
  if (!url.startsWith("http")) {
    url = url.includes("localhost") ? `http://${url}` : `https://${url}`
  }

  // Remove trailing slash
  url = url.endsWith("/") ? url.slice(0, -1) : url

  return url
}

/**
 * Gets the callback URL for OAuth redirects
 */
export function getCallbackURL(returnPath?: string): string {
  const base = getURL()
  const callback = `${base}/auth/callback`
  return returnPath ? `${callback}?next=${encodeURIComponent(returnPath)}` : callback
}
