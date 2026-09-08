"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { X, Download, Check, Loader2, CheckCircle2, Coins } from "lucide-react"
import { toast } from "sonner"
import { CREDIT_COSTS } from "@/lib/plans"
import type { CreditShortfall } from "@/components/billing/insufficient-credits-dialog"

interface DownloadableVariation {
  id: string
  modelLabel: string
  preview_url: string
  sourceModel: string
}

interface DownloadSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  variations: DownloadableVariation[]
  originalFilename: string
  preSelectedId?: string // ID of the variation to pre-select (currently being viewed)
  /** Optional: the image these variations belong to, for the credit ledger. */
  imageId?: string
  /** Called when the server refuses a download for lack of credits. */
  onShortfall?: (shortfall: CreditShortfall) => void
  /** Called after any successful paid download so the header balance refreshes. */
  onCreditsSpent?: () => void
}

const DOWNLOAD_COST = CREDIT_COSTS.download_hires

export function DownloadSelectionModal({
  isOpen,
  onClose,
  variations,
  originalFilename,
  preSelectedId,
  imageId,
  onShortfall,
  onCreditsSpent,
}: DownloadSelectionModalProps) {
  // Filter out variations without valid URLs
  const validVariations = variations.filter(v => v.preview_url && v.preview_url.length > 0)
  
  // Initialize selection - if preSelectedId is provided, only select that one
  // Otherwise select all
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<Record<string, "pending" | "downloading" | "complete" | "error">>({})
  const [currentDownload, setCurrentDownload] = useState<string | null>(null)
  const [downloadFormat, setDownloadFormat] = useState<"png" | "jpg">("png")

  // Reset selection when modal opens or preSelectedId changes
  useEffect(() => {
    if (isOpen) {
      if (preSelectedId && validVariations.some(v => v.id === preSelectedId)) {
        setSelectedIds(new Set([preSelectedId]))
      } else if (validVariations.length > 0) {
        // Default to first variation if no pre-selection
        setSelectedIds(new Set([validVariations[0].id]))
      }
      setDownloadProgress({})
      setIsDownloading(false)
    }
  }, [isOpen, preSelectedId, validVariations.length])

  if (!isOpen) return null

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const selectAll = () => {
    setSelectedIds(new Set(validVariations.map(v => v.id)))
  }

  const selectNone = () => {
    setSelectedIds(new Set())
  }

  type DownloadOutcome = "ok" | "error" | "shortfall"

  const downloadImage = async (variation: DownloadableVariation): Promise<DownloadOutcome> => {
    try {
      // Validate the URL exists
      if (!variation.preview_url) {
        console.error("Download error: No preview URL for variation", variation.id)
        return "error"
      }

      // BILLING: /api/upscale charges the download and returns the clean
      // hi-res URL. There is deliberately no fallback to the watermarked
      // preview, otherwise a failed charge would still hand out the file.
      const upscaleResponse = await fetch("/api/upscale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: variation.preview_url,
          scale: 2,
          imageId,
        }),
      })

      if (upscaleResponse.status === 402) {
        const body = await upscaleResponse.json().catch(() => ({}))
        onShortfall?.({
          required: body.required ?? DOWNLOAD_COST,
          available: body.available ?? 0,
          plan: body.plan ?? "free",
          pastDue: body.code === "PAST_DUE",
        })
        return "shortfall"
      }

      if (!upscaleResponse.ok) {
        const body = await upscaleResponse.json().catch(() => ({}))
        toast.error(typeof body.error === "string" ? body.error : "We couldn't prepare this download.")
        return "error"
      }

      const { url: downloadUrl } = (await upscaleResponse.json()) as { url?: string }
      if (!downloadUrl) return "error"

      const response = await fetch(downloadUrl)
      if (!response.ok) throw new Error("Failed to fetch image")
      
      let blob = await response.blob()
      
      // Convert to JPG if requested (for smaller file size)
      if (downloadFormat === "jpg" && blob.type === "image/png") {
        try {
          const imageBitmap = await createImageBitmap(blob)
          const canvas = document.createElement("canvas")
          canvas.width = imageBitmap.width
          canvas.height = imageBitmap.height
          const ctx = canvas.getContext("2d")
          if (ctx) {
            ctx.drawImage(imageBitmap, 0, 0)
            const jpgBlob = await new Promise<Blob | null>((resolve) => {
              canvas.toBlob(resolve, "image/jpeg", 0.92)
            })
            if (jpgBlob) {
              blob = jpgBlob
            }
          }
        } catch (convertError) {
          console.warn("[v0] JPG conversion failed, using original format:", convertError)
        }
      }
      
      // Create download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      
      // Generate filename: originalname_modelname_hires.png/jpg
      const baseName = (originalFilename || "image").replace(/\.[^/.]+$/, "")
      const modelName = (variation.modelLabel || "unknown").replace(/\s+/g, "_").toLowerCase()
      const extension = downloadFormat === "jpg" ? "jpg" : "png"
      link.download = `${baseName}_${modelName}_hires.${extension}`
      
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      return "ok"
    } catch (error) {
      console.error("Download error:", error)
      return "error"
    }
  }

  const handleDownloadSelected = async () => {
    if (selectedIds.size === 0) return
    
    setIsDownloading(true)
    const selectedVariations = validVariations.filter(v => selectedIds.has(v.id))
    
    // Initialize progress
    const initialProgress: Record<string, "pending" | "downloading" | "complete" | "error"> = {}
    selectedVariations.forEach(v => {
      initialProgress[v.id] = "pending"
    })
    setDownloadProgress(initialProgress)
    
    // Download sequentially with delay between each. Each file is charged
    // separately, so a shortfall mid-batch stops the loop without touching
    // files that already completed.
    let anyPaid = false
    let stoppedForCredits = false
    for (const variation of selectedVariations) {
      setCurrentDownload(variation.id)
      setDownloadProgress(prev => ({ ...prev, [variation.id]: "downloading" }))

      const outcome = await downloadImage(variation)
      if (outcome === "ok") anyPaid = true

      setDownloadProgress(prev => ({
        ...prev,
        [variation.id]: outcome === "ok" ? "complete" : "error",
      }))

      if (outcome === "shortfall") {
        stoppedForCredits = true
        break
      }

      // Small delay between downloads to prevent browser issues
      if (selectedVariations.indexOf(variation) < selectedVariations.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 800))
      }
    }

    setCurrentDownload(null)
    setIsDownloading(false)
    if (anyPaid) onCreditsSpent?.()

    if (stoppedForCredits) {
      onClose()
      setDownloadProgress({})
      return
    }

    // Close modal after brief delay to show completion
    setTimeout(() => {
      onClose()
      setDownloadProgress({})
    }, 1500)
  }

  const completedCount = Object.values(downloadProgress).filter(s => s === "complete").length
  const totalCost = selectedIds.size * DOWNLOAD_COST

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={!isDownloading ? onClose : undefined}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-2xl mx-4 glass-card-strong rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div>
            <h2 className="text-xl font-bold text-white">Download Hi-Res Images</h2>
            <p className="text-sm text-slate-400 mt-1">
              Select the variations you want to download
            </p>
          </div>
          {!isDownloading && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          )}
        </div>
        
        {/* Selection controls */}
        {!isDownloading && (
          <div className="flex items-center gap-3 px-5 py-3 border-b border-white/10 bg-white/5">
            <button
              onClick={selectAll}
              className="text-sm text-fuchsia-400 hover:text-fuchsia-300 transition-colors"
            >
              Select All
            </button>
            <span className="text-slate-600">|</span>
            <button
              onClick={selectNone}
              className="text-sm text-slate-400 hover:text-slate-300 transition-colors"
            >
              Select None
            </button>
            <span className="ml-auto text-sm text-slate-400">
              {selectedIds.size} of {validVariations.length} selected
            </span>
          </div>
        )}
        
        {/* Variations grid */}
        <div className="p-5 max-h-[400px] overflow-y-auto">
          {validVariations.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-400">No variations available to download.</p>
              <p className="text-sm text-slate-500 mt-2">Generate and save some variations first.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {validVariations.map((variation) => {
                const isSelected = selectedIds.has(variation.id)
                const status = downloadProgress[variation.id]
                const isPreSelected = variation.id === preSelectedId
                
                return (
                  <div
                    key={variation.id}
                    onClick={() => !isDownloading && toggleSelection(variation.id)}
                    className={`relative rounded-xl overflow-hidden cursor-pointer transition-all ${
                      isDownloading ? "cursor-default" : "hover:scale-[1.02]"
                    } ${
                      isSelected 
                        ? "ring-2 ring-fuchsia-500 ring-offset-2 ring-offset-slate-900" 
                        : "opacity-60"
                    }`}
                  >
                    <div className="relative aspect-[4/3]">
                      <Image
                        src={variation.preview_url}
                        alt={variation.modelLabel}
                        fill
                        className="object-cover"
                      />
                      
                      {/* Selection checkbox */}
                      <div className={`absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                        isSelected 
                          ? "bg-fuchsia-500" 
                          : "bg-black/50 border border-white/30"
                      }`}>
                        {isSelected && <Check className="w-4 h-4 text-white" />}
                      </div>
                      
                      {/* Pre-selected badge */}
                      {isPreSelected && (
                        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-fuchsia-500/80 text-xs text-white font-medium">
                          Current
                        </div>
                      )}
                      
                      {/* Download status overlay */}
                      {status && (
                        <div className={`absolute inset-0 flex items-center justify-center ${
                          status === "downloading" ? "bg-black/60" :
                          status === "complete" ? "bg-green-500/30" :
                          status === "error" ? "bg-red-500/30" :
                          "bg-black/40"
                        }`}>
                          {status === "downloading" && (
                            <Loader2 className="w-8 h-8 text-white animate-spin" />
                          )}
                          {status === "complete" && (
                            <CheckCircle2 className="w-8 h-8 text-green-400" />
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Label */}
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                      <p className="text-sm font-medium text-white truncate">
                        {variation.modelLabel}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-white/10 bg-white/5">
          <div className="flex flex-col gap-2">
            {isDownloading ? (
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-fuchsia-400 animate-spin" />
                <span className="text-white">
                  Downloading {completedCount + 1} of {selectedIds.size}...
                </span>
              </div>
            ) : (
              <>
                <p className="flex items-center gap-2 text-sm text-slate-400">
                  <Coins className="size-4 text-amber-400" aria-hidden="true" />
                  <span>
                    {DOWNLOAD_COST} credits each
                    {selectedIds.size > 1 ? ` · ${totalCost} total` : ""}
                  </span>
                </p>
                <p className="text-xs text-slate-500">High-resolution, no watermark</p>
                {/* Format toggle */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Format:</span>
                  <div className="flex rounded-lg overflow-hidden border border-white/10">
                    <button
                      onClick={() => setDownloadFormat("png")}
                      className={`px-3 py-1 text-xs font-medium transition-colors ${
                        downloadFormat === "png" 
                          ? "bg-fuchsia-500 text-white" 
                          : "bg-white/5 text-slate-400 hover:bg-white/10"
                      }`}
                    >
                      PNG
                    </button>
                    <button
                      onClick={() => setDownloadFormat("jpg")}
                      className={`px-3 py-1 text-xs font-medium transition-colors ${
                        downloadFormat === "jpg" 
                          ? "bg-fuchsia-500 text-white" 
                          : "bg-white/5 text-slate-400 hover:bg-white/10"
                      }`}
                    >
                      JPG
                    </button>
                  </div>
                  <span className="text-xs text-slate-500">
                    {downloadFormat === "jpg" ? "(Smaller file)" : "(Best quality)"}
                  </span>
                </div>
              </>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {!isDownloading && (
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-slate-300 hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleDownloadSelected}
              disabled={selectedIds.size === 0 || isDownloading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-magenta-violet text-white font-semibold hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100"
            >
              <Download className="w-4 h-4" />
              {isDownloading 
                ? `Downloading...` 
                : `Download ${selectedIds.size} Image${selectedIds.size !== 1 ? "s" : ""}`
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
