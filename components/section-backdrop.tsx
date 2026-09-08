"use client"

import { usePathname } from "next/navigation"
import { sectionForPath } from "@/lib/section-theme"

/**
 * Full-viewport backdrop that changes color family by route. Renders on the
 * server with the right family (usePathname is SSR-safe) so there is no flash,
 * and the custom properties cross-fade on client navigation via @property.
 */
export function SectionBackdrop() {
  const section = sectionForPath(usePathname())
  return <div aria-hidden data-section={section} className="section-backdrop" />
}
