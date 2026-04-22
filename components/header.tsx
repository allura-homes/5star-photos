"use client"

import Link from "next/link"
import Image from "next/image"
import { UserMenu } from "@/components/user-menu"
import { useAuthContext } from "@/lib/contexts/auth-context"

export function Header() {
  const { isAuthenticated } = useAuthContext()

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#0B0D1A]/80 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <Image src="/logo.png" alt="5star.photos" width={48} height={48} className="w-12 h-12" />
          <span className="text-2xl font-bold text-white">5star.photos</span>
        </Link>

        <nav className="flex items-center gap-6">
          <Link
            href={isAuthenticated ? "/library" : "/enhance"}
            className="px-6 py-2.5 rounded-full gradient-magenta-violet glow-magenta hover:scale-105 transition-all duration-300 text-sm font-bold text-white"
          >
            {isAuthenticated ? "My Library" : "Enhance Photos"}
          </Link>
          <UserMenu />
        </nav>
      </div>
    </header>
  )
}
