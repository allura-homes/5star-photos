"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { useAuthContext } from "@/lib/contexts/auth-context"
import { getImageById } from "@/lib/actions/image-actions"
import type { UserImage } from "@/lib/types"
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
} from "lucide-react"

// Model config for batch processing (same as single transform)
// Provider values must match what edit-image API expects
const BATCH_MODELS = [
  { model: "openai_1_5", label: "V1" },
  { model: "nano_banana_pro", label: "V2" },
  { model: "flux_2_pro", label: "V3" },
] as const

type BatchImageStatus = "pending" | "processing" | "complete" | "error"

interface BatchImage {
  id: string
  image: UserImage | null
  status: BatchImageStatus
  progress: number // 0-100
  error?: string
  completedVariations: number
  totalVariations: number
}

export default function BatchTransformPage() {
  const router = useRouter()
  const { profile } = useAuthContext()
  const [batchImages, setBatchImages] = useState<BatchImage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [overallProgress, setOverallProgress] = useState(0)
  const [startTime, setStartTime] = useState<Date | null>(null)

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
    if (!batchImage.image || !profile?.id) return

    setBatchImages(prev => prev.map((img, i) => 
      i === index ? { ...img, status: "processing", progress: 0 } : img
    ))

    const imagePrompt = `Transform this ${batchImage.image.classification || "interior"} real estate photo into a professionally enhanced, publication-ready image. Improve lighting, colors, and overall appeal while maintaining photorealistic quality.`

    let completedCount = 0
    let variationNumber = 1

    for (const modelConfig of BATCH_MODELS) {
      try {
        // Call the transform API with correct parameters (matching single transform)
        const response = await fetch("/api/edit-image", {
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
        })
        
        variationNumber++

        if (response.ok) {
          const result = await response.json()
          
          // Auto-save the variation - result may have url or image
          const imageData = result.url || result.image
          if (imageData) {
            const saveResponse = await fetch("/api/save-variation", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                parentImageId: batchImage.id,
                imageData: imageData,
                sourceModel: modelConfig.model,
                transformationPrompt: imagePrompt,
                userId: profile.id,
              }),
            })
            
            if (saveResponse.ok) {
              completedCount++
            }
          }
        }
      } catch {
        // Continue with other models even if one fails
      }

      // Update progress for this image
      const progress = Math.round(((completedCount) / BATCH_MODELS.length) * 100)
      setBatchImages(prev => prev.map((img, i) => 
        i === index ? { ...img, progress, completedVariations: completedCount } : img
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
  }, [profile?.id])

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

    // Process images in parallel, but stagger the starts to avoid overwhelming APIs
    // Process in batches of 3 at a time to stay under rate limits
    const CONCURRENT_LIMIT = 3
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
              <button
                onClick={startBatchProcessing}
                className="flex items-center gap-2 px-6 py-3 rounded-xl gradient-magenta-violet text-white font-semibold hover:scale-105 transition-all"
              >
                <Sparkles className="w-5 h-5" />
                Start Processing
              </button>
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
    </div>
  )
}
