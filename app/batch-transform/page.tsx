"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { useAuthContext } from "@/lib/contexts/auth-context"
import { getImageById } from "@/lib/actions/image-actions"
import type { UserImage, EnhancementPreferences, PhotoClassification } from "@/lib/types"
import { DEFAULT_ENHANCEMENT_PREFERENCES } from "@/lib/types"
import { SingleImagePreferencesModal } from "@/components/single-image-preferences-modal"
import {
  Loader2,
  Sparkles,
  Check,
  X,
  ArrowLeft,
  Clock,
  ImageIcon,
  AlertCircle,
  FolderOpen,
  ExternalLink,
  Settings2,
} from "lucide-react"

// Model config for batch processing (same as single transform).
// Provider values must match what the edit-image API expects.
//   V1 = "openai"          -> gpt-image-1
//   V2 = "nano_banana_pro" -> gemini-3-pro-image-preview
//   V4 = "openai_2"        -> gpt-image-2
//
// NOTE (2026-07-13): gpt-image-2 is a real OpenAI model, but it can fail with
// "Failed to fetch" if this project's OpenAI key/org has not been granted
// access to it (gpt-image-1 works on the same key). When that happens the V4
// variation fails and only V1/V2 get saved. Access must be enabled in the
// OpenAI dashboard for the key used by this project. All 4 slots stay enabled.
const BATCH_MODELS = [
  { model: "openai", label: "V1" },
  { model: "nano_banana_pro", label: "V2" },
  // DEPRECATED 2026-05-15: flux_2_pro (V3) - fal.ai billing issues
  // { model: "flux_2_pro", label: "V3" },
  { model: "openai_2", label: "V4" },
] as const

// Timeouts for different API calls
const EDIT_IMAGE_TIMEOUT = 200000 // 200s for image generation (can be slow)
const ART_DIRECTOR_TIMEOUT = 30000 // 30s for art director
const SAVE_VARIATION_TIMEOUT = 30000 // 30s for saving

// Helper to create a fetch with timeout
async function fetchWithTimeout(url: string, options: RequestInit, timeout: number): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timed out after ${timeout}ms`)
    }
    throw error
  }
}

type BatchImageStatus = "pending" | "processing" | "complete" | "error"

interface BatchImage {
  id: string
  image: UserImage | null
  status: BatchImageStatus
  progress: number // 0-100
  error?: string
  // Per-model failure reasons (e.g. "V4: <OpenAI error>"). Surfaced so a model
  // that fails to save (like gpt-image-2 without account access) is visible
  // instead of being silently dropped.
  modelErrors?: string[]
  completedVariations: number
  totalVariations: number
}

export default function BatchTransformPage() {
  const router = useRouter()
  const { profile, user } = useAuthContext()
  const [batchImages, setBatchImages] = useState<BatchImage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [overallProgress, setOverallProgress] = useState(0)
  const [startTime, setStartTime] = useState<Date | null>(null)
  
  // Custom preferences state
  const [showPreferencesModal, setShowPreferencesModal] = useState(false)
  const [customPreferences, setCustomPreferences] = useState<EnhancementPreferences | null>(null)
  const [hasCustomPreferences, setHasCustomPreferences] = useState(false)

  // Load batch image IDs from sessionStorage
  useEffect(() => {
    const storedIds = sessionStorage.getItem("batch_transform_ids")
    if (!storedIds) {
      router.push("/library")
      return
    }

    const imageIds: string[] = JSON.parse(storedIds)
    loadBatchImages(imageIds)
  }, [router])

  async function loadBatchImages(imageIds: string[]) {
    setIsLoading(true)
    const loadedImages: BatchImage[] = []

    for (const id of imageIds) {
      const { image } = await getImageById(id)
      loadedImages.push({
        id,
        image,
        status: "pending",
        progress: 0,
        completedVariations: 0,
        totalVariations: BATCH_MODELS.length,
      })
    }

    setBatchImages(loadedImages)
    setIsLoading(false)
  }



  // Process a single image
  const processImage = useCallback(async (batchImage: BatchImage, index: number) => {
    // Resolve a reliable user id. Do NOT depend solely on profile?.id: the
    // profile row can be null (missing profiles row, or fetchProfile timed out),
    // in which case the auth user is still available, and the image itself
    // carries its owner's user_id. If we bailed silently here (the old bug), the
    // image would stay "pending" forever and the whole batch would hang at 0%.
    const userId = profile?.id ?? user?.id ?? batchImage.image?.user_id ?? null

    if (!batchImage.image || !userId) {
      // Mark as error instead of returning silently so the batch can complete
      // and the completion effect can stop the spinner.
      setBatchImages(prev => prev.map((img, i) =>
        i === index ? {
          ...img,
          status: "error",
          progress: 100,
          error: !batchImage.image ? "Image failed to load" : "Not signed in - please refresh and sign in again",
        } : img
      ))
      return false
    }

    setBatchImages(prev => prev.map((img, i) => 
      i === index ? { ...img, status: "processing", progress: 0 } : img
    ))

    // Generate prompt: use art-director if custom preferences, otherwise use default
    let imagePrompt: string
    const classification = batchImage.image.classification || "indoor"
    
    if (hasCustomPreferences && customPreferences) {
      // Call art-director API to generate custom prompt based on preferences
      try {
        const artDirectorResponse = await fetchWithTimeout("/api/art-director", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            classification,
            room_type_guess: batchImage.image.room_type_guess || "",
            user_preferences: customPreferences,
            original_url: batchImage.image.storage_path,
            filename: batchImage.image.original_filename,
          }),
        }, ART_DIRECTOR_TIMEOUT)
        
        if (artDirectorResponse.ok) {
          const artDirectorData = await artDirectorResponse.json()
          imagePrompt = artDirectorData.imagePrompt || artDirectorData.image_prompt || ""
        } else {
          // Fall back to default prompt if art-director fails
          imagePrompt = `Transform this ${classification} real estate photo into a professionally enhanced, publication-ready image. Improve lighting, colors, and overall appeal while maintaining photorealistic quality.`
        }
      } catch {
        // Fall back to default prompt on error
        imagePrompt = `Transform this ${classification} real estate photo into a professionally enhanced, publication-ready image. Improve lighting, colors, and overall appeal while maintaining photorealistic quality.`
      }
    } else {
      // No custom preferences - still call art-director for professional prompts
      try {
        const artDirectorResponse = await fetchWithTimeout("/api/art-director", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            classification,
            room_type_guess: batchImage.image.room_type_guess || "",
            original_url: batchImage.image.storage_path,
            filename: batchImage.image.original_filename,
          }),
        }, ART_DIRECTOR_TIMEOUT)
        
        if (artDirectorResponse.ok) {
          const artDirectorData = await artDirectorResponse.json()
          imagePrompt = artDirectorData.imagePrompt || artDirectorData.image_prompt || ""
        } else {
          imagePrompt = `Transform this ${classification} real estate photo into a professionally enhanced, publication-ready image. Improve lighting, colors, and overall appeal while maintaining photorealistic quality.`
        }
      } catch {
        imagePrompt = `Transform this ${classification} real estate photo into a professionally enhanced, publication-ready image. Improve lighting, colors, and overall appeal while maintaining photorealistic quality.`
      }
    }

    let completedCount = 0
    let variationNumber = 1
    const modelErrors: string[] = []

    for (const modelConfig of BATCH_MODELS) {
      try {
        // Call the transform API with correct parameters (matching single transform)
        const response = await fetchWithTimeout("/api/edit-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            original_url: batchImage.image.storage_path,
            filename: batchImage.image.original_filename,
            model: modelConfig.model,
            provider: modelConfig.model,
            variation_number: variationNumber,
            classification: batchImage.image.classification,
            image_prompt: imagePrompt,
            use_ai_models: true,
          }),
        }, EDIT_IMAGE_TIMEOUT)
        
        variationNumber++

        if (response.ok) {
          const result = await response.json()
          
          // Auto-save the variation - result may have url or image
          const imageData = result.url || result.image
          if (imageData) {
            const saveResponse = await fetchWithTimeout("/api/save-variation", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                parentImageId: batchImage.id,
                imageData: imageData,
                sourceModel: modelConfig.model,
                transformationPrompt: imagePrompt,
                userId: userId,
              }),
            }, SAVE_VARIATION_TIMEOUT)
            
            if (saveResponse.ok) {
              completedCount++
            } else {
              const saveErr = await saveResponse.text().catch(() => "")
              modelErrors.push(`${modelConfig.label}: save failed - ${saveErr.slice(0, 200) || saveResponse.status}`)
            }
          } else {
            modelErrors.push(`${modelConfig.label}: no image returned`)
          }
        } else {
          // Surface the real reason this model failed (e.g. OpenAI 403 "must be
          // verified to use gpt-image-2") instead of silently dropping it.
          const errText = await response.text().catch(() => "")
          const reason = errText.slice(0, 200) || `HTTP ${response.status}`
          modelErrors.push(`${modelConfig.label}: ${reason}`)
          console.log(`[v0] batch model ${modelConfig.label} (${modelConfig.model}) failed:`, reason)
        }
      } catch (err) {
        // Continue with other models even if one fails, but record why.
        const reason = err instanceof Error ? err.message : "unknown error"
        modelErrors.push(`${modelConfig.label}: ${reason}`)
        console.log(`[v0] batch model ${modelConfig.label} (${modelConfig.model}) threw:`, reason)
      }

      // Update progress for this image
      const progress = Math.round(((completedCount) / BATCH_MODELS.length) * 100)
      setBatchImages(prev => prev.map((img, i) => 
        i === index ? { ...img, progress, completedVariations: completedCount, modelErrors: [...modelErrors] } : img
      ))
    }

    // Mark as complete or error
    setBatchImages(prev => prev.map((img, i) => 
      i === index ? { 
        ...img, 
        status: completedCount > 0 ? "complete" : "error",
        progress: 100,
        completedVariations: completedCount,
        error: completedCount === 0 ? "All transformations failed" : undefined,
      } : img
    ))

    return completedCount > 0
  }, [profile?.id, user?.id, hasCustomPreferences, customPreferences])

  // Update overall progress when individual images complete
  useEffect(() => {
    if (!isProcessing) return
    const completed = batchImages.filter(img => img.status === "complete" || img.status === "error").length
    const inProgress = batchImages.filter(img => img.status === "processing")
    
    // Calculate weighted progress: completed images + partial progress of in-progress images
    const completedProgress = completed * 100
    const inProgressProgress = inProgress.reduce((sum, img) => sum + img.progress, 0)
    const totalProgress = Math.round((completedProgress + inProgressProgress) / (batchImages.length * 100) * 100)
    
    setOverallProgress(totalProgress)
    
    // Check if all done
    if (completed === batchImages.length) {
      setIsProcessing(false)
      sessionStorage.removeItem("batch_transform_ids")
    }
  }, [batchImages, isProcessing])

  // Start batch processing - parallel with staggered starts to avoid rate limits
  async function startBatchProcessing() {
    setIsProcessing(true)
    setStartTime(new Date())

    // Process images in parallel, but stagger the starts to avoid overwhelming APIs.
    // CONCURRENT_LIMIT caps how many images are in-flight at once. This is bounded by
    // external API rate limits (Gemini Art Director RPM + OpenAI image edits), NOT by
    // our own code. Pushing this too high causes 429 "Resource Exhausted" errors that
    // fail the batch. 6 is a safe balance between throughput and staying under quotas.
    const CONCURRENT_LIMIT = 6
    const STAGGER_DELAY = 500 // 500ms between starting each image
    
    const processWithStagger = async (batchImage: BatchImage, index: number) => {
      // Stagger start times within each concurrent batch
      await new Promise(resolve => setTimeout(resolve, (index % CONCURRENT_LIMIT) * STAGGER_DELAY))
      return processImage(batchImage, index)
    }
    
    // Process in chunks of CONCURRENT_LIMIT
    const chunks: BatchImage[][] = []
    for (let i = 0; i < batchImages.length; i += CONCURRENT_LIMIT) {
      chunks.push(batchImages.slice(i, i + CONCURRENT_LIMIT))
    }
    
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex]
      const startIndex = chunkIndex * CONCURRENT_LIMIT
      
      // Process this chunk in parallel
      await Promise.all(
        chunk.map((batchImage, idx) => 
          processWithStagger(batchImage, startIndex + idx)
        )
      )
    }
  }

  const completedCount = batchImages.filter(img => img.status === "complete").length
  const errorCount = batchImages.filter(img => img.status === "error").length
  const isComplete = !isProcessing && (completedCount + errorCount) === batchImages.length && batchImages.length > 0

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-fuchsia-500 animate-spin mx-auto mb-4" />
          <p className="text-white">Loading images...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/library"
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">Batch Transform</h1>
            <p className="text-slate-400">
              {batchImages.length} images selected for transformation
            </p>
          </div>
        </div>

        {/* Overall Progress Card */}
        <div className="glass-card rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                isComplete ? "bg-green-500/20" : isProcessing ? "bg-fuchsia-500/20" : "bg-slate-700"
              }`}>
                {isComplete ? (
                  <Check className="w-6 h-6 text-green-400" />
                ) : isProcessing ? (
                  <Loader2 className="w-6 h-6 text-fuchsia-400 animate-spin" />
                ) : (
                  <Sparkles className="w-6 h-6 text-slate-400" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {isComplete 
                    ? "Batch Processing Complete!" 
                    : isProcessing 
                      ? `Processing ${batchImages.length} images in parallel...`
                      : "Ready to Transform"}
                </h2>
                <p className="text-sm text-slate-400">
                  {isComplete 
                    ? `${completedCount} images transformed successfully${errorCount > 0 ? `, ${errorCount} failed` : ""}`
                    : isProcessing
                      ? `${completedCount} of ${batchImages.length} complete`
                      : `Each image will be transformed using ${BATCH_MODELS.length} AI models`}
                </p>
              </div>
            </div>

            {!isProcessing && !isComplete && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowPreferencesModal(true)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all ${
                    hasCustomPreferences 
                      ? "border-fuchsia-500 bg-fuchsia-500/10 text-fuchsia-400" 
                      : "border-slate-600 bg-slate-800 text-slate-300 hover:border-slate-500"
                  }`}
                >
                  <Settings2 className="w-5 h-5" />
                  {hasCustomPreferences ? "Custom Options Set" : "Customize Options"}
                </button>
                <button
                  onClick={startBatchProcessing}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl gradient-magenta-violet text-white font-semibold hover:scale-105 transition-all"
                >
                  <Sparkles className="w-5 h-5" />
                  Start Processing
                </button>
              </div>
            )}

            {isComplete && (
              <Link
                href="/library"
                className="flex items-center gap-2 px-6 py-3 rounded-xl gradient-magenta-violet text-white font-semibold hover:scale-105 transition-all"
              >
                <FolderOpen className="w-5 h-5" />
                View in Library
              </Link>
            )}
          </div>

          {/* Overall Progress Bar */}
          {(isProcessing || isComplete) && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-slate-400">Overall Progress</span>
                <span className="text-white font-medium">{overallProgress}%</span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-fuchsia-500 to-violet-500 transition-all duration-500"
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* What to Expect */}
        {!isProcessing && !isComplete && (
          <div className="glass-card rounded-2xl p-6 mb-8">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-fuchsia-400" />
              What to Expect
            </h3>
            <ul className="space-y-3 text-slate-300">
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-fuchsia-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs text-fuchsia-400 font-bold">1</span>
                </div>
                <span>Each image will be processed through {BATCH_MODELS.length} AI models simultaneously</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-fuchsia-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs text-fuchsia-400 font-bold">2</span>
                </div>
                <span>Estimated time: ~{Math.ceil(batchImages.length * 1.5)} minutes for all {batchImages.length} images</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-fuchsia-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs text-fuchsia-400 font-bold">3</span>
                </div>
                <span>You can leave this page - transformations will continue in the background</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-fuchsia-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs text-fuchsia-400 font-bold">4</span>
                </div>
                <span>Find your transformed images in the Library or by clicking on each original</span>
              </li>
            </ul>
          </div>
        )}

        {/* Image List */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-white mb-4">
            {isComplete ? "Completed Images" : isProcessing ? "Processing Queue" : "Images to Transform"}
          </h3>
          
          {batchImages.map((batchImage, index) => (
            <div 
              key={batchImage.id}
              className={`glass-card rounded-xl p-4 flex items-center gap-4 transition-all ${
                batchImage.status === "processing" ? "ring-2 ring-fuchsia-500" : ""
              }`}
            >
              {/* Thumbnail */}
              <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                {batchImage.image?.storage_path ? (
                  <Image
                    src={batchImage.image.storage_path}
                    alt={batchImage.image.original_filename || "Image"}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-slate-700 flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-slate-500" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">
                  {batchImage.image?.original_filename || `Image ${index + 1}`}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {batchImage.status === "pending" && (
                    <span className="text-sm text-slate-400">Waiting...</span>
                  )}
                  {batchImage.status === "processing" && (
                    <>
                      <Loader2 className="w-4 h-4 text-fuchsia-400 animate-spin" />
                      <span className="text-sm text-fuchsia-400">
                        Processing ({batchImage.completedVariations}/{batchImage.totalVariations} models)
                      </span>
                    </>
                  )}
                  {batchImage.status === "complete" && (
                    <>
                      <Check className="w-4 h-4 text-green-400" />
                      <span className="text-sm text-green-400">
                        Complete ({batchImage.completedVariations} variations saved)
                      </span>
                    </>
                  )}
                  {batchImage.status === "error" && (
                    <>
                      <AlertCircle className="w-4 h-4 text-red-400" />
                      <span className="text-sm text-red-400">{batchImage.error || "Failed"}</span>
                    </>
                  )}
                </div>

                {/* Individual Progress Bar */}
                {batchImage.status === "processing" && (
                  <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-fuchsia-500 transition-all duration-300"
                      style={{ width: `${batchImage.progress}%` }}
                    />
                  </div>
                )}

                {/* Per-model failures (e.g. a model that couldn't save a
                    variation). Shown so partial results aren't a mystery. */}
                {batchImage.status !== "processing" &&
                  batchImage.status !== "pending" &&
                  batchImage.modelErrors &&
                  batchImage.modelErrors.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5">
                      {batchImage.modelErrors.map((modelError, i) => (
                        <li key={i} className="text-xs text-amber-400/90 truncate" title={modelError}>
                          {modelError}
                        </li>
                      ))}
                    </ul>
                  )}
              </div>

              {/* Action */}
              {batchImage.status === "complete" && (
                <Link
                  href={`/transform/${batchImage.id}`}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 text-sm text-white hover:bg-white/20 transition-colors"
                >
                  View
                  <ExternalLink className="w-3 h-3" />
                </Link>
              )}

              {/* Starting indicator for pending items */}
              {batchImage.status === "pending" && isProcessing && (
                <span className="text-sm text-slate-500">
                  Starting...
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Completion Summary */}
        {isComplete && (
          <div className="mt-8 glass-card rounded-2xl p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">All Done!</h3>
            <p className="text-slate-400 mb-6">
              {completedCount} of {batchImages.length} images were successfully transformed.
              Each image now has up to {BATCH_MODELS.length} AI-enhanced variations.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link
                href="/library"
                className="flex items-center gap-2 px-6 py-3 rounded-xl gradient-magenta-violet text-white font-semibold hover:scale-105 transition-all"
              >
                <FolderOpen className="w-5 h-5" />
                View in Library
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Preferences Modal */}
      <SingleImagePreferencesModal
        isOpen={showPreferencesModal}
        onClose={() => setShowPreferencesModal(false)}
        onConfirm={(preferences) => {
          setCustomPreferences(preferences)
          setHasCustomPreferences(true)
          setShowPreferencesModal(false)
        }}
        classification={batchImages[0]?.image?.classification || "indoor"}
        imageName={`${batchImages.length} images`}
        initialPreferences={customPreferences || undefined}
      />
    </div>
  )
}
