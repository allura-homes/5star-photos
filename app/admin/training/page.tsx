"use client"

import { useState, useEffect } from "react"
import { AppShell } from "@/components/app-shell"
import { getFeedbackStats, getAllFeedback, markAsExemplary, type FeedbackStats } from "@/lib/actions/feedback-actions"
import type { ModelFeedback, ModelProvider } from "@/lib/types"
import { MODELS, ACTIVE_MODELS } from "@/lib/constants/models"
import { ThumbsUp, ThumbsDown, Star, Filter, BarChart3, Loader2, ExternalLink } from "lucide-react"
import Image from "next/image"

// Access control: middleware (lib/supabase/proxy.ts) redirects non-admins
// away from /admin/* before this page renders.

const MODEL_LABELS: Record<ModelProvider, string> = Object.fromEntries(
  MODELS.map((m) => [m.provider, `${m.label} (${m.modelId})${m.active ? "" : " - retired"}`]),
) as Record<ModelProvider, string>

const MODEL_COLORS: Record<ModelProvider, string> = {
  openai: "#74AA9C",
  nano_banana_pro: "#FF6B35",
  openai_2: "#38BDF8",
  flux_2_pro: "#8B5CF6",
  openai_1_5: "#999999",
  openai_mini: "#666666",
}

export default function TrainingDashboard() {
  const [stats, setStats] = useState<FeedbackStats | null>(null)
  const [feedback, setFeedback] = useState<ModelFeedback[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedModel, setSelectedModel] = useState<ModelProvider | "all">("all")
  const [selectedType, setSelectedType] = useState<"all" | "thumbs_up" | "thumbs_down">("all")
  const [showExemplaryOnly, setShowExemplaryOnly] = useState(false)

  useEffect(() => {
    loadData()
  }, [selectedModel, selectedType, showExemplaryOnly])

  async function loadData() {
    setIsLoading(true)

    const [statsData, feedbackData] = await Promise.all([
      getFeedbackStats(),
      getAllFeedback({
        modelProvider: selectedModel === "all" ? undefined : selectedModel,
        feedbackType: selectedType === "all" ? undefined : selectedType,
        isExemplary: showExemplaryOnly ? true : undefined,
      }),
    ])

    setStats(statsData)
    setFeedback(feedbackData)
    setIsLoading(false)
  }

  async function handleToggleExemplary(feedbackId: string, currentValue: boolean) {
    await markAsExemplary(feedbackId, !currentValue)
    setFeedback((prev) => prev.map((f) => (f.id === feedbackId ? { ...f, is_exemplary: !currentValue } : f)))
  }

  const totalFeedback = stats ? Object.values(stats).reduce((sum, s) => sum + s.thumbs_up + s.thumbs_down, 0) : 0

  // Only show stat cards for models that have ever received feedback or are active.
  const statProviders = stats
    ? (Object.keys(stats) as ModelProvider[]).filter(
        (p) => ACTIVE_MODELS.some((m) => m.provider === p) || stats[p].thumbs_up + stats[p].thumbs_down > 0,
      )
    : []

  return (
    <AppShell>
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <BarChart3 className="w-8 h-8 text-[#FF3EDB]" />
              <h1 className="text-4xl font-bold text-white">Model Training Dashboard</h1>
            </div>
            <p className="text-lg text-[#C9CCDA]">
              Review feedback, mark exemplary outputs, and tune model behavior. {totalFeedback} ratings collected.
            </p>
          </div>

          {/* Stats Overview */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {statProviders.map((provider) => {
                const modelStats = stats[provider]
                const total = modelStats.thumbs_up + modelStats.thumbs_down
                const approvalRate = total > 0 ? Math.round((modelStats.thumbs_up / total) * 100) : 0

                return (
                  <div
                    key={provider}
                    className="glass-card rounded-2xl p-6"
                    style={{ borderLeft: `4px solid ${MODEL_COLORS[provider]}` }}
                  >
                    <h3 className="text-lg font-semibold text-white mb-4">{MODEL_LABELS[provider]}</h3>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <ThumbsUp className="w-5 h-5 text-[#27D980]" />
                          <span className="text-2xl font-bold text-[#27D980]">{modelStats.thumbs_up}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <ThumbsDown className="w-5 h-5 text-[#FF4D4D]" />
                          <span className="text-2xl font-bold text-[#FF4D4D]">{modelStats.thumbs_down}</span>
                        </div>
                      </div>
                    </div>
                    <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-[#27D980] rounded-full transition-all"
                        style={{ width: `${approvalRate}%` }}
                      />
                    </div>
                    <p className="text-sm text-[#C9CCDA] mt-2">
                      {approvalRate}% approval rate ({total} total)
                    </p>
                  </div>
                )
              })}
            </div>
          )}

          {/* Filters */}
          <div className="glass-card rounded-2xl p-4 mb-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-[#C9CCDA]" />
                <span className="text-white font-medium">Filters:</span>
              </div>

              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value as ModelProvider | "all")}
                className="px-4 py-2 rounded-xl bg-white/10 text-white border border-white/20 focus:border-[#FF3EDB] focus:outline-none"
              >
                <option value="all">All Models</option>
                {MODELS.map((m) => (
                  <option key={m.provider} value={m.provider}>
                    {MODEL_LABELS[m.provider]}
                  </option>
                ))}
              </select>

              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as "all" | "thumbs_up" | "thumbs_down")}
                className="px-4 py-2 rounded-xl bg-white/10 text-white border border-white/20 focus:border-[#FF3EDB] focus:outline-none"
              >
                <option value="all">All Feedback</option>
                <option value="thumbs_up">Thumbs Up Only</option>
                <option value="thumbs_down">Thumbs Down Only</option>
              </select>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showExemplaryOnly}
                  onChange={(e) => setShowExemplaryOnly(e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-white/10 text-[#FF3EDB] focus:ring-[#FF3EDB]"
                />
                <span className="text-white">Exemplary only</span>
              </label>

              <span className="text-[#C9CCDA] ml-auto">{feedback.length} results</span>
            </div>
          </div>

          {/* Feedback List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-[#FF3EDB] animate-spin" />
            </div>
          ) : feedback.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center">
              <p className="text-xl text-[#C9CCDA]">No feedback collected yet</p>
              <p className="text-[#C9CCDA] mt-2">Feedback will appear here as users rate model outputs</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {feedback.map((item) => (
                <div
                  key={item.id}
                  className={`glass-card rounded-2xl p-4 ${item.is_exemplary ? "ring-2 ring-[#FFB341]" : ""}`}
                >
                  <div className="flex gap-4">
                    {/* Original Image */}
                    <div className="relative w-32 h-24 rounded-lg overflow-hidden bg-[#2B2A3A] flex-shrink-0">
                      {item.original_url ? (
                        <Image
                          src={item.original_url || "/placeholder.svg"}
                          alt="Original"
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-[#C9CCDA] text-xs">No image</div>
                      )}
                      <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-xs">
                        Original
                      </div>
                    </div>

                    {/* Result Image */}
                    <div className="relative w-32 h-24 rounded-lg overflow-hidden bg-[#2B2A3A] flex-shrink-0">
                      {item.result_url ? (
                        <Image src={item.result_url || "/placeholder.svg"} alt="Result" fill className="object-cover" />
                      ) : (
                        <div className="flex items-center justify-center h-full text-[#C9CCDA] text-xs">No image</div>
                      )}
                      <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-xs">
                        Result
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-white font-medium truncate">{item.file_name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className="px-2 py-0.5 rounded text-xs font-medium"
                              style={{
                                backgroundColor: `${MODEL_COLORS[item.model_provider]}20`,
                                color: MODEL_COLORS[item.model_provider],
                              }}
                            >
                              {MODEL_LABELS[item.model_provider]}
                            </span>
                            <span className="text-xs text-[#C9CCDA]">v{item.variation_number}</span>
                            {item.style_mode && <span className="text-xs text-[#C9CCDA]">{item.style_mode}</span>}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Feedback indicator */}
                          <div
                            className={`flex items-center gap-1 px-2 py-1 rounded-lg ${
                              item.feedback_type === "thumbs_up"
                                ? "bg-[#27D980]/20 text-[#27D980]"
                                : "bg-[#FF4D4D]/20 text-[#FF4D4D]"
                            }`}
                          >
                            {item.feedback_type === "thumbs_up" ? (
                              <ThumbsUp className="w-4 h-4" />
                            ) : (
                              <ThumbsDown className="w-4 h-4" />
                            )}
                          </div>

                          {/* Mark as exemplary button */}
                          <button
                            onClick={() => handleToggleExemplary(item.id, item.is_exemplary)}
                            className={`p-2 rounded-lg transition-colors ${
                              item.is_exemplary
                                ? "bg-[#FFB341]/20 text-[#FFB341]"
                                : "bg-white/5 text-[#C9CCDA] hover:bg-white/10"
                            }`}
                            title={item.is_exemplary ? "Remove exemplary status" : "Mark as exemplary"}
                          >
                            <Star className={`w-4 h-4 ${item.is_exemplary ? "fill-current" : ""}`} />
                          </button>

                          {/* View job link */}
                          {item.job_id && (
                            <a
                              href={`/preview/${item.job_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 rounded-lg bg-white/5 text-[#C9CCDA] hover:bg-white/10 transition-colors"
                              title="View job"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </div>

                      <p className="text-xs text-[#C9CCDA] mt-2">
                        {new Date(item.created_at).toLocaleDateString()} at{" "}
                        {new Date(item.created_at).toLocaleTimeString()}
                      </p>

                      {item.feedback_notes && (
                        <p className="text-sm text-[#C9CCDA] mt-2 italic">"{item.feedback_notes}"</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
    </AppShell>
  )
}
