"use client"

import type React from "react"

import { X, ChevronLeft, ChevronRight, Split, ThumbsUp, ThumbsDown } from "lucide-react"
import type { FileItem, Variation, ModelProvider } from "@/lib/types"
import Image from "next/image"
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { submitFeedback } from "@/lib/actions/feedback-actions"

const PROVIDER_LABELS: Record<number, string> = {
  1: "Nano Banana Pro",
  2: "GPT Image 1",
  3: "GPT Image 1 Mini",
  4: "GPT Image 1.5",
}

function getModelProvider(variationNumber: number): ModelProvider {
  switch (variationNumber) {
    case 1:
      return "nano_banana_pro"
    case 2:
      return "openai"
    case 3:
      return "openai_mini"
    case 4:
      return "openai_1_5"
    default:
      return "nano_banana_pro"
  }
}

interface PreviewModalProps {
  file: FileItem
  variation: Variation | null
  onClose: () => void
  jobId: string
  styleMode?: string
}

export function PreviewModal({ file, variation: initialVariation, onClose, jobId, styleMode }: PreviewModalProps) {
  const [selectedVariation, setSelectedVariation] = useState<Variation | null>(initialVariation || null)
  const [isComparing, setIsComparing] = useState(false)
  const [feedbackState, setFeedbackState] = useState<Record<string, "thumbs_up" | "thumbs_down" | null>>({})

  const versions = [
    { id: "original", label: "Original", value: null },
    ...(file.variations || []).map((v) => ({
      id: `v${v.variation_number}`,
      label: `v${v.variation_number}`,
      sublabel: PROVIDER_LABELS[v.variation_number] || `Provider ${v.variation_number}`,
      value: v,
    })),
  ]

  useEffect(() => {
    setSelectedVariation(initialVariation || null)
  }, [initialVariation])

  const isOriginal = selectedVariation === null
  const displayData = selectedVariation || file

  const currentFeedbackKey = selectedVariation ? `${file.name}-${selectedVariation.variation_number}` : ""
  const currentFeedback = currentFeedbackKey ? (feedbackState[currentFeedbackKey] ?? selectedVariation?.feedback) : null

  const handleFeedback = async (feedbackType: "thumbs_up" | "thumbs_down") => {
    if (!selectedVariation) return

    const key = `${file.name}-${selectedVariation.variation_number}`
    const existingFeedback = feedbackState[key] || selectedVariation.feedback

    if (existingFeedback === feedbackType) {
      setFeedbackState((prev) => ({ ...prev, [key]: null }))
      return
    }

    setFeedbackState((prev) => ({ ...prev, [key]: feedbackType }))

    await submitFeedback(
      jobId,
      file.name,
      getModelProvider(selectedVariation.variation_number),
      selectedVariation.variation_number,
      feedbackType,
      file.original_url,
      selectedVariation.preview_url,
      styleMode,
    )
  }

  const getImageUrl = (variation: Variation | null) => {
    if (!variation) {
      return file.original_url || file.preview_url || "/placeholder.svg?height=800&width=1200"
    }
    return variation.preview_url || "/placeholder.svg?height=800&width=1200"
  }

  const displayName = isOriginal
    ? `${file.name} (Original)`
    : `${file.name.replace(/\.[^/.]+$/, "")} - v${selectedVariation.variation_number}`

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        const currentIndex = versions.findIndex((v) => v.value === selectedVariation)
        if (currentIndex > 0) {
          setSelectedVariation(versions[currentIndex - 1].value)
        }
      } else if (e.key === "ArrowRight") {
        const currentIndex = versions.findIndex((v) => v.value === selectedVariation)
        if (currentIndex < versions.length - 1) {
          setSelectedVariation(versions[currentIndex + 1].value)
        }
      } else if (e.key === "Escape") {
        onClose()
      } else if (e.key === " " && selectedVariation !== null) {
        e.preventDefault()
        setIsComparing((prev) => !prev)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [selectedVariation, onClose])

  const handlePrevious = (e: React.MouseEvent) => {
    e.stopPropagation()
    const currentIndex = versions.findIndex((v) => v.value === selectedVariation)
    if (currentIndex > 0) {
      setSelectedVariation(versions[currentIndex - 1].value)
    }
  }

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation()
    const currentIndex = versions.findIndex((v) => v.value === selectedVariation)
    if (currentIndex < versions.length - 1) {
      setSelectedVariation(versions[currentIndex + 1].value)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/60 backdrop-blur-xl animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-7xl h-[90vh] glass-card-strong rounded-[2rem] overflow-hidden flex flex-col shadow-2xl ring-1 ring-white/20"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 shrink-0 bg-white/5 backdrop-blur-md border-b border-white/10">
          <div className="flex items-center gap-6">
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">{file.name}</h2>
              <p className="text-sm text-[#C9CCDA]">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>

            <div className="flex items-center bg-black/30 p-1.5 rounded-2xl border border-white/10 backdrop-blur-md">
              {versions.map((version) => (
                <button
                  key={version.id}
                  onClick={() => {
                    setSelectedVariation(version.value)
                    setIsComparing(false)
                  }}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 flex flex-col items-center min-w-[70px]",
                    version.value === selectedVariation
                      ? "bg-[#FF3EDB] text-white shadow-lg shadow-[#FF3EDB]/25 scale-105"
                      : "text-[#C9CCDA] hover:text-white hover:bg-white/10",
                  )}
                  title={"sublabel" in version ? version.sublabel : undefined}
                >
                  <span>{version.label}</span>
                  {"sublabel" in version && (
                    <span
                      className={cn(
                        "text-[10px] font-normal mt-0.5 opacity-70",
                        version.value === selectedVariation ? "text-white/80" : "text-[#C9CCDA]",
                      )}
                    >
                      {version.sublabel}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!isOriginal && selectedVariation && (
              <div className="flex items-center gap-2 mr-2">
                <button
                  onClick={() => handleFeedback("thumbs_up")}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-xl transition-all border",
                    currentFeedback === "thumbs_up"
                      ? "bg-[#27D980]/30 text-[#27D980] border-[#27D980]/50"
                      : "bg-white/5 text-[#C9CCDA] border-transparent hover:bg-white/10 hover:text-white",
                  )}
                >
                  <ThumbsUp className="w-4 h-4" />
                  <span className="text-sm font-medium">Good</span>
                </button>
                <button
                  onClick={() => handleFeedback("thumbs_down")}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-xl transition-all border",
                    currentFeedback === "thumbs_down"
                      ? "bg-[#FF4D4D]/30 text-[#FF4D4D] border-[#FF4D4D]/50"
                      : "bg-white/5 text-[#C9CCDA] border-transparent hover:bg-white/10 hover:text-white",
                  )}
                >
                  <ThumbsDown className="w-4 h-4" />
                  <span className="text-sm font-medium">Poor</span>
                </button>
              </div>
            )}

            {!isOriginal && (
              <button
                onClick={() => setIsComparing(!isComparing)}
                className={cn(
                  "px-4 py-2 rounded-xl flex items-center gap-2 transition-all border",
                  isComparing
                    ? "bg-white/20 text-white border-white/20"
                    : "bg-transparent text-[#C9CCDA] border-transparent hover:bg-white/10 hover:text-white",
                )}
              >
                <Split className="w-4 h-4" />
                <span className="text-sm font-medium">Compare Original</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors border border-white/10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Image Container */}
        <div className="relative flex-1 overflow-hidden group bg-gradient-to-b from-black/20 to-black/40">
          <div className="absolute inset-0 flex items-center justify-center p-8">
            <div className="relative w-full h-full flex items-center justify-center gap-4">
              {isComparing && !isOriginal ? (
                <>
                  <div className="relative flex-1 h-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                    <div className="absolute top-4 left-4 z-10 px-3 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white text-xs font-bold border border-white/10">
                      Original
                    </div>
                    <Image
                      src={getImageUrl(null) || "/placeholder.svg"}
                      alt="Original"
                      fill
                      className="object-contain"
                      priority
                    />
                  </div>
                  <div className="relative flex-1 h-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl ring-2 ring-[#FF3EDB]/50">
                    <div className="absolute top-4 left-4 z-10 px-3 py-1 rounded-lg bg-[#FF3EDB] text-white text-xs font-bold shadow-lg">
                      v{selectedVariation?.variation_number}
                    </div>
                    <Image
                      src={getImageUrl(selectedVariation) || "/placeholder.svg"}
                      alt="Variation"
                      fill
                      className="object-contain"
                      priority
                    />
                  </div>
                </>
              ) : (
                <div className="relative w-full h-full">
                  <Image
                    src={getImageUrl(selectedVariation) || "/placeholder.svg"}
                    alt={displayName}
                    fill
                    className="object-contain drop-shadow-2xl"
                    priority
                  />
                </div>
              )}
            </div>
          </div>

          {/* Navigation Arrows (Hidden in compare mode) */}
          {!isComparing && (
            <>
              <button
                onClick={handlePrevious}
                className="absolute left-6 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-black/40 hover:bg-[#FF3EDB] text-white flex items-center justify-center backdrop-blur-md border border-white/10 transition-all hover:scale-110 hover:shadow-lg hover:shadow-[#FF3EDB]/30 disabled:opacity-0 disabled:pointer-events-none"
                disabled={versions.findIndex((v) => v.value === selectedVariation) === 0}
              >
                <ChevronLeft className="w-8 h-8" />
              </button>

              <button
                onClick={handleNext}
                className="absolute right-6 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-black/40 hover:bg-[#FF3EDB] text-white flex items-center justify-center backdrop-blur-md border border-white/10 transition-all hover:scale-110 hover:shadow-lg hover:shadow-[#FF3EDB]/30 disabled:opacity-0 disabled:pointer-events-none"
                disabled={versions.findIndex((v) => v.value === selectedVariation) === versions.length - 1}
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            </>
          )}
        </div>

        {/* QA Notes */}
        {((isOriginal ? file.qa_notes : selectedVariation?.qa_notes) || []).length > 0 && (
          <div className="p-6 bg-white/5 backdrop-blur-md border-t border-white/10 shrink-0">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-6 rounded-full bg-[#FFB341]" />
              <h3 className="text-lg font-bold text-white">QA Notes</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {((isOriginal ? file.qa_notes : selectedVariation?.qa_notes) || []).map((note, index) => (
                <div key={index} className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="w-2 h-2 rounded-full bg-[#FFB341] mt-2 shrink-0 shadow-[0_0_8px_rgba(255,179,65,0.5)]" />
                  <span className="text-[#C9CCDA] text-sm leading-relaxed">{note}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
