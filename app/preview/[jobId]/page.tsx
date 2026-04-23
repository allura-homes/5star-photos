"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { PreviewGrid } from "@/components/preview-grid"
import { PreviewModal } from "@/components/preview-modal"
import type { Job, FileItem, Variation } from "@/lib/types"
import { Loader2 } from "lucide-react"
import { updateFileApproval, generateFinalImages } from "@/lib/actions/job-actions"

export default function PreviewPage() {
  const params = useParams()
  const jobId = params.jobId as string
  const router = useRouter()
  const [job, setJob] = useState<Job | null>(null)
  const [selectedFile, setSelectedFile] = useState<{ file: FileItem; variation?: Variation } | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchJob() {
      try {
        console.log("[v0] Fetching job:", jobId)
        const response = await fetch(`/api/jobs/${jobId}`)

        if (response.ok) {
          const data = await response.json()
          console.log("[v0] Job fetched:", {
            status: data.status,
            fileCount: data.file_list?.length,
            files: data.file_list?.map((f: any) => ({
              name: f.name,
              hasVariations: !!f.variations,
              variationCount: f.variations?.length || 0,
              variations: f.variations?.map((v: any) => ({
                num: v.variation_number,
                hasPreviewUrl: !!v.preview_url,
                previewUrlLength: v.preview_url?.length || 0,
                previewUrlPreview: v.preview_url?.substring(0, 80),
              })),
            })),
          })
          setJob(data)
          setError(null)
        } else {
          const errorData = await response.json()
          console.error("[v0] Failed to fetch job:", response.status, errorData)
          if (isLoading) {
            setError(errorData.error || "Job not found")
          }
        }
      } catch (error) {
        console.error("[v0] Error fetching job:", error)
        if (isLoading) {
          setError("Failed to load job")
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchJob()

    const interval = setInterval(() => {
      if (job?.status === "processing_preview" || job?.status === "uploading" || job?.status === "uploaded") {
        fetchJob()
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [jobId, job?.status, isLoading])

  const handleToggleApprove = async (fileIndex: number, variationIndex: number) => {
    if (!job) return

    const newFileList = [...job.file_list]
    const file = newFileList[fileIndex]

    if (variationIndex >= 0 && file.variations) {
      file.variations[variationIndex].approved = !file.variations[variationIndex].approved
    } else {
      file.approved = !file.approved
    }

    setJob({ ...job, file_list: newFileList })

    await updateFileApproval(job.id, file.name, file.approved || false)
  }

  const handleGenerateFinal = async () => {
    if (!job) return

    const approvedCount = job.file_list.reduce((count, file) => {
      if (file.variations) {
        return count + file.variations.filter((v) => v.approved).length
      }
      return count + (file.approved ? 1 : 0)
    }, 0)

    if (approvedCount === 0) {
      alert("Please approve at least one photo variation")
      return
    }

    setIsGenerating(true)
    const result = await generateFinalImages(job.id)

    if (result.success) {
      router.push(`/download/${job.id}`)
    } else {
      alert("Failed to generate final images")
      setIsGenerating(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#FF3EDB] animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Loading your job...</p>
        </div>
      </div>
    )
  }

  if (error || !job) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-white text-xl mb-4">{error || "Job not found"}</p>
          <button
            onClick={() => router.push("/enhance")}
            className="px-6 py-3 rounded-xl gradient-magenta-violet text-white font-semibold hover:scale-105 transition-transform"
          >
            Back to Quick Enhance
          </button>
        </div>
      </div>
    )
  }

  if (job.status === "uploading" || (job.status === "uploaded" && job.file_list.length === 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-2xl mx-auto px-6">
          <div className="mb-6">
            <div className="relative w-32 h-32 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full gradient-magenta-violet opacity-20 animate-pulse" />
              <div className="absolute inset-4 rounded-full gradient-magenta-violet opacity-40 animate-pulse delay-100" />
              <div className="absolute inset-8 rounded-full gradient-magenta-violet flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-white animate-spin" />
              </div>
            </div>
          </div>

          <h2 className="text-3xl font-bold text-white mb-4">✨ Creating Magic...</h2>
          <p className="text-xl text-[#C9CCDA] mb-6">
            Our AI is analyzing your photos and preparing stunning enhancements
          </p>

          <div className="glass-card-strong rounded-2xl p-6 text-left">
            <p className="text-white font-semibold mb-3">What's happening now:</p>
            <ul className="space-y-2 text-[#C9CCDA]">
              <li className="flex items-start gap-3">
                <span className="text-[#FF3EDB]">•</span>
                <span>Analyzing lighting, colors, and composition</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#FF3EDB]">•</span>
                <span>Identifying furniture, materials, and outdoor views</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#FF3EDB]">•</span>
                <span>Generating professional-quality enhancements</span>
              </li>
            </ul>
            <p className="text-sm text-[#C9CCDA] mt-4 italic">This usually takes 5-10 seconds per photo</p>
          </div>
        </div>
      </div>
    )
  }

  const approvedCount = job.file_list.reduce((count, file) => {
    if (file.variations) {
      return count + file.variations.filter((v) => v.approved).length
    }
    return count + (file.approved ? 1 : 0)
  }, 0)

  const totalVariations = job.file_list.reduce((count, file) => {
    if (file.variations) {
      return count + file.variations.length
    }
    return count + 1
  }, 0)

  return (
    <div className="min-h-screen flex">
      <Sidebar />

      <main className="flex-1 ml-20 p-8 pb-32 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-white mb-3">Preview Results</h1>
            <p className="text-lg text-[#C9CCDA]">
              These are screen-resolution previews. Approve photos to generate full-quality versions.
            </p>
            {(job.status === "processing_preview" || job.status === "uploaded") && (
              <div className="mt-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-[#FF3EDB]/10 border border-[#FF3EDB]/30">
                <Loader2 className="w-5 h-5 text-[#FF3EDB] animate-spin" />
                <span className="text-[#FF3EDB] font-medium">
                  {job.status === "uploaded"
                    ? "✨ Starting the magic... Your enhanced photos will appear here soon!"
                    : "✨ Creating your stunning enhancements..."}
                </span>
              </div>
            )}
          </div>

          {job.file_list.length > 0 ? (
            <PreviewGrid
              files={job.file_list}
              jobId={job.id}
              styleMode={job.style_mode}
              onToggleApprove={handleToggleApprove}
              onFileClick={(file, variation) => setSelectedFile({ file, variation })}
            />
          ) : (
            <div className="text-center py-12">
              <div className="mb-6">
                <div className="relative w-24 h-24 mx-auto mb-4">
                  <div className="absolute inset-0 rounded-full gradient-magenta-violet opacity-20 animate-pulse" />
                  <div className="absolute inset-3 rounded-full gradient-magenta-violet opacity-40 animate-pulse delay-75" />
                  <div className="absolute inset-6 rounded-full gradient-magenta-violet flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                  </div>
                </div>
              </div>
              <p className="text-white text-xl font-semibold mb-2">Processing your photos...</p>
              <p className="text-[#C9CCDA]">Your enhanced versions will appear here shortly</p>
            </div>
          )}
        </div>
      </main>

      {job.file_list.length > 0 && totalVariations > 0 && (
        <div className="fixed bottom-0 left-20 right-0 glass-card-strong border-t border-white/20 p-6">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div>
              <p className="text-lg text-white font-semibold">
                {approvedCount} of {totalVariations} variations approved
              </p>
              <p className="text-sm text-[#C9CCDA]">Select at least one variation to continue</p>
            </div>
            <button
              onClick={handleGenerateFinal}
              disabled={approvedCount === 0 || isGenerating || job.status === "processing_preview"}
              className="px-8 py-4 rounded-2xl gradient-magenta-violet text-white font-semibold text-lg hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed glow-magenta flex items-center gap-3"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Full-Resolution Images"
              )}
            </button>
          </div>
        </div>
      )}

      {selectedFile && (
        <PreviewModal
          file={selectedFile.file}
          variation={selectedFile.variation}
          onClose={() => setSelectedFile(null)}
          jobId={job.id}
          styleMode={job.style_mode}
        />
      )}
    </div>
  )
}
