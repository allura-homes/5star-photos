/**
 * Only allow same-origin, absolute paths for post-auth redirects.
 * Rejects protocol-relative ("//evil.com"), scheme ("https:", "javascript:")
 * and backslash tricks, and anything that is not a path. Query strings are kept
 * so `/checkout?plan=pro` survives the login round-trip.
 */
export function safeRedirectPath(value: string | null | undefined, fallback = "/library"): string {
  if (!value) return fallback
  const trimmed = value.trim()
  if (!trimmed.startsWith("/")) return fallback
  if (trimmed.startsWith("//") || trimmed.startsWith("/\\")) return fallback
  if (/[\u0000-\u001f]/.test(trimmed)) return fallback
  // Never bounce back into the auth pages themselves.
  if (trimmed.startsWith("/auth/")) return fallback
  return trimmed
}
