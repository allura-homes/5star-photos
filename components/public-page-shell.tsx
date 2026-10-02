"use client"

import type { ReactNode } from "react"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { MobileNav } from "@/components/mobile-nav"
import { SiteFooter } from "@/components/site-footer"
import { useAuthContext } from "@/lib/contexts/auth-context"
import { cn } from "@/lib/utils"

export function PublicPageShell({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuthContext()

  return (
    <div className="min-h-screen font-sans">
      <Header />
      {isAuthenticated && <Sidebar />}
      <div className={cn("pt-20", isAuthenticated && "pb-20 md:ml-20 md:pb-0")}>
        <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">{children}</main>
        <SiteFooter />
      </div>
      {isAuthenticated && <MobileNav />}
    </div>
  )
}
