"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { UploadCard } from "@/components/upload-card"
import { TaskTiles } from "@/components/task-tiles"
import { AuthModal } from "@/components/auth-modal"
import { EnhancementPreferencesModal } from "@/components/enhancement-preferences-modal"
import type { EnhancementPreferences, ClassifiedPhoto } from "@/lib/types"
import { Camera } from "lucide-react"
import { createJobRecord, processEnhancement } from "@/lib/actions/job-actions"
import { uploadFileToStorage } from "@/lib/supabase-client"
import { Header } from "@/components/header"
import { useAuthContext } from "@/lib/contexts/auth-context"
import { Loader2 } from "lucide-react"
import { savePendingFiles } from "@/lib/pending-files-storage"

const PENDING_ENHANCE_KEY = "5star_pending_enhance"

export default function EnhancePage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, freePreviewsRemaining, refreshProfile } = useAuthContext()

  const [files, setFiles] = useState<File[]>([])
  const [googleDriveLink, setGoogleDriveLink] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStage, setProcessingStage] = useState<"idle" | "uploading" | "processing">("idle")
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authCheckComplete, setAuthCheckComplete] = useState(false)
  const [showPreferencesModal, setShowPreferencesModal] = useState(false)
  const [pendingPreferences, setPendingPreferences] = useState<EnhancementPreferences | null>(null)
  const [pendingClassifiedPhotos, setPendingClassifiedPhotos] = useState<ClassifiedPhoto[] | null>(null)

  const startEnhancement = useCallback(
    async (preferences?: EnhancementPreferences, classifiedPhotos?: ClassifiedPhoto[]) => {
      setIsProcessing(true)
      setProcessingStage("uploading")

      try {
        const jobResult = await createJobRecord(
          "full_5star_fix",
          googleDriveLink || undefined,
          preferences,
          classifiedPhotos?.map((p) => ({
            name: p.file.name,
            classification: p.userOverride || p.classification,
          })),
        )

        if (jobResult.error || !jobResult.jobId) {
          console.error("Job creation failed:", jobResult.error)
          alert(`Error: ${jobResult.error}`)
          setIsProcessing(false)
          setProcessingStage("idle")
          return
        }

        const jobId = jobResult.jobId

        const uploadedFiles: Array<{ name: string; size: number; original_url: string }> = []

        for (const file of files) {
          const result = await uploadFileToStorage(file, jobId)
          if (result) {
            uploadedFiles.push(result)
          }
        }

        if (uploadedFiles.length === 0 && files.length > 0) {
          alert("Failed to upload files. Please try again.")
          setIsProcessing(false)
          setProcessingStage("idle")
          return
        }

        setProcessingStage("processing")

        const finalizeResult = await processEnhancement(jobId, uploadedFiles)

        if (finalizeResult.error) {
          alert(`Error: ${finalizeResult.error}`)
          setIsProcessing(false)
          setProcessingStage("idle")
          return
        }

        router.push(`/preview/${jobId}`)
      } catch (error) {
        console.error("Enhancement error:", error)
        alert("An error occurred during enhancement. Please try again.")
        setIsProcessing(false)
        setProcessingStage("idle")
      }
    },
    [files, googleDriveLink, router],
  )

  const handlePreferencesConfirm = useCallback(
    (preferences: EnhancementPreferences, classifiedPhotos: ClassifiedPhoto[]) => {
      setShowPreferencesModal(false)
      setPendingPreferences(preferences)
      setPendingClassifiedPhotos(classifiedPhotos)
      startEnhancement(preferences, classifiedPhotos)
    },
    [startEnhancement],
  )

  const handleEnhance = useCallback(async () => {
    if (files.length === 0) {
      alert("Please select at least one photo to enhance.")
      return
    }

    if (!authCheckComplete) {
      return
    }

    if (!isAuthenticated) {
      // Save files to IndexedDB so they persist across auth redirect
      await savePendingFiles(files)
      sessionStorage.setItem(PENDING_ENHANCE_KEY, "true")
      setShowAuthModal(true)
      return
    }

    setShowPreferencesModal(true)
  }, [files, isAuthenticated, authCheckComplete])

  const handleAuthSuccess = useCallback(async () => {
    setShowAuthModal(false)

    // Save files again to ensure they're persisted before redirect
    if (files.length > 0) {
      await savePendingFiles(files)
      sessionStorage.setItem(PENDING_ENHANCE_KEY, "true")
    }

    refreshProfile()

    // Let the useEffect handle the redirect to library
    // The library page will load the pending files
  }, [files, refreshProfile])

  useEffect(() => {
    if (!authLoading) {
      setAuthCheckComplete(true)
    }
  }, [authLoading])

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace("/library")
    }
  }, [isAuthenticated, authLoading, router])

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-fuchsia-400 animate-spin" />
      </div>
    )
  }

  if (isAuthenticated) {
    router.replace("/library")
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-fuchsia-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">
      <Sidebar />

      <div className="flex-1 flex flex-col min-h-screen">
        <Header />

        <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
          <div className="w-full max-w-4xl space-y-8">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-fuchsia-500/10 to-violet-500/10 border border-fuchsia-500/20">
                <Camera className="h-4 w-4 text-fuchsia-400" />
                <span className="text-sm text-white/80">Real Estate Photo Enhancement</span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white">
                Transform Your{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-violet-400">
                  Property Photos
                </span>
              </h1>

              <p className="text-white/60 max-w-2xl mx-auto">
                Upload your real estate photos and let our AI enhance them to professional quality. Perfect lighting,
                vibrant colors, and stunning results.
              </p>
            </div>

            <UploadCard
              files={files}
              setFiles={setFiles}
              googleDriveLink={googleDriveLink}
              setGoogleDriveLink={setGoogleDriveLink}
              onEnhance={handleEnhance}
              isProcessing={isProcessing}
              processingStage={processingStage}
            />

            <TaskTiles />
          </div>
        </main>
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
        freePreviewsRemaining={freePreviewsRemaining}
      />

      <EnhancementPreferencesModal
        isOpen={showPreferencesModal}
        onClose={() => setShowPreferencesModal(false)}
        onConfirm={handlePreferencesConfirm}
        files={files}
      />
    </div>
  )
}
