"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { Images, Upload, Layers, Clock, HelpCircle, Shield, BarChart3, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuthContext } from "@/lib/contexts/auth-context"

export type NavItem = {
  id: string
  href: string
  icon: LucideIcon
  label: string
  /** Active when pathname starts with this prefix (defaults to exact href). */
  match?: string
  adminOnly?: boolean
}

/**
 * Single source of truth for primary navigation.
 * Used by both the desktop Sidebar and the MobileNav.
 */
export const NAV_ITEMS: NavItem[] = [
  { id: "library", href: "/library", icon: Images, label: "Library", match: "/library" },
  { id: "upload", href: "/library?upload=1", icon: Upload, label: "Upload" },
  { id: "batch", href: "/batch-transform", icon: Layers, label: "Batch Enhance", match: "/batch-transform" },
  { id: "activity", href: "/history", icon: Clock, label: "Activity", match: "/history" },
  { id: "help", href: "/help", icon: HelpCircle, label: "Help", match: "/help" },
  { id: "admin", href: "/admin", icon: Shield, label: "Admin", match: "/admin", adminOnly: true },
  { id: "training", href: "/admin/training", icon: BarChart3, label: "Model Training", match: "/admin/training", adminOnly: true },
]

export function isNavActive(item: NavItem, pathname: string) {
  if (item.id === "upload") return false
  if (item.id === "admin") return pathname === "/admin"
  if (item.match) return pathname === item.match || pathname.startsWith(item.match + "/")
  return pathname === item.href
}

export function useVisibleNavItems() {
  const { isAdmin } = useAuthContext()
  return NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin)
}

export function Sidebar() {
  const pathname = usePathname()
  const items = useVisibleNavItems()
  const primary = items.filter((i) => !i.adminOnly)
  const admin = items.filter((i) => i.adminOnly)

  const renderItem = (item: NavItem) => {
    const Icon = item.icon
    const isActive = isNavActive(item, pathname)
    return (
      <Link
        key={item.id}
        href={item.href}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "group relative flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-300",
          isActive
            ? "gradient-magenta-violet text-white shadow-lg glow-magenta"
            : "text-[#C9CCDA] hover:bg-white/10 hover:text-white",
        )}
        aria-label={item.label}
      >
        <Icon className="w-5 h-5" />
        <span
          role="tooltip"
          className="absolute left-full ml-4 px-3 py-1.5 glass-card-strong rounded-lg text-sm text-white whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-visible:opacity-100 group-focus-visible:visible transition-all duration-200 pointer-events-none"
        >
          {item.label}
        </span>
      </Link>
    )
  }

  return (
    <aside
      className="hidden md:flex fixed left-0 top-0 h-screen w-20 glass-card border-r border-white/15 flex-col items-center py-6 gap-6 z-50"
      aria-label="Primary"
    >
      <Link href="/library" className="flex items-center justify-center w-12 h-12 hover:scale-105 transition-transform">
        <Image src="/5star-icon.png" alt="5star.photos" width={48} height={48} className="w-12 h-12" />
      </Link>

      <nav className="flex flex-col gap-3 mt-8" aria-label="Main">
        {primary.map(renderItem)}
      </nav>

      {admin.length > 0 && (
        <nav className="mt-auto flex flex-col gap-3 pt-4 border-t border-white/10" aria-label="Admin">
          {admin.map(renderItem)}
        </nav>
      )}
    </aside>
  )
}
