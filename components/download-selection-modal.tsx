"use client"

import { useState } from "react"
import Image from "next/image"
import { X, Download, Check, Loader2, CheckCircle2 } from "lucide-react"

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
}

export function DownloadSelectionModal({
  isOpen,
  onClose,
  variations,
  originalFilename,
}: DownloadSelectionModalProps) {
  // Filter out variations without valid URLs
  const validVariations = variations.filter(v => v.preview_url && v.preview_url.length > 0)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(validVariations.map(v => v.id)))
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<Record<string, "pending" | "downloading" | "complete" | "error">>({})
  const [currentDownload, setCurrentDownload] = useState<string | null>(null)

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

  const downloadImage = async (variation: DownloadableVariation): Promise<boolean> => {
    try {
      // Validate the URL exists
      if (!variation.preview_url) {
        console.error("Download error: No preview URL for variation", variation.id)
        return false
      }
      
      // First, upscale the image for hi-res download
      let downloadUrl = variation.preview_url
      try {
        const upscaleResponse = await fetch("/api/upscale", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            imageUrl: variation.preview_url,
            scale: 2, // 2x upscale for hi-res
          }),
        })
        
        if (upscaleResponse.ok) {
          const upscaleResult = await upscaleResponse.json()
          if (upscaleResult.url) {
            downloadUrl = upscaleResult.url
            console.log("[v0] Using upscaled image for download")
          }
        }
      } catch (upscaleError) {
        console.warn("[v0] Upscale failed, using original:", upscaleError)
        // Continue with original URL
      }
      
      // Fetch the (potentially upscaled) image
      const response = await fetch(downloadUrl)
      if (!response.ok) throw new Error("Failed to fetch image")
      
      const blob = await response.blob()
      
      // Create download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      
      // Generate filename: originalname_modelname_hires.png
      const baseName = (originalFilename || "image").replace(/\.[^/.]+$/, "")
      const modelName = (variation.modelLabel || "unknown").replace(/\s+/g, "_").toLowerCase()
      link.download = `${baseName}_${modelName}_hires.png`
      
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      return true
    } catch (error) {
      console.error("Download error:", error)
      return false
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
    
    // Download sequentially with delay between each
    for (const variation of selectedVariations) {
      setCurrentDownload(variation.id)
      setDownloadProgress(prev => ({ ...prev, [variation.id]: "downloading" }))
      
      const success = await downloadImage(variation)
      
      setDownloadProgress(prev => ({ 
        ...prev, 
        [variation.id]: success ? "complete" : "error" 
      }))
      
      // Small delay between downloads to prevent browser issues
      if (selectedVariations.indexOf(variation) < selectedVariations.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 800))
      }
    }
    
    setCurrentDownload(null)
    setIsDownloading(false)
    
    // Close modal after brief delay to show completion
    setTimeout(() => {
      onClose()
      setDownloadProgress({})
    }, 1500)
  }

  const completedCount = Object.values(downloadProgress).filter(s => s === "complete").length

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
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {validVariations.map((variation) => {
              const isSelected = selectedIds.has(variation.id)
              const status = downloadProgress[variation.id]
              
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
        </div>
        
        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-white/10 bg-white/5">
          {isDownloading ? (
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-fuchsia-400 animate-spin" />
              <span className="text-white">
                Downloading {completedCount + 1} of {selectedIds.size}...
              </span>
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              High-resolution images without watermarks
            </p>
          )}
          
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
