"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { Sparkles, Layers, Info, HelpCircle, BarChart3, Images } from "lucide-react"
import { cn } from "@/lib/utils"

export function Sidebar() {
  const pathname = usePathname()

  const navItems = [
    { id: "library", href: "/library", icon: Images, label: "Photo Library" },
    { id: "quick-enhance", href: "/enhance", icon: Sparkles, label: "Quick Enhance" },
    { id: "batch-jobs", href: "/jobs", icon: Layers, label: "Batch Jobs" },
    { id: "about", href: "/about", icon: Info, label: "About" },
    { id: "training", href: "/admin/training", icon: BarChart3, label: "Model Training" },
  ]

  return (
    <div className="fixed left-0 top-0 h-screen w-20 glass-card border-r border-white/15 flex flex-col items-center py-6 gap-6 z-50">
      <Link href="/" className="flex items-center justify-center w-12 h-12 hover:scale-105 transition-transform">
        <Image src="/5star-icon.png" alt="5star.photos" width={48} height={48} className="w-12 h-12" />
      </Link>

      {/* Navigation */}
      <nav className="flex flex-col gap-3 mt-8">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "group relative flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-300",
                isActive
                  ? "gradient-magenta-violet text-white shadow-lg glow-magenta"
                  : "text-[#C9CCDA] hover:bg-white/10 hover:text-white",
              )}
              aria-label={item.label}
            >
              <Icon className="w-5 h-5" />

              {/* Tooltip */}
              <div className="absolute left-full ml-4 px-3 py-1.5 glass-card-strong rounded-lg text-sm text-white whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none">
                {item.label}
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Assistant at bottom */}
      <div className="mt-auto">
        <button
          className="flex items-center justify-center w-12 h-12 rounded-2xl text-[#C9CCDA] hover:bg-white/10 hover:text-white transition-all duration-300 group"
          aria-label="Assistant"
        >
          <HelpCircle className="w-5 h-5" />
          <div className="absolute left-full ml-4 px-3 py-1.5 glass-card-strong rounded-lg text-sm text-white whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none">
            Assistant
          </div>
        </button>
      </div>
    </div>
  )
}
