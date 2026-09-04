"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { isNavActive, useVisibleNavItems } from "@/components/sidebar"

/**
 * Bottom tab bar for small screens. Mirrors the desktop Sidebar items.
 * Admin items are folded into the user menu on mobile to keep five tabs.
 */
export function MobileNav() {
  const pathname = usePathname()
  const items = useVisibleNavItems().filter((i) => !i.adminOnly)

  return (
    <nav
      aria-label="Primary"
      className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-[#0B0D1A]/90 backdrop-blur-xl border-t border-white/10 pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-5">
        {items.map((item) => {
          const Icon = item.icon
          const isActive = isNavActive(item, pathname)
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                  isActive ? "text-[#FF3EDB]" : "text-[#C9CCDA] hover:text-white",
                )}
              >
                <Icon className="w-5 h-5" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
