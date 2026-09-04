"use client"

import type { ReactNode } from "react"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { MobileNav } from "@/components/mobile-nav"
import { BetaBanner } from "@/components/beta-banner"
import { cn } from "@/lib/utils"

interface AppShellProps {
  children: ReactNode
  /** Extra classes for the <main> element (e.g. to remove default padding). */
  className?: string
  /** Hide the free-beta banner on dense pages such as Transform. */
  hideBanner?: boolean
}

/**
 * The one layout wrapper for every authenticated page.
 *
 * Desktop (md+): fixed Header (h-20) + fixed 80px Sidebar on the left.
 * Mobile (<md): fixed Header + bottom MobileNav; content gets bottom padding
 * so the last row is never hidden behind the tab bar.
 */
export function AppShell({ children, className, hideBanner }: AppShellProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="flex flex-1 pt-20">
        <Sidebar />
        <main
          className={cn(
            "flex-1 min-w-0 p-4 pb-24 sm:p-6 md:ml-20 md:p-8 md:pb-8",
            className,
          )}
        >
          {!hideBanner && <BetaBanner />}
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  )
}
