"use client"

import { useState, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { ImageLibrary } from "@/components/image-library"
import { ImageUploader } from "@/components/image-uploader"
import { ProjectsView } from "@/components/projects-view"
import { useAuthContext } from "@/lib/contexts/auth-context"
import type { UserImage } from "@/lib/types"
import { Loader2, Upload, Images, Coins, FolderOpen, Home } from "lucide-react"
import { TOKEN_COSTS } from "@/lib/types"
import { AirbnbImportModal } from "@/components/airbnb-import-modal"

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

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 to-slate-950">
        <Loader2 className="w-8 h-8 text-[#FF3EDB] animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) {
    router.push("/auth/login?redirect=/library")
    return null
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <div className="flex flex-1 pt-20">
        <Sidebar />

        <main className="flex-1 ml-20 p-8">
          <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#FF3EDB]/20 flex items-center justify-center">
                  <Images className="w-6 h-6 text-[#FF3EDB]" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white">Photo Library</h1>
                  <p className="text-slate-400">Your uploaded photos and saved variations</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10">
                  <Coins className="w-4 h-4 text-amber-400" />
                  <span className="text-white font-medium">{profile?.tokens || 0}</span>
                  <span className="text-slate-400 text-sm">tokens</span>
                </div>

                {activeTab === "photos" && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowAirbnbImport(true)}
                      className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-pink-500/20 to-rose-500/20 border border-pink-500/30 text-pink-300 font-medium hover:border-pink-500/50 hover:bg-pink-500/30 transition-all"
                    >
                      <Home className="w-4 h-4" />
                      Import from Airbnb
                    </button>
                    <button
                      onClick={() => setShowUploader(true)}
                      className="flex items-center gap-2 px-6 py-3 rounded-xl gradient-magenta-violet text-white font-semibold hover:scale-105 transition-all glow-magenta"
                    >
                      <Upload className="w-4 h-4" />
                      Upload Photos
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 mb-6 rounded-xl bg-white/5 border border-white/10 w-fit">
              <button
                onClick={() => setActiveTab("photos")}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all ${
                  activeTab === "photos"
                    ? "bg-fuchsia-500/20 text-fuchsia-400"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Images className="w-4 h-4" />
                All Photos
              </button>
              <button
                onClick={() => setActiveTab("projects")}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all ${
                  activeTab === "projects"
                    ? "bg-fuchsia-500/20 text-fuchsia-400"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <FolderOpen className="w-4 h-4" />
                Projects
              </button>
            </div>

            {/* Development mode banner */}
            <div className="flex items-center gap-4 mb-6 p-4 rounded-xl bg-green-500/10 border border-green-500/30">
              <span className="text-green-400 font-medium">Development Mode:</span>
              <span className="text-white text-sm">All features are currently FREE - no token limits!</span>
            </div>

            {/* Content based on active tab */}
            {activeTab === "photos" && (
              <>
                {showUploader ? (
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
                )}
              </>
            )}

            {activeTab === "projects" && (
              <ProjectsView />
            )}
          </div>
        </main>
      </div>

      {/* Airbnb Import Modal */}
      <AirbnbImportModal
        isOpen={showAirbnbImport}
        onClose={() => setShowAirbnbImport(false)}
        onImportComplete={() => setRefreshKey(k => k + 1)}
      />
    </div>
  )
}
