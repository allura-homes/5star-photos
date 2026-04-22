"use client"

import { Check, AlertCircle, ThumbsUp, ThumbsDown } from "lucide-react"
import type { FileItem, Variation, ModelProvider } from "@/lib/types"
import Image from "next/image"
import { submitFeedback } from "@/lib/actions/feedback-actions"
import { useState } from "react"

interface PreviewGridProps {
  files: FileItem[]
  jobId: string // Added jobId for feedback
  styleMode?: string // Added styleMode for feedback
  onToggleApprove: (fileIndex: number, variationIndex: number) => void
  onFileClick: (file: FileItem, variation?: Variation) => void
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

export function PreviewGrid({ files, jobId, styleMode, onToggleApprove, onFileClick }: PreviewGridProps) {
  const [feedbackState, setFeedbackState] = useState<Record<string, "thumbs_up" | "thumbs_down" | null>>({})

  const flattenedItems = files.flatMap((file, fileIndex) => {
    if (file.variations && file.variations.length > 0) {
      return file.variations.map((variation, varIndex) => ({
        file,
        fileIndex,
        variation,
        variationIndex: varIndex,
        displayName: `${file.name.replace(/\.[^/.]+$/, "")} - v${variation.variation_number}`,
      }))
    }
    return [
      {
        file,
        fileIndex,
        variation: null,
        variationIndex: -1,
        displayName: file.name,
      },
    ]
  })

  const handleFeedback = async (
    file: FileItem,
    variation: Variation | null,
    feedbackType: "thumbs_up" | "thumbs_down",
  ) => {
    if (!variation) return

    const key = `${file.name}-${variation.variation_number}`
    const currentFeedback = feedbackState[key] || variation.feedback

    // Toggle off if clicking same feedback
    if (currentFeedback === feedbackType) {
      setFeedbackState((prev) => ({ ...prev, [key]: null }))
      return
    }

    setFeedbackState((prev) => ({ ...prev, [key]: feedbackType }))

    await submitFeedback(
      jobId,
      file.name,
      getModelProvider(variation.variation_number),
      variation.variation_number,
      feedbackType,
      file.original_url,
      variation.preview_url,
      styleMode,
    )
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
      {flattenedItems.map((item, displayIndex) => {
        const variation = item.variation
        const displayData = variation || item.file
        const feedbackKey = variation ? `${item.file.name}-${variation.variation_number}` : ""
        const currentFeedback = feedbackKey ? (feedbackState[feedbackKey] ?? variation?.feedback) : null

        return (
          <div
            key={`${item.fileIndex}-${item.variationIndex}-${displayIndex}`}
            className="glass-card rounded-2xl overflow-hidden group cursor-pointer hover:scale-[1.02] transition-all duration-300"
            onClick={() => onFileClick(item.file, variation || undefined)}
          >
            {/* Image */}
            <div className="relative aspect-[3/2] bg-[#2B2A3A]">
              <Image
                src={displayData.preview_url || "/placeholder.svg?height=400&width=600"}
                alt={item.displayName}
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              {variation && (
                <div className="absolute top-3 left-3 px-2 py-1 rounded-lg bg-[#FF3EDB]/90 backdrop-blur-sm text-white text-xs font-semibold">
                  v{variation.variation_number}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{item.displayName}</p>
                  <p className="text-sm text-[#C9CCDA]">{(item.file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>

                {/* QA Badge */}
                <div
                  className={`px-2 py-1 rounded-lg text-xs font-medium ml-2 flex items-center gap-1 ${
                    displayData.qa_status === "pass"
                      ? "bg-[#27D980]/20 text-[#27D980]"
                      : "bg-[#FFB341]/20 text-[#FFB341]"
                  }`}
                >
                  {displayData.qa_status === "pass" ? (
                    <>
                      <Check className="w-3 h-3" />
                      QA Pass
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3 h-3" />
                      QA Notes
                    </>
                  )}
                </div>
              </div>

              {variation && (
                <div className="flex items-center gap-2 mb-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleFeedback(item.file, variation, "thumbs_up")
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-xl transition-all ${
                      currentFeedback === "thumbs_up"
                        ? "bg-[#27D980]/30 text-[#27D980] border border-[#27D980]/50"
                        : "bg-white/5 text-[#C9CCDA] hover:bg-white/10"
                    }`}
                  >
                    <ThumbsUp className="w-4 h-4" />
                    <span className="text-xs font-medium">Good</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleFeedback(item.file, variation, "thumbs_down")
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-xl transition-all ${
                      currentFeedback === "thumbs_down"
                        ? "bg-[#FF4D4D]/30 text-[#FF4D4D] border border-[#FF4D4D]/50"
                        : "bg-white/5 text-[#C9CCDA] hover:bg-white/10"
                    }`}
                  >
                    <ThumbsDown className="w-4 h-4" />
                    <span className="text-xs font-medium">Poor</span>
                  </button>
                </div>
              )}

              {/* Approve Checkbox */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleApprove(item.fileIndex, item.variationIndex)
                }}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
              >
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                    displayData.approved ? "bg-[#FF3EDB] border-[#FF3EDB]" : "border-white/40"
                  }`}
                >
                  {displayData.approved && <Check className="w-3 h-3 text-white" />}
                </div>
                <span className="text-sm text-white font-medium">{displayData.approved ? "Approved" : "Approve"}</span>
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
