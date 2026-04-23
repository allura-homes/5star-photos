"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Image from "next/image"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { useAuthContext } from "@/lib/contexts/auth-context"
import { getImageById, transformImage } from "@/lib/actions/image-actions"
import type { UserImage, ModelProvider, EnhancementPreferences } from "@/lib/types"
import { TOKEN_COSTS, DEFAULT_ENHANCEMENT_PREFERENCES } from "@/lib/types"
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  Download,
  ChevronLeft,
  ChevronRight,
  ThumbsUp,
  ThumbsDown,
  Bookmark,
  Check,
  Settings,
  Settings2,
  RefreshCw,
  X,
  History,
  Eye,
  Coins,
  Home,
  Mountain,
  Split,
  MessageSquare,
  ChevronDown,
} from "lucide-react"
import { submitFeedback } from "@/lib/actions/feedback-actions"
import { SingleImagePreferencesModal } from "@/components/single-image-preferences-modal"
import { DownloadSelectionModal } from "@/components/download-selection-modal"

interface PreviewVariation {
  model: ModelProvider
  modelLabel: string
  preview_url: string | null
  is_loading: boolean
  error?: string
}

const MODEL_CONFIG: { model: ModelProvider; label: string }[] = [
  { model: "openai_1_5", label: "V1" },
  { model: "nano_banana_pro", label: "V2" },
  { model: "flux_2_pro", label: "V3" },
  { model: "openai_2", label: "V4" },
]

export default function TransformPage() {
  const params = useParams()
  const imageId = params.imageId as string
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, profile, refreshProfile } = useAuthContext()

  const [image, setImage] = useState<UserImage | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Transform state
  const [isTransforming, setIsTransforming] = useState(false)
  const [previews, setPreviews] = useState<PreviewVariation[]>([])
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState(0)
  const [hasTransformed, setHasTransformed] = useState(false)

  // Preferences
  const [preferences, setPreferences] = useState<EnhancementPreferences>(DEFAULT_ENHANCEMENT_PREFERENCES)
  const [showPreferences, setShowPreferences] = useState(false)

  // Feedback state
  const [feedbackState, setFeedbackState] = useState<Record<string, "thumbs_up" | "thumbs_down" | null>>({})

  // Saving state
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  
  // Compare mode
  const [isComparing, setIsComparing] = useState(false)
  const [compareMode, setCompareMode] = useState(false)
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([])
  
  // Download modal
  const [showDownloadModal, setShowDownloadModal] = useState(false)
  
  // Current prompt display (for showing what instructions were used)
  const [currentPrompt, setCurrentPrompt] = useState<string | null>(null)
  const [isPromptExpanded, setIsPromptExpanded] = useState(false)

  const loadImage = useCallback(async () => {
    setIsLoading(true)
    const { image: fetchedImage, error: fetchError } = await getImageById(imageId)

    if (fetchError || !fetchedImage) {
      setError(fetchError || "Image not found")
      setIsLoading(false)
      return
    }

    setImage(fetchedImage)
    
    // Don't auto-load variations into preview - keep the initial state clean
    // Variations are shown in the "Previous Transformations" section below
    // Users can click on them to load into the main preview area
    
    setIsLoading(false)
  }, [imageId])

  useEffect(() => {
    if (authLoading) return

    if (!isAuthenticated) {
      router.push(`/auth/login?redirect=/transform/${imageId}`)
      return
    }

    loadImage()
  }, [authLoading, isAuthenticated, imageId, router, loadImage])

  const runTransformation = useCallback(async (customPreferences?: EnhancementPreferences) => {
    if (!image) return

    // Use passed preferences or fall back to state
    const activePreferences = customPreferences || preferences
    
    setIsTransforming(true)
    setHasTransformed(true)
    setCurrentPrompt(null) // Clear prompt when starting new transformation
    setIsPromptExpanded(false)

    setPreviews(
      MODEL_CONFIG.map(({ model, label }) => ({
        model,
        modelLabel: label,
        preview_url: null,
        is_loading: true,
      })),
    )

    if (!image.storage_path) {
      console.error("[v0] No storage_path found for image")
      setIsTransforming(false)
      return
    }

    // Log the preferences being used for debugging
    console.log("[v0] Running transformation with preferences:", JSON.stringify(activePreferences))
    console.log("[v0] additionalInstructions:", activePreferences.additionalInstructions || "(none)")

    let imagePrompt = ""
    try {
      const artDirectorResponse = await fetch("/api/art-director", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          original_url: image.storage_path,
          filename: image.original_filename,
          classification: image.classification,
          style_mode: "standard",
          user_preferences: activePreferences,
        }),
      })

      if (artDirectorResponse.ok) {
        const artDirectorResult = await artDirectorResponse.json()
        imagePrompt = artDirectorResult.imagePrompt || ""
        console.log("[v0] Art Director prompt received, length:", imagePrompt.length)
      } else {
        console.warn("[v0] Art Director call failed, using default prompt")
        imagePrompt = `Enhance this ${image.classification || "real estate"} photo with professional quality: improve lighting, enhance colors, increase sharpness, and make the image more vibrant while keeping the exact same scene and composition.`
      }
    } catch (err) {
      console.warn("[v0] Art Director error, using default prompt:", err)
      imagePrompt = `Enhance this ${image.classification || "real estate"} photo with professional quality: improve lighting, enhance colors, increase sharpness, and make the image more vibrant while keeping the exact same scene and composition.`
    }

    const modelPromises = MODEL_CONFIG.map(async ({ model, label }, index) => {
      try {
        console.log(`[v0] Starting ${label} (${model}) - variation ${index + 1}`)
        
        // Use AbortController with 3-minute timeout for slow AI models (V1/V4 can take 60-120s)
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 180000) // 3 minutes
        
        const response = await fetch("/api/edit-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            original_url: image.storage_path,
            filename: image.original_filename,
            model,
            provider: model,
            variation_number: index + 1,
            classification: image.classification,
            preferences: activePreferences,
            apply_watermark: true,
            use_ai_models: true,
            image_prompt: imagePrompt,
          }),
          signal: controller.signal,
        })
        
        clearTimeout(timeoutId)

        // Check for non-OK responses before parsing JSON
        if (!response.ok) {
          const errorText = await response.text()
          console.error(`[v0] ${label} HTTP error ${response.status}:`, errorText.substring(0, 100))
          return {
            index,
            preview_url: null,
            error: `HTTP ${response.status}: ${errorText.substring(0, 50)}`,
          }
        }

        const result = await response.json()
        
        if (result.error) {
          console.error(`[v0] ${label} error:`, result.error, result.details)
        } else {
          console.log(`[v0] ${label} succeeded`)
        }

        return {
          index,
          preview_url: result.url || null,
          error: result.error ? `${result.error}: ${result.details || ''}` : undefined,
        }
      } catch (err) {
        console.error(`[v0] ${label} fetch error:`, err)
        return {
          index,
          preview_url: null,
          error: `Failed to generate: ${err instanceof Error ? err.message : String(err)}`,
        }
      }
    })

    // Wait for all models to complete and update state once
    const results = await Promise.all(modelPromises)

    setPreviews((prev) =>
      prev.map((p, idx) => {
        const result = results.find((r) => r.index === idx)
        return result
          ? {
              ...p,
              preview_url: result.preview_url,
              is_loading: false,
              error: result.error,
            }
          : { ...p, is_loading: false }
      }),
    )

    setIsTransforming(false)
    refreshProfile() // Refresh token count
    
    // Auto-save successful transformations to the database
    // This ensures users can return to their transformations later
    const successfulResults = results.filter(r => r.preview_url && !r.error)
    console.log("[v0] Auto-save check - successful results:", successfulResults.length, "profile?.id:", profile?.id, "imageId:", imageId)
    
    if (successfulResults.length > 0) {
      console.log("[v0] Starting auto-save for", successfulResults.length, "transformations")
      
      // Save each successful transformation in the background
      for (const result of successfulResults) {
        const modelConfig = MODEL_CONFIG[result.index]
        console.log(`[v0] Auto-saving ${modelConfig.label}...`)
        try {
          let imageDataToSave = result.preview_url
          
          // For large base64 images (>1MB), upload to Vercel Blob first to avoid payload limits
          if (result.preview_url?.startsWith("data:") && result.preview_url.length > 1_000_000) {
            console.log(`[v0] ${modelConfig.label} image is large (${(result.preview_url.length / 1024 / 1024).toFixed(2)}MB), uploading to Blob first...`)
            try {
              const blobResponse = await fetch("/api/upload-blob", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  base64Data: result.preview_url,
                  filename: `${imageId}-${modelConfig.model}-${Date.now()}.jpg`,
                }),
              })
              if (blobResponse.ok) {
                const blobResult = await blobResponse.json()
                imageDataToSave = blobResult.url
                console.log(`[v0] ${modelConfig.label} uploaded to Blob: ${blobResult.url.substring(0, 60)}...`)
              } else {
                console.error(`[v0] Blob upload failed for ${modelConfig.label}:`, await blobResponse.text())
              }
            } catch (blobErr) {
              console.error(`[v0] Blob upload error for ${modelConfig.label}:`, blobErr)
            }
          }
          
          const saveBody = {
            parentImageId: imageId,
            imageData: imageDataToSave,
            sourceModel: modelConfig.model,
            transformationPrompt: imagePrompt,
            userId: profile?.id, // May be undefined, API will try to get from parent image
          }
          console.log(`[v0] Save body for ${modelConfig.label}:`, {
            parentImageId: saveBody.parentImageId,
            sourceModel: saveBody.sourceModel,
            userId: saveBody.userId,
            imageDataLength: saveBody.imageData?.length || 0,
          })
          
          const saveResponse = await fetch("/api/save-variation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(saveBody),
          })
          console.log(`[v0] Auto-save response for ${modelConfig.label}:`, saveResponse.status)
          if (!saveResponse.ok) {
            const errorText = await saveResponse.text()
            console.error(`[v0] Auto-save failed for ${modelConfig.label}:`, errorText.substring(0, 300))
          } else {
            const saveResult = await saveResponse.json()
            console.log(`[v0] Auto-save SUCCESS for ${modelConfig.label}:`, saveResult.image?.id)
          }
        } catch (saveErr) {
          console.error(`[v0] Auto-save error for ${modelConfig.label}:`, saveErr)
        }
      }
      
      // Reload image to show saved variations
      console.log("[v0] Reloading image to show saved variations...")
      await loadImage()
    }
  }, [image, imageId, preferences, refreshProfile, loadImage, profile])

  const handleSaveVariation = async (previewIndex: number) => {
    const preview = previews[previewIndex]
    if (!preview.preview_url || !image) return

    setIsSaving(true)

    try {
      let imageDataToSave = preview.preview_url
      
      // For large base64 images (>1MB), upload to Vercel Blob first to avoid payload limits
      if (preview.preview_url.startsWith("data:") && preview.preview_url.length > 1_000_000) {
        console.log(`[v0] Manual save: image is large, uploading to Blob first...`)
        const blobResponse = await fetch("/api/upload-blob", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            base64Data: preview.preview_url,
            filename: `${imageId}-${preview.model}-${Date.now()}.jpg`,
          }),
        })
        if (blobResponse.ok) {
          const blobResult = await blobResponse.json()
          imageDataToSave = blobResult.url
          console.log(`[v0] Manual save: uploaded to Blob`)
        }
      }
      
      // Use API route instead of server action to handle large base64 images
      const response = await fetch("/api/save-variation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentImageId: imageId,
          imageData: imageDataToSave,
          sourceModel: preview.model,
          transformationPrompt: null,
          userId: profile?.id,
        }),
      })

      const result = await response.json()

      if (!response.ok || result.error) {
        alert(result.error || "Failed to save variation")
      } else {
        setSaveSuccess(preview.modelLabel)
        refreshProfile()
        // Reload image to show new variation
        await loadImage()
      }
    } catch (err) {
      console.error("[v0] Save variation error:", err)
      alert("Failed to save variation")
    }

    setIsSaving(false)
  }

  const handleFeedback = async (previewIndex: number, feedbackType: "thumbs_up" | "thumbs_down") => {
    const preview = previews[previewIndex]
    const key = `${imageId}-${preview.model}`
    const current = feedbackState[key]

    if (current === feedbackType) {
      setFeedbackState((prev) => ({ ...prev, [key]: null }))
      return
    }

    setFeedbackState((prev) => ({ ...prev, [key]: feedbackType }))

    await submitFeedback(
      imageId,
      image?.original_filename || "",
      preview.model,
      previewIndex + 1,
      feedbackType,
      image?.storage_path,
      preview.preview_url || undefined,
      undefined, // styleMode
      undefined, // feedbackNotes
      true, // isImageFeedback - use image_id column instead of job_id
    )
  }

  const selectedPreview = previews[selectedPreviewIndex]
  
  // Toggle a variation for compare mode (max 3)
  const toggleCompareSelection = (variationId: string) => {
    setSelectedForCompare(prev => {
      if (prev.includes(variationId)) {
        return prev.filter(id => id !== variationId)
      }
      if (prev.length >= 3) {
        return prev // Max 3 selections
      }
      return [...prev, variationId]
    })
  }
  
  // Get selected variations for compare view
  const compareVariations = image?.variations?.filter(v => selectedForCompare.includes(v.id)) || []

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#FF3EDB] animate-spin" />
      </div>
    )
  }

  if (error || !image) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || "Image not found"}</p>
          <button
            onClick={() => router.push("/library")}
            className="px-4 py-2 rounded-xl bg-white/10 text-white hover:bg-white/20"
          >
            Back to Library
          </button>
        </div>
      </div>
    )
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
                <button
                  onClick={() => router.push("/library")}
                  className="p-2 rounded-xl hover:bg-white/10 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-slate-400" />
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-white">{image.original_filename}</h1>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        image.classification === "indoor"
                          ? "bg-blue-500/20 text-blue-400"
                          : image.classification === "outdoor"
                            ? "bg-green-500/20 text-green-400"
                            : "bg-slate-500/20 text-slate-400"
                      }`}
                    >
                      {image.classification === "indoor" ? (
                        <Home className="w-3 h-3" />
                      ) : image.classification === "outdoor" ? (
                        <Mountain className="w-3 h-3" />
                      ) : null}
                      {image.classification}
                    </span>
                  </div>
                </div>
              </div>

              {/* Token balance */}
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10">
                <Coins className="w-4 h-4 text-amber-400" />
                <span className="text-white font-medium">{profile?.tokens || 0}</span>
                <span className="text-slate-400 text-sm">tokens</span>
              </div>
            </div>

            {/* Main content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Original image */}
              <div className="glass-card rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-white/10">
                  <h2 className="text-white font-medium">Original</h2>
                </div>
                <div className="relative aspect-[4/3]">
                  <Image
                    src={image.storage_path || "/placeholder.svg"}
                    alt={image.original_filename}
                    fill
                    className="object-contain bg-black/50"
                  />
                </div>
              </div>

              {/* Preview / Transform panel */}
              <div className="glass-card rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                  <h2 className="text-white font-medium">
                    {hasTransformed ? `Preview: ${selectedPreview?.modelLabel || ""}` : "Transform"}
                  </h2>
                  {hasTransformed && previews.length > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedPreviewIndex((i) => Math.max(0, i - 1))}
                        disabled={selectedPreviewIndex === 0}
                        className="p-1 rounded hover:bg-white/10 disabled:opacity-30"
                      >
                        <ChevronLeft className="w-5 h-5 text-slate-400" />
                      </button>
                      <span className="text-sm text-slate-400">
                        {selectedPreviewIndex + 1} / {previews.length}
                      </span>
                      <button
                        onClick={() => setSelectedPreviewIndex((i) => Math.min(previews.length - 1, i + 1))}
                        disabled={selectedPreviewIndex === previews.length - 1}
                        className="p-1 rounded hover:bg-white/10 disabled:opacity-30"
                      >
                        <ChevronRight className="w-5 h-5 text-slate-400" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="relative aspect-[4/3] bg-[#1a1a2e]">
                  {!hasTransformed ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
                      <Sparkles className="w-12 h-12 text-[#FF3EDB]/50 mb-4" />
                      <p className="text-slate-400 text-center mb-6">
                        Click Transform to generate AI-enhanced previews
                      </p>
                      <div className="flex flex-col sm:flex-row items-center gap-3">
                          <button
                            onClick={() => runTransformation()}
                            disabled={isTransforming}
                            className="flex items-center gap-2 px-6 py-3 rounded-xl gradient-magenta-violet text-white font-semibold hover:scale-105 transition-all glow-magenta"
                        >
                          <Sparkles className="w-4 h-4" />
                          Transform (Free)
                        </button>
                        <button
                          onClick={() => setShowPreferences(true)}
                          disabled={isTransforming}
                          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/10 border border-white/20 text-white font-medium hover:bg-white/20 transition-all"
                        >
                          <Settings2 className="w-4 h-4" />
                          Custom Options
                        </button>
                      </div>
                    </div>
                  ) : selectedPreview?.is_loading ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 text-[#FF3EDB] animate-spin" />
                    </div>
                  ) : selectedPreview?.error ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <p className="text-red-400">{selectedPreview.error}</p>
                    </div>
                  ) : selectedPreview?.preview_url ? (
                    <Image
                      src={selectedPreview.preview_url || "/placeholder.svg"}
                      alt={`Preview by ${selectedPreview.modelLabel}`}
                      fill
                      className="object-contain"
                    />
                  ) : null}

                  {/* Watermark overlay */}
                  {selectedPreview?.preview_url && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-white/20 text-4xl font-bold rotate-[-15deg]">5-STAR PHOTOS PREVIEW</span>
                    </div>
                  )}
                </div>


                
                {/* Prompt Display - shows the instructions used for this transformation */}
                {currentPrompt && (
                  <div className="border-t border-white/10">
                    <button
                      onClick={() => setIsPromptExpanded(!isPromptExpanded)}
                      className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-2 text-sm text-slate-300">
                        <MessageSquare className="w-4 h-4 text-fuchsia-400" />
                        <span>Transformation Instructions</span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isPromptExpanded ? "rotate-180" : ""}`} />
                    </button>
                    {isPromptExpanded && (
                      <div className="px-4 pb-4">
                        <div className="p-3 rounded-lg bg-black/30 border border-white/10">
                          <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                            {currentPrompt}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Actions bar */}
            {hasTransformed && selectedPreview?.preview_url && (
              <div className="mt-6 glass-card rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  {/* Feedback */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-400 mr-2">Rate this result:</span>
                    <button
                      onClick={() => handleFeedback(selectedPreviewIndex, "thumbs_up")}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors ${
                        feedbackState[`${imageId}-${selectedPreview.model}`] === "thumbs_up"
                          ? "bg-green-500/30 text-green-400"
                          : "bg-white/5 text-slate-400 hover:bg-white/10"
                      }`}
                    >
                      <ThumbsUp className="w-4 h-4" />
                      Good
                    </button>
                    <button
                      onClick={() => handleFeedback(selectedPreviewIndex, "thumbs_down")}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors ${
                        feedbackState[`${imageId}-${selectedPreview.model}`] === "thumbs_down"
                          ? "bg-red-500/30 text-red-400"
                          : "bg-white/5 text-slate-400 hover:bg-white/10"
                      }`}
                    >
                      <ThumbsDown className="w-4 h-4" />
                      Poor
                    </button>
                  </div>

                  {/* Main actions */}
                  <div className="flex items-center gap-3">
                    {/* Compare Original */}
                    <button
                      onClick={() => setIsComparing(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
                    >
                      <Split className="w-4 h-4" />
                      Compare Original
                    </button>
                    
                      {/* Re-transform */}
                      <button
                        onClick={() => runTransformation()}
                        disabled={isTransforming}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={`w-4 h-4 ${isTransforming ? "animate-spin" : ""}`} />
                      Re-transform
                      <span className="text-green-400 text-sm">(Free)</span>
                    </button>

                    {/* Save variation */}
                    <button
                      onClick={() => handleSaveVariation(selectedPreviewIndex)}
                      disabled={isSaving}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#6A1FBF]/20 text-[#FF3EDB] hover:bg-[#6A1FBF]/30 transition-colors disabled:opacity-50"
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bookmark className="w-4 h-4" />}
                      Save Variation
                      <span className="text-green-400 text-sm">(Free)</span>
                    </button>

  {/* Download hi-res */}
  <button 
    onClick={() => setShowDownloadModal(true)}
    disabled={previews.length === 0}
    className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-magenta-violet text-white font-semibold hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100"
  >
    <Download className="w-4 h-4" />
    Download Hi-Res
    <span className="text-green-400 text-sm">(Free)</span>
  </button>
                  </div>
                </div>

                {/* Success message */}
                {saveSuccess && (
                  <div className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500/20 text-green-400">
                    <Check className="w-4 h-4" />
                    Saved {saveSuccess} variation to your library!
                  </div>
                )}
              </div>
            )}

            {/* Previous Transformations Section */}
            <div className="mt-8 pt-6 border-t border-white/10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <History className="w-5 h-5 text-fuchsia-400" />
                  Previous Transformations
                </h3>
                <div className="flex items-center gap-3">
                  {image.variations && image.variations.length > 1 && (
                    <>
                      {compareMode ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-400">
                            {selectedForCompare.length}/3 selected
                          </span>
                          <button
                            onClick={() => {
                              if (selectedForCompare.length >= 2) {
                                setIsComparing(true)
                              }
                            }}
                            disabled={selectedForCompare.length < 2}
                            className="px-3 py-1.5 rounded-lg bg-fuchsia-500 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Compare ({selectedForCompare.length})
                          </button>
                          <button
                            onClick={() => {
                              setCompareMode(false)
                              setSelectedForCompare([])
                            }}
                            className="px-3 py-1.5 rounded-lg bg-white/10 text-slate-300 text-sm hover:bg-white/20"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setCompareMode(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-slate-300 text-sm hover:bg-white/20 transition-colors"
                        >
                          <Split className="w-4 h-4" />
                          Compare
                        </button>
                      )}
                    </>
                  )}
                  {image.variations && image.variations.length > 0 && (
                    <span className="text-sm text-slate-400">{image.variations.length} saved</span>
                  )}
                </div>
              </div>
              
              {image.variations && image.variations.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {image.variations.map((variation) => {
                    const isSelected = selectedForCompare.includes(variation.id)
                    return (
                    <div
                      key={variation.id}
                      className={`group glass-card rounded-xl overflow-hidden cursor-pointer hover:scale-[1.02] transition-all ${
                        isSelected 
                          ? "ring-2 ring-fuchsia-500 bg-fuchsia-500/10" 
                          : "hover:ring-2 hover:ring-fuchsia-500/50"
                      }`}
                      onClick={() => {
                        if (compareMode) {
                          toggleCompareSelection(variation.id)
                        } else {
                          // Load this variation into the preview
                          setPreviews([{
                            model: (variation.source_model as ModelProvider) || "openai",
                            modelLabel: MODEL_CONFIG.find(m => m.model === variation.source_model)?.label || variation.source_model || "Saved",
                            preview_url: variation.storage_path,
                            is_loading: false,
                          }])
                          setSelectedPreviewIndex(0)
                          setHasTransformed(true)
                          // Store the prompt that was used for this variation
                          setCurrentPrompt(variation.transformation_prompt)
                          setIsPromptExpanded(false) // Collapse when switching variations
                        }
                      }}
                    >
                      <div className="relative aspect-[4/3]">
                        <Image
                          src={variation.storage_path || "/placeholder.svg"}
                          alt={`Variation of ${image.original_filename}`}
                          fill
                          className="object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        {variation.source_model && (
                          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-xs backdrop-blur-sm">
                            {MODEL_CONFIG.find(m => m.model === variation.source_model)?.label || variation.source_model}
                          </div>
                        )}
                        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="p-1.5 rounded-full bg-fuchsia-500 text-white">
                            <Eye className="w-3 h-3" />
                          </div>
                        </div>
                        {/* Compare mode selection indicator */}
                        {compareMode && (
                          <div className={`absolute top-2 right-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                            isSelected 
                              ? "bg-fuchsia-500 border-fuchsia-500" 
                              : "border-white/50 bg-black/30"
                          }`}>
                            {isSelected && <Check className="w-4 h-4 text-white" />}
                          </div>
                        )}
                      </div>
                      <div className="p-2 bg-white/5">
                        <p className="text-xs text-slate-400">
                          {new Date(variation.created_at).toLocaleDateString(undefined, { 
                            month: 'short', 
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  )})}
                </div>
              ) : (
                <div className="glass-card rounded-xl p-6 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-800 flex items-center justify-center">
                    <History className="w-6 h-6 text-slate-500" />
                  </div>
                  <p className="text-slate-400 text-sm">No previous transformations saved</p>
                  <p className="text-slate-500 text-xs mt-1">
                    Transformations are automatically saved when you click Transform
                  </p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
      
      {/* Full-screen comparison modal */}
      {isComparing && (selectedPreview?.preview_url || compareVariations.length > 0) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200"
          onClick={() => {
            setIsComparing(false)
            if (compareMode) {
              setCompareMode(false)
              setSelectedForCompare([])
            }
          }}
        >
          <div
            className="w-full max-w-7xl h-[90vh] glass-card-strong rounded-[2rem] overflow-hidden flex flex-col shadow-2xl ring-1 ring-white/20"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 shrink-0 bg-white/5 backdrop-blur-md border-b border-white/10">
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">{image.original_filename}</h2>
                <p className="text-sm text-slate-400">
                  {compareVariations.length > 0 
                    ? `Comparing ${compareVariations.length} transformations` 
                    : `Compare Original vs ${selectedPreview?.modelLabel}`}
                </p>
              </div>

              <button
                onClick={() => {
                  setIsComparing(false)
                  if (compareMode) {
                    setCompareMode(false)
                    setSelectedForCompare([])
                  }
                }}
                className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors border border-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Grid comparison - 2x2 layout for multiple, side-by-side for single */}
            <div className="relative flex-1 overflow-hidden bg-gradient-to-b from-black/20 to-black/40 p-4">
              {compareVariations.length > 0 ? (
                /* Multi-compare: 2x2 grid layout */
                <div className="h-full grid grid-cols-2 grid-rows-2 gap-3">
                  {/* Original - top left */}
                  <div className="relative rounded-xl overflow-hidden border border-white/10 shadow-2xl">
                    <div className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white text-xs font-bold border border-white/10">
                      Original
                    </div>
                    <Image
                      src={image.storage_path || "/placeholder.svg"}
                      alt="Original"
                      fill
                      className="object-contain bg-black/50"
                      priority
                    />
                  </div>
                  
                  {/* Variations fill remaining slots */}
                  {compareVariations.slice(0, 3).map((variation) => (
                    <div key={variation.id} className="relative rounded-xl overflow-hidden border border-white/10 shadow-2xl ring-2 ring-[#FF3EDB]/50">
                      <div className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-lg bg-[#FF3EDB] text-white text-xs font-bold shadow-lg">
                        {MODEL_CONFIG.find(m => m.model === variation.source_model)?.label || variation.source_model}
                      </div>
                      <Image
                        src={variation.storage_path || "/placeholder.svg"}
                        alt={MODEL_CONFIG.find(m => m.model === variation.source_model)?.label || "Variation"}
                        fill
                        className="object-contain bg-black/50"
                        priority
                      />
                      {/* Watermark */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className="text-white/10 text-lg font-bold rotate-[-15deg]">5-STAR PHOTOS PREVIEW</span>
                      </div>
                    </div>
                  ))}
                  
                  {/* Fill empty slots if less than 3 variations */}
                  {compareVariations.length < 3 && (
                    <div className="relative rounded-xl overflow-hidden border border-white/5 bg-black/30 flex items-center justify-center">
                      <span className="text-slate-600 text-sm">Select more to compare</span>
                    </div>
                  )}
                </div>
              ) : selectedPreview?.preview_url ? (
                /* Single preview: side-by-side */
                <div className="h-full flex items-center justify-center gap-4">
                  <div className="relative flex-1 h-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                    <div className="absolute top-4 left-4 z-10 px-3 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white text-xs font-bold border border-white/10">
                      Original
                    </div>
                    <Image
                      src={image.storage_path || "/placeholder.svg"}
                      alt="Original"
                      fill
                      className="object-contain bg-black/50"
                      priority
                    />
                  </div>
                  <div className="relative flex-1 h-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl ring-2 ring-[#FF3EDB]/50">
                    <div className="absolute top-4 left-4 z-10 px-3 py-1 rounded-lg bg-[#FF3EDB] text-white text-xs font-bold shadow-lg">
                      {selectedPreview.modelLabel}
                    </div>
                    <Image
                      src={selectedPreview.preview_url || "/placeholder.svg"}
                      alt={`Preview by ${selectedPreview.modelLabel}`}
                      fill
                      className="object-contain bg-black/50"
                      priority
                    />
                    {/* Watermark */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-white/15 text-2xl font-bold rotate-[-15deg]">5-STAR PHOTOS PREVIEW</span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
      
      {/* Enhancement Preferences Modal */}
      {image && (
        <SingleImagePreferencesModal
          isOpen={showPreferences}
          onClose={() => setShowPreferences(false)}
          onConfirm={(prefs) => {
            setPreferences(prefs)
            setShowPreferences(false)
            // Pass preferences directly to avoid stale state issue
            runTransformation(prefs)
          }}
          classification={image.classification || "unknown"}
          imageName={image.original_filename}
          initialPreferences={preferences}
        />
      )}
      
      {/* Download Selection Modal */}
      {image && (
        <DownloadSelectionModal
          isOpen={showDownloadModal}
          onClose={() => setShowDownloadModal(false)}
          originalFilename={image.original_filename}
          variations={previews
            .filter(p => p.preview_url)
            .map((p, i) => {
              const modelConfig = MODEL_CONFIG.find(m => m.model === p.model)
              return {
                id: `preview-${i}`,
                preview_url: p.preview_url!,
                sourceModel: p.model,
                modelLabel: modelConfig?.label || p.model,
              }
            })}
        />
      )}
    </div>
  )
}
