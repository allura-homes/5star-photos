/**
 * Maps a route to the color family that paints its backdrop.
 *
 * Wayfinding by hue: marketing/auth/pricing are the brand violet, the photo
 * workspace is deep blue, money and history are teal, admin is graphite. The
 * primary CTA and the amber credits pill stay constant across all four.
 */
export type SectionTheme = "brand" | "library" | "account" | "admin"

const RULES: Array<[prefix: string, theme: SectionTheme]> = [
  ["/admin", "admin"],
  ["/account", "account"],
  ["/history", "account"],
  ["/checkout", "account"],
  ["/library", "library"],
  ["/transform", "library"],
  ["/batch-transform", "library"],
  ["/gallery", "library"],
  ["/edit", "library"],
]

export function sectionForPath(pathname: string | null | undefined): SectionTheme {
  if (!pathname) return "brand"
  for (const [prefix, theme] of RULES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return theme
  }
  return "brand"
}

export const SECTION_LABELS: Record<SectionTheme, string> = {
  brand: "5star.photos",
  library: "Workspace",
  account: "Account",
  admin: "Admin",
}
