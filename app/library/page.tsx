"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { ImageLibrary } from "@/components/image-library"
import { ImageUploader } from "@/components/image-uploader"
import { ProjectsView } from "@/components/projects-view"
import { useAuthContext } from "@/lib/contexts/auth-context"
import type { UserImage } from "@/lib/types"
import { Loader2, Upload, Images, Coins, FolderOpen, Home } from "lucide-react"
import { AirbnbImportModal } from "@/components/airbnb-import-modal"
import { TOKENS_ENFORCED } from "@/lib/constants/tokens"

export default function LibraryPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated, isLoading: authLoading, profile } = useAuthContext()
  const [showUploader, setShowUploader] = useState(false)
  const [showAirbnbImport, setShowAirbnbImport] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  // Tab state - "photos" or "projects"
  const initialTab = searchParams.get("tab") === "projects" ? "projects" : "photos"
  const [activeTab, setActiveTab] = useState<"photos" | "projects">(initialTab)

  // Deep link: /library?upload=1 (used by the sidebar "Upload" item)
  const wantsUpload = searchParams.get("upload") === "1"
  useEffect(() => {
    if (wantsUpload) {
      setActiveTab("photos")
      setShowUploader(true)
      // Clean the URL so refreshing doesn't re-open the uploader
      router.replace("/library")
    }
  }, [wantsUpload, router])

  const handleSelectImage = useCallback(
    (image: UserImage) => {
      router.push(`/transform/${image.id}`)
    },
    [router],
  )

  const handleUploadComplete = useCallback(() => {
    setShowUploader(false)
    setRefreshKey((k) => k + 1)
  }, [])

  // Show loading while auth is initializing
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 to-slate-950">
        <Loader2 className="w-8 h-8 text-[#FF3EDB] animate-spin" />
      </div>
    )
  }

  // Redirect to login if not authenticated (after loading completes)
  if (!isAuthenticated) {
    router.push("/auth/login?redirect=/library")
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 to-slate-950">
        <Loader2 className="w-8 h-8 text-[#FF3EDB] animate-spin" />
      </div>
    )
  }

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto">
        {/* Page header */}
        <div className="flex flex-col gap-4 mb-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#FF3EDB]/20 flex items-center justify-center shrink-0">
              <Images className="w-6 h-6 text-[#FF3EDB]" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">Photo Library</h1>
              <p className="text-slate-400 text-sm sm:text-base">Your uploaded photos and saved variations</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {TOKENS_ENFORCED && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10">
                <Coins className="w-4 h-4 text-amber-400" />
                <span className="text-white font-medium">{profile?.tokens || 0}</span>
                <span className="text-slate-400 text-sm">tokens</span>
              </div>
            )}

            {activeTab === "photos" && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAirbnbImport(true)}
                  className="flex items-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl bg-gradient-to-r from-pink-500/20 to-rose-500/20 border border-pink-500/30 text-pink-300 font-medium hover:border-pink-500/50 hover:bg-pink-500/30 transition-all text-sm sm:text-base"
                >
                  <Home className="w-4 h-4" />
                  <span className="hidden sm:inline">Import from</span> Airbnb
                </button>
                <button
                  onClick={() => setShowUploader(true)}
                  className="flex items-center gap-2 px-4 py-2.5 sm:px-6 sm:py-3 rounded-xl gradient-magenta-violet text-white font-semibold hover:scale-105 transition-all glow-magenta text-sm sm:text-base"
                >
                  <Upload className="w-4 h-4" />
                  Upload
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 mb-6 rounded-xl bg-white/5 border border-white/10 w-fit" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === "photos"}
            onClick={() => setActiveTab("photos")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all ${
              activeTab === "photos" ? "bg-fuchsia-500/20 text-fuchsia-400" : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Images className="w-4 h-4" />
            All Photos
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "projects"}
            onClick={() => setActiveTab("projects")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all ${
              activeTab === "projects" ? "bg-fuchsia-500/20 text-fuchsia-400" : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            Projects
          </button>
        </div>

        {/* Content based on active tab */}
        {activeTab === "photos" &&
          (showUploader ? (
            <ImageUploader
              onComplete={handleUploadComplete}
              onCancel={() => setShowUploader(false)}
              tokenBalance={profile?.tokens || 0}
            />
          ) : (
            <ImageLibrary
              key={refreshKey}
              onSelectImage={handleSelectImage}
              onUploadClick={() => setShowUploader(true)}
              tokenBalance={profile?.tokens || 0}
            />
          ))}

        {activeTab === "projects" && <ProjectsView />}
      </div>

      {/* Airbnb Import Modal */}
      <AirbnbImportModal
        isOpen={showAirbnbImport}
        onClose={() => setShowAirbnbImport(false)}
        onImportComplete={() => setRefreshKey((k) => k + 1)}
      />
    </AppShell>
  )
}
