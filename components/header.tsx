"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { UserMenu } from "@/components/user-menu"
import { useAuthContext } from "@/lib/contexts/auth-context"

export function Header() {
  const { isAuthenticated } = useAuthContext()

  const pathname = usePathname()

  return (
    <header className={cn("fixed top-0 inset-x-0 z-50 border-b border-border bg-background/25 backdrop-blur-xl", isAuthenticated && "md:pl-20")}>
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-2 px-4 sm:gap-6 sm:px-6">
        <Link
          href={isAuthenticated ? "/library" : "/"}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity min-w-0"
        >
          <Image src="/logo.png" alt="5star.photos" width={48} height={48} className="w-10 h-10 sm:w-12 sm:h-12" />
          <span className="hidden truncate text-xl font-bold text-foreground sm:inline lg:text-2xl">5star.photos</span>
        </Link>

        <nav aria-label="Website" className="flex items-center gap-3 text-sm font-medium sm:gap-6">
          {[{ href: "/pricing", label: "Pricing" }, { href: "/help", label: "Help" }].map((item) => (
            <Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined}
              className={cn("rounded-md py-2 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring", pathname === item.href ? "text-foreground underline decoration-primary decoration-2 underline-offset-8" : "text-muted-foreground")}>
              {item.label}
            </Link>
          ))}
        </nav>
        <nav className="flex shrink-0 items-center gap-3 sm:gap-6" aria-label="Account">
          {!isAuthenticated && (
            <Link
              href="/enhance"
              className="hidden xl:inline-flex px-6 py-2.5 rounded-full gradient-magenta-violet hover:opacity-90 transition-opacity text-sm font-bold text-primary-foreground"
            >
              Enhance Photos
            </Link>
          )}
          <UserMenu />
        </nav>
      </div>
    </header>
  )
}
