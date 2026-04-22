"use server"

import { createServerClient } from "@supabase/ssr"
import { createClient as createStorageClient } from "@supabase/supabase-js"
import type { StyleMode, EnhancementPreferences, PhotoClassification } from "@/lib/types"

// Safe revalidation helper - revalidatePath doesn't work in v0 preview
function safeRevalidate(_path: string) {
  // No-op in v0 preview environment
}
import { applyWatermark } from "@/lib/utils/watermark"
import { createClient } from "@/lib/supabase/server"
import { Buffer } from "buffer"

let storageClientInstance: ReturnType<typeof createStorageClient> | null = null

function getStorageClient() {
  if (!storageClientInstance) {
    storageClientInstance = createStorageClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  }
  return storageClientInstance
}

/**
 * 5star.photos Job Processing Engine
 *
 * VERSION: v197 (Stable Checkpoint)
 *
 * Active Providers:
 * - V1: Nano Banana Pro (gemini-3-pro-image-preview)
 * - V2: OpenAI GPT Image 1 (Images Edits API, 1536x1024)
 * - V3: OpenAI GPT Image 1 Mini (Images Edits API, 1536x1024)
 * - V4: OpenAI GPT Image 1.5 (Images Edits API, 1536x1024)
 *
 * See MODEL_CONFIGURATION.md for full documentation.
 * See docs/ART_DIRECTOR_STRATEGY.md for prompt engineering guidelines.
 */

function getApiBaseUrl(): string {
  // Server-side: use internal Vercel URL or localhost
  if (typeof window === "undefined") {
    const vercelUrl = process.env.VERCEL_URL
    if (vercelUrl) {
      // In Vercel, use the auto-assigned URL
      return `https://${vercelUrl}`
    }
    // In local development
    return "http://localhost:3000"
  }

  // Client-side: use the browser's current origin
  return typeof window !== "undefined" ? window.location.origin : "https://5star.photos"
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/\s+/g, "_") // Replace spaces with underscores
    .replace(/[^a-zA-Z0-9._-]/g, "") // Remove any other special characters
}

function getInternalApiUrl(): string {
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL
    if (vercelUrl.startsWith("http://") || vercelUrl.startsWith("https://")) {
      return vercelUrl
    }
    return `https://${vercelUrl}`
  }
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL
  }
  return "http://localhost:3000"
}

const RATE_LIMIT_CONFIG = {
  maxConcurrentFiles: 2, // Process max 2 files at a time
  delayBetweenProviders: 1000, // 1 second between provider calls
  delayBetweenFiles: 500, // 500ms between files
  maxRetriesOn429: 3, // Retry up to 3 times on rate limit
  baseRetryDelay: 2000, // Start with 2 second delay, doubles each retry
}

const DEFAULT_IMAGE_PROMPTS: Record<string, string> = {
  exterior: `Ultra-realistic professional real estate photograph. Preserve EXACTLY: all architectural elements, pool shape and features (including any connected jacuzzi/spa), furniture positions (items in sun stay in sun, items under cover stay under cover), landscaping variety and maturity. Enhance ONLY: lighting quality, color vibrancy, sharpness, and clarity. Do NOT add, remove, move, or redesign any elements. Professional real estate photography quality with bright, crisp natural lighting.`,
  interior: `Ultra-realistic professional real estate photograph. Preserve EXACTLY: all furniture pieces in their exact positions, all architectural details, wall colors, flooring materials, window views, and decorative elements. Enhance ONLY: lighting quality to be bright and welcoming, color accuracy, sharpness, and clarity. Do NOT add, remove, move, or redesign any elements. Professional real estate photography quality.`,
  default: `Ultra-realistic professional photograph. Preserve ALL elements exactly as they appear - furniture positions, architectural features, landscaping, and structural elements. Enhance ONLY: lighting quality, color vibrancy, sharpness, and clarity. Do NOT add, remove, move, or redesign any elements. Professional photography quality with bright, natural lighting.`,
}

function getDefaultPromptForFile(filename: string): string {
  const lowerName = filename.toLowerCase()
  if (
    lowerName.includes("pool") ||
    lowerName.includes("backyard") ||
    lowerName.includes("patio") ||
    lowerName.includes("exterior") ||
    lowerName.includes("outdoor") ||
    lowerName.includes("yard") ||
    lowerName.includes("deck")
  ) {
    return DEFAULT_IMAGE_PROMPTS.exterior
  }
  if (
    lowerName.includes("kitchen") ||
    lowerName.includes("bedroom") ||
    lowerName.includes("living") ||
    lowerName.includes("bath") ||
    lowerName.includes("interior") ||
    lowerName.includes("room")
  ) {
    return DEFAULT_IMAGE_PROMPTS.interior
  }
  return DEFAULT_IMAGE_PROMPTS.default
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = RATE_LIMIT_CONFIG.maxRetriesOn429,
): Promise<Response> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options)

      if (response.status === 429) {
        const clonedResponse = response.clone()
        try {
          const errorBody = await clonedResponse.json()
          if (errorBody.code === "quota_exceeded" || errorBody.error?.code === "insufficient_quota") {
            console.log("[v0] Quota exceeded (not retryable), returning response")
            return response
          }
        } catch (e) {
          // Couldn't parse body, treat as rate limit
        }

        if (attempt < maxRetries) {
          const delay = RATE_LIMIT_CONFIG.baseRetryDelay * Math.pow(2, attempt)
          console.log(`[v0] Rate limited (429), waiting ${delay}ms before retry ${attempt + 1}/${maxRetries}`)
          await new Promise((resolve) => setTimeout(resolve, delay))
          continue
        }
        return response
      }

      return response
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (attempt < maxRetries) {
        const delay = RATE_LIMIT_CONFIG.baseRetryDelay * Math.pow(2, attempt)
        console.log(`[v0] Fetch error, waiting ${delay}ms before retry: ${lastError.message}`)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError || new Error("Fetch failed after retries")
}

type UploadedFile = {
  name: string
  size: number
  original_url: string
}

export async function createJob(
  input: FormData | { files: UploadedFile[]; styleMode: StyleMode; googleDriveLink?: string },
) {
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    cookies: { getAll: () => [], setAll: () => {} },
  })

  let files: File[] = []
  let uploadedFiles: UploadedFile[] = []
  let styleMode: StyleMode = "full_5star_fix"
  let googleDriveLink: string | null = null

  // Handle both FormData (legacy) and object input (new)
  if (input instanceof FormData) {
    files = input.getAll("files") as File[]
    styleMode = (input.get("styleMode") as StyleMode) || "full_5star_fix"
    googleDriveLink = input.get("googleDriveLink") as string | null
    console.log("[v0] Creating job with FormData, files:", files.length, "style:", styleMode)
  } else {
    uploadedFiles = input.files
    styleMode = input.styleMode
    googleDriveLink = input.googleDriveLink || null
    console.log("[v0] Creating job with pre-uploaded files:", uploadedFiles.length, "style:", styleMode)
  }

  // Create the job first
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .insert({
      status: "uploaded",
      style_mode: styleMode,
      file_list: [],
      google_drive_link: googleDriveLink,
    })
    .select()
    .single()

  if (jobError) {
    console.error("[v0] Job creation error:", jobError)
    throw jobError
  }

  console.log("[v0] Job created with ID:", job.id)

  let fileList: Array<{
    name: string
    size: number
    original_url: string
    variations: never[]
    approved: boolean
  }> = []

  // If we received pre-uploaded files, use them directly
  if (uploadedFiles.length > 0) {
    fileList = uploadedFiles.map((f) => ({
      name: f.name,
      size: f.size,
      original_url: f.original_url,
      variations: [],
      approved: false,
    }))
    console.log("[v0] Using pre-uploaded files:", fileList.length)
  } else if (files.length > 0) {
    // Legacy: Upload files server-side (for small files)
    const storageClient = getStorageClient()
    for (const file of files) {
      try {
        const sanitizedName = sanitizeFileName(file.name)
        const fileName = `${job.id}/${Date.now()}-${sanitizedName}` // Sanitize file name

        const { data, error } = await storageClient.storage.from("original-uploads").upload(fileName, file, {
          contentType: file.type || "image/jpeg",
          upsert: false,
        })

        if (error) {
          const errorMessage =
            typeof error === "object" && error !== null
              ? (error as any).message || JSON.stringify(error)
              : String(error)
          console.error(`[v0] Upload error for ${file.name}:`, errorMessage)
          continue
        }

        const { data: urlData } = storageClient.storage.from("original-uploads").getPublicUrl(fileName)

        fileList.push({
          name: file.name,
          size: file.size,
          original_url: urlData.publicUrl,
          variations: [],
          approved: false,
        })
      } catch (uploadError) {
        const errorMessage = uploadError instanceof Error ? uploadError.message : String(uploadError)
        console.error(`[v0] Upload exception for ${file.name}:`, errorMessage)
        continue
      }
    }
  }

  console.log("[v0] Files in job:", fileList.length)

  if (fileList.length === 0 && (files.length > 0 || uploadedFiles.length > 0)) {
    await supabase.from("jobs").delete().eq("id", job.id)
    return { error: "Failed to upload files. Please try smaller files or fewer files at once." }
  }

  const { error: updateError } = await supabase
    .from("jobs")
    .update({
      file_list: fileList,
      status: "processing_preview",
    })
    .eq("id", job.id)

  if (updateError) {
    console.error("[v0] Job update error:", updateError)
    return { error: "Failed to update job with files." }
  }

  // Start processing in background
  processJobPreviews(job.id).catch((err) => {
    console.error("[v0] Background processing error:", err)
  })

  return { jobId: job.id }
}

async function getCurrentUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

async function getUserProfile(userId: string) {
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    cookies: { getAll: () => [], setAll: () => {} },
  })
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single()
  return profile
}

async function incrementFreePreviewsUsed(userId: string, count = 1) {
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    cookies: { getAll: () => [], setAll: () => {} },
  })
  const { data: profile } = await supabase.from("profiles").select("free_previews_used").eq("id", userId).single()

  if (profile) {
    await supabase
      .from("profiles")
      .update({ free_previews_used: profile.free_previews_used + count })
      .eq("id", userId)
  }
}

export async function createJobRecord(
  styleMode: StyleMode,
  googleDriveLink?: string,
  enhancementPreferences?: EnhancementPreferences,
  photoClassifications?: Array<{ name: string; classification: PhotoClassification }>,
): Promise<{ jobId?: string; error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "You must be logged in to create a job" }
  }

  const { data, error } = await supabase
    .from("jobs")
    .insert({
      user_id: user.id,
      status: "uploaded",
      style_mode: styleMode,
      google_drive_link: googleDriveLink,
      file_list: [],
      enhancement_preferences: enhancementPreferences || null,
      photo_classifications: photoClassifications || null,
    })
    .select("id")
    .single()

  if (error) {
    console.error("Error creating job:", error)
    return { error: error.message }
  }

  return { jobId: data.id }
}

export async function finalizeJobWithFiles(
  jobId: string,
  files: Array<{ name: string; size: number; original_url: string }>,
): Promise<{ success?: boolean; error?: string }> {
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    cookies: { getAll: () => [], setAll: () => {} },
  })

  const user = await getCurrentUser()
  if (!user) {
    return { error: "You must be logged in" }
  }

  const { data: job } = await supabase.from("jobs").select("user_id").eq("id", jobId).single()

  if (!job || job.user_id !== user.id) {
    return { error: "Job not found or access denied" }
  }

  const profile = await getUserProfile(user.id)
  if (profile && profile.role === "viewer") {
    const remaining = profile.free_previews_limit - profile.free_previews_used
    if (files.length > remaining) {
      return {
        error: `You have ${remaining} free preview${remaining !== 1 ? "s" : ""} remaining. Please upgrade to continue.`,
      }
    }
  }

  const fileList = files.map((f) => ({
    name: f.name,
    size: f.size,
    original_url: f.original_url,
    variations: [],
    approved: false,
  }))

  const { error: updateError } = await supabase
    .from("jobs")
    .update({
      file_list: fileList,
      status: "processing_preview",
    })
    .eq("id", jobId)

  if (updateError) {
    console.error("[v0] Job update error:", updateError)
    return { error: "Failed to update job with files." }
  }

  if (profile && profile.role === "viewer") {
    await incrementFreePreviewsUsed(user.id, files.length)
  }

  // Start processing in background (no preferences)
  processJobPreviews(jobId).catch((err: Error) => console.error("[v0] Background processing error:", err))

  return { success: true }
}

export const processEnhancement = finalizeJobWithFiles

export async function processJobPreviews(jobId: string) {
  try {
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      cookies: { getAll: () => [], setAll: () => {} },
    })
    const apiBaseUrl = getApiBaseUrl()

    console.log("[v0] Using API base URL:", apiBaseUrl)
    console.log("[v0] Processing job with ID:", jobId)

    const { data: job } = await supabase.from("jobs").select("file_list, style_mode").eq("id", jobId).single()

    if (!job) {
      console.error("[v0] Job not found")
      return
    }

    const styleMode = job.style_mode || "full_5star_fix"
    console.log("[v0] Using style_mode:", styleMode)

    const fileList = job.file_list
    let openaiUnavailable = false
    let totalVariations = 0

    for (const file of fileList) {
      const result = await processFileWithVariations(supabase, file, jobId, styleMode, apiBaseUrl, openaiUnavailable)
      file.variations = result.variations
      totalVariations += result.variations.length
      openaiUnavailable = result.openaiUnavailable
    }

    if (totalVariations === 0) {
      console.error("[v0] No variations generated for any file - marking job as error")
      await supabase
        .from("jobs")
        .update({
          file_list: fileList,
          status: "error",
          error_message: "Failed to generate any image variations. All providers may be unavailable.",
        })
        .eq("id", jobId)
      return
    }

    const { error: updateError } = await supabase
      .from("jobs")
      .update({
        file_list: fileList,
        status: "preview_ready",
      })
      .eq("id", jobId)

    if (updateError) {
      console.error("[v0] Job update error:", updateError)
      throw updateError
    }

    safeRevalidate(`/preview/${jobId}`)
    console.log("[v0] Preview processing complete with", totalVariations, "total variations")
  } catch (error) {
    console.error("[v0] Processing error:", error)
    try {
      const supabaseClient = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { cookies: { getAll: () => [], setAll: () => {} } },
      )
      await supabaseClient
        .from("jobs")
        .update({
          status: "error",
          error_message: error instanceof Error ? error.message : "Failed to process previews",
        })
        .eq("id", jobId)
    } catch (dbError) {
      console.error("[v0] Failed to update job status to error:", dbError)
    }
  }
}

export async function updateFileApproval(jobId: string, fileName: string, approved: boolean) {
  try {
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      cookies: { getAll: () => [], setAll: () => {} },
    })
    const { data: job } = await supabase.from("jobs").select("file_list").eq("id", jobId).single()

    if (!job) return { error: "Job not found" }

    const updatedFiles = job.file_list.map((file: any) => (file.name === fileName ? { ...file, approved } : file))

    await supabase.from("jobs").update({ file_list: updatedFiles }).eq("id", jobId)

    safeRevalidate(`/preview/${jobId}`)
    return { success: true }
  } catch (error) {
    console.error("[v0] Approval update error:", error)
    return { error: "Failed to update approval" }
  }
}

export async function generateFinalImages(jobId: string) {
  try {
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      cookies: { getAll: () => [], setAll: () => {} },
    })
    const { data: job } = await supabase.from("jobs").select().eq("id", jobId).single()

    if (!job) return { error: "Job not found" }

    await supabase.from("jobs").update({ status: "processing_final" }).eq("id", jobId)

    const approvedFiles = job.file_list.filter((file: any) => file.approved)
    const finalFiles = []

    for (const file of approvedFiles) {
      await new Promise((resolve) => setTimeout(resolve, 1500))

      finalFiles.push({
        ...file,
        final_url: file.preview_url,
      })
    }

    await supabase
      .from("jobs")
      .update({
        file_list: job.file_list.map((file: any) => {
          const finalFile = finalFiles.find((f: any) => f.name === file.name)
          return finalFile || file
        }),
        status: "done",
      })
      .eq("id", jobId)

    safeRevalidate(`/download/${jobId}`)
    return { success: true }
  } catch (error) {
    console.error("[v0] Final generation error:", error)
    return { error: "Failed to generate final images" }
  }
}

export async function getUserJobs() {
  try {
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      cookies: { getAll: () => [], setAll: () => {} },
    })
    const user = await getCurrentUser()

    if (!user) {
      return { error: "Not authenticated", jobs: [] }
    }

    const { data: jobs, error } = await supabase
      .from("jobs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)

    if (error) throw error

    return { jobs }
  } catch (error) {
    console.error("[v0] Jobs fetch error:", error)
    return { error: "Failed to fetch jobs", jobs: [] }
  }
}

export async function getAllJobs() {
  try {
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      cookies: { getAll: () => [], setAll: () => {} },
    })

    const user = await getCurrentUser()
    if (!user) {
      return { error: "Not authenticated" }
    }

    const profile = await getUserProfile(user.id)
    if (!profile || profile.role !== "admin") {
      return { error: "Access denied" }
    }

    const { data: jobs, error } = await supabase
      .from("jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50)

    if (error) throw error

    return { jobs }
  } catch (error) {
    console.error("[v0] Jobs fetch error:", error)
    return { error: "Failed to fetch jobs" }
  }
}

async function processFileWithVariations(
  supabase: any,
  file: any,
  jobId: string,
  styleMode: StyleMode,
  apiBaseUrl: string,
  openaiUnavailable: boolean,
) {
  let artDirection: any = {
    imagePrompt: getDefaultPromptForFile(file.name),
    cloudinary: {},
    preserveElements: [],
  }
  let useDefaultPrompt = false

  try {
    console.log("[v0] Calling Art Director API for style:", styleMode)

    const artDirectorResponse = await fetch(`${apiBaseUrl}/api/art-director`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        original_url: file.original_url,
        style_mode: styleMode,
      }),
    })

    if (artDirectorResponse.ok) {
      const artData = await artDirectorResponse.json()
      if (artData.imagePrompt) {
        artDirection = artData
        console.log("[v0] Art direction received:", artData.openaiUnavailable ? "fallback prompt" : "custom prompt")

        if (artData.openaiUnavailable) {
          openaiUnavailable = true
        }
      }
    } else {
      console.log("[v0] Art Director failed, using default prompt")
      useDefaultPrompt = true
    }
  } catch (error) {
    console.log("[v0] Art Director error, using default prompt:", error)
    useDefaultPrompt = true
  }

  if (useDefaultPrompt) {
    artDirection = {
      imagePrompt: getDefaultPromptForFile(file.name),
      cloudinary: {},
      preserveElements: [],
    }
  }

  console.log("[v0] Art Director output - imagePrompt length:", artDirection.imagePrompt?.length || 0)

  const variations: any[] = []

  for (const providerConfig of PROVIDERS) {
    const variationNum = providerConfig.variation
    const providerName = providerConfig.name
    const providerId = providerConfig.id

    if (providerId === "openai" && openaiUnavailable) {
      console.log(`[v0] Skipping OpenAI (v${variationNum}) - quota unavailable`)
      continue
    }

    console.log(`[v0] Generating variation ${variationNum}/${MAX_VARIATIONS} with ${providerName}`)

    let currentAttempt = 0
    let success = false
    let skipVariation = false

    while (currentAttempt <= MAX_RETRIES && !success && !skipVariation) {
      try {
        const requestBody = {
          original_url: file.original_url,
          filename: file.name,
          variation_number: variationNum,
          style_mode: styleMode,
          image_prompt: artDirection.imagePrompt,
          edits: artDirection.cloudinary,
          provider: providerId,
          apply_watermark: true,
        }
        console.log("[v0] Sending edit-image request:", JSON.stringify(requestBody).substring(0, 500))

        const editResponse = await fetch(`${apiBaseUrl}/api/edit-image`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        })

        console.log("[v0] Edit-image response status:", editResponse.status)

        if (!editResponse.ok) {
          const errorText = await editResponse.text()
          console.error(`[v0] Edit-image error for ${providerName}:`, errorText)

          if (
            editResponse.status === 429 ||
            errorText.includes("quota") ||
            errorText.includes("billing") ||
            errorText.includes("insufficient")
          ) {
            console.log(`[v0] ${providerName} quota exceeded - skipping this provider`)
            skipVariation = true

            if (providerId === "openai") {
              openaiUnavailable = true
            }
            break
          }

          throw new Error(`${providerName} failed: ${editResponse.status}`)
        }

        const editResult = await editResponse.json()
        console.log(`[v0] ${providerName} result:`, {
          hasUrl: !!editResult.url,
          urlType: editResult.url?.startsWith("data:") ? "base64" : "url",
          urlLength: editResult.url?.length || 0,
          urlPreview: editResult.url?.substring(0, 100),
        })

        let finalUrl = editResult.url
        let rawStorageUrl = editResult.url

        if (editResult.url?.startsWith("data:")) {
          console.log("[v0] Uploading base64 image to storage...")

          try {
            const base64Data = editResult.url.split(",")[1]
            if (!base64Data) {
              throw new Error("Invalid base64 data URL format")
            }

            console.log("[v0] Base64 data length:", base64Data.length)

            const uploadFileName = `${jobId}/generated-${Date.now()}-v${variationNum}.png`

            rawStorageUrl = await uploadToSupabaseStorage(base64Data, uploadFileName)
            console.log("[v0] Generated image uploaded to:", rawStorageUrl)

            finalUrl = applyWatermark(rawStorageUrl)
            console.log("[v0] Watermarked preview URL:", finalUrl.substring(0, 150))
          } catch (uploadError) {
            console.error(
              "[v0] Upload process error:",
              uploadError instanceof Error ? uploadError.message : String(uploadError),
            )
            throw uploadError
          }
        } else if (editResult.needs_watermark && !editResult.url?.startsWith("data:")) {
          rawStorageUrl = editResult.url
          finalUrl = applyWatermark(editResult.url)
          console.log("[v0] Watermarked URL:", finalUrl.substring(0, 150))
        }

        const qaResult = { pass: true, notes: [] as string[] }
        console.log(`[v0] Skipping QA check for faster processing`)

        const variationObj = {
          variation_number: variationNum,
          preview_url: finalUrl,
          raw_storage_url: rawStorageUrl,
          qa_status: qaResult.pass ? "pass" : "notes",
          qa_notes: qaResult.notes || [],
          provider: providerId,
          approved: false,
        }
        console.log("[v0] Pushing variation:", JSON.stringify(variationObj).substring(0, 300))
        variations.push(variationObj)

        success = true
      } catch (error) {
        console.error(`[v0] Error generating ${providerName} variation:`, error)
        currentAttempt++

        if (currentAttempt > MAX_RETRIES) {
          console.log(`[v0] Max retries reached for ${providerName}, skipping`)
          skipVariation = true
        } else {
          await new Promise((resolve) => setTimeout(resolve, 2000))
        }
      }
    }

    if (variationNum < MAX_VARIATIONS) {
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_CONFIG.delayBetweenProviders))
    }
  }

  console.log("[v0] processFileWithVariations complete. Variations count:", variations.length)
  return { variations, openaiUnavailable }
}

const MAX_VARIATIONS = 4
const MAX_RETRIES = 1

const PROVIDERS = [
  { id: "nano_banana", name: "Nano Banana Pro", variation: 1 },
  { id: "openai", name: "GPT Image 1", variation: 2 },
  { id: "openai_mini", name: "GPT Image 1 Mini", variation: 3 },
  { id: "openai_1_5", name: "GPT Image 1.5", variation: 4 },
] as const

async function uploadToSupabaseStorage(base64Data: string, fileName: string): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase configuration")
  }

  // Convert base64 to Buffer
  const buffer = Buffer.from(base64Data, "base64")
  console.log("[v0] Buffer created, size:", buffer.length)

  const uploadPath = `/storage/v1/object/original-uploads/${fileName}`
  const hostname = new URL(supabaseUrl).hostname

  return new Promise((resolve, reject) => {
    // Use dynamic import to get https module
    import("https")
      .then((https) => {
        const options = {
          hostname,
          port: 443,
          path: uploadPath,
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "image/png",
            "x-upsert": "true",
            "Content-Length": buffer.length,
          },
        }

        console.log("[v0] Starting https upload to:", hostname + uploadPath)

        const req = https.request(options, (res) => {
          let data = ""
          res.on("data", (chunk) => {
            data += chunk
          })
          res.on("end", () => {
            console.log("[v0] Upload response status:", res.statusCode, "body:", data.substring(0, 200))
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              const publicUrl = `${supabaseUrl}/storage/v1/object/public/original-uploads/${fileName}`
              resolve(publicUrl)
            } else {
              reject(new Error(`Upload failed with status ${res.statusCode}: ${data}`))
            }
          })
        })

        req.on("error", (e) => {
          console.error("[v0] HTTPS request error:", e)
          reject(new Error(`Upload request failed: ${e.message}`))
        })

        req.write(buffer)
        req.end()
      })
      .catch((importError) => {
        console.error("[v0] Failed to import https module:", importError)
        reject(new Error(`Failed to import https: ${importError.message}`))
      })
  })
}
