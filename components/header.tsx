"use client"

import Link from "next/link"
import Image from "next/image"
import { UserMenu } from "@/components/user-menu"
import { useAuthContext } from "@/lib/contexts/auth-context"

export function Header() {
  const { isAuthenticated } = useAuthContext()

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-black/25 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-3">
        <Link
          href={isAuthenticated ? "/library" : "/"}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity min-w-0"
        >
          <Image src="/logo.png" alt="5star.photos" width={48} height={48} className="w-10 h-10 sm:w-12 sm:h-12" />
          <span className="text-xl sm:text-2xl font-bold text-white truncate">5star.photos</span>
        </Link>

        <nav className="flex items-center gap-3 sm:gap-6" aria-label="Account">
          {!isAuthenticated && (
            <Link
              href="/enhance"
              className="hidden sm:inline-flex px-6 py-2.5 rounded-full gradient-magenta-violet glow-magenta hover:scale-105 transition-all duration-300 text-sm font-bold text-white"
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
