import { NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/lib/api-auth"

export const maxDuration = 60

// Upload to Supabase Storage using base64 encoded body
// This works around v0's fetch binary issues by sending base64 in the URL path
async function uploadToSupabaseStorage(
  storagePath: string, 
  base64Data: string, 
  contentType: string
): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase not configured")
  }
  
  // Convert base64 to binary using atob and Uint8Array
  const binaryString = atob(base64Data)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  
  // Use Blob for the upload body - this works better in v0 runtime
  const blob = new Blob([bytes], { type: contentType })
  
  const uploadUrl = `${supabaseUrl}/storage/v1/object/original-uploads/${storagePath}`
  
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: blob,
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Storage upload failed: ${response.status} ${errorText}`)
  }

  // Return the public URL
  return `${supabaseUrl}/storage/v1/object/public/original-uploads/${storagePath}`
}

// Helper to make Supabase REST API calls directly
async function supabaseRest(endpoint: string, options: { method?: string; body?: unknown } = {}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase not configured")
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${endpoint}`, {
    method: options.method || "GET",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      Prefer: options.method === "POST" ? "return=representation" : "return=minimal",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Supabase REST error: ${response.status} ${errorText}`)
  }

  const text = await response.text()
  return text ? JSON.parse(text) : null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
  console.log("[v0] Save variation API started")
  try {
    // SECURITY: the user is always the authenticated session user. The
    // request body is never trusted for identity.
    const auth = await requireUser(request)
    if (!auth.ok) return auth.response
    const userId = auth.user.id

    let body
    try {
      body = await request.json()
    } catch (parseErr) {
      console.error("[v0] Save variation JSON parse error:", parseErr)
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const { parentImageId, imageData, sourceModel, transformationPrompt } = body ?? {}

    if (!parentImageId || !imageData) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }
    if (typeof parentImageId !== "string" || !UUID_RE.test(parentImageId)) {
      return NextResponse.json({ error: "Invalid parent image id" }, { status: 400 })
    }
    if (typeof imageData !== "string" || imageData.length > 30 * 1024 * 1024) {
      return NextResponse.json({ error: "Image payload invalid or too large" }, { status: 400 })
    }

    // Ownership check: the parent image must belong to the caller.
    console.log("[v0] Fetching parent image...")
    const parentImages = await supabaseRest(`images?id=eq.${parentImageId}&user_id=eq.${userId}&select=*`)
    if (!parentImages || parentImages.length === 0) {
      return NextResponse.json({ error: "Parent image not found" }, { status: 404 })
    }
    const parentImage = parentImages[0]
    console.log("[v0] Parent image found:", parentImage.original_filename)

    let finalStoragePath = imageData

    // Check if imageData is a base64 data URL and needs to be uploaded
    if (imageData.startsWith("data:image/")) {
      console.log("[v0] Uploading base64 image to Vercel Blob...")
      
      try {
        // Extract base64 data
        const matches = imageData.match(/^data:image\/(\w+);base64,(.+)$/)
        if (!matches) {
          return NextResponse.json({ error: "Invalid base64 image format" }, { status: 400 })
        }

        const imageFormat = matches[1]
        const base64Data = matches[2]
        console.log("[v0] Base64 format:", imageFormat, "data length:", base64Data.length)
        
        // Generate unique filename for storage
        const timestamp = Date.now()
        const randomId = Math.random().toString(36).substring(2, 8)
        const storagePath = `${userId}/variations/variation-${timestamp}-${randomId}.${imageFormat === "jpeg" ? "jpg" : imageFormat}`
        console.log("[v0] Uploading to storage path:", storagePath)

        // Upload to Supabase Storage
        const publicUrl = await uploadToSupabaseStorage(storagePath, base64Data, `image/${imageFormat}`)
        console.log("[v0] Upload successful, URL:", publicUrl.substring(0, 100))

        finalStoragePath = publicUrl
      } catch (uploadError) {
        // Capture specific error during upload
        const errMsg = uploadError instanceof Error ? uploadError.message : String(uploadError)
        console.error("[v0] Upload exception:", errMsg)
        return NextResponse.json({ error: "We couldn't save this image. Please try again.", code: "UPLOAD_FAILED" }, { status: 500 })
      }
    }

    // Create variation record using REST API
    console.log("[v0] Creating variation record...")
    const imageRecord = {
      user_id: userId,
      parent_image_id: parentImageId,
      storage_path: finalStoragePath,
      thumbnail_path: finalStoragePath,
      original_filename: parentImage.original_filename,
      classification: parentImage.classification,
      metadata: parentImage.metadata,
      is_original: false,
      source_model: sourceModel,
      transformation_prompt: transformationPrompt,
    }

    const insertedImages = await supabaseRest("images", {
      method: "POST",
      body: imageRecord,
    })

    if (!insertedImages || insertedImages.length === 0) {
      return NextResponse.json({ error: "Failed to save variation record" }, { status: 500 })
    }
    const image = insertedImages[0]
    console.log("[v0] Variation record created:", image.id)

    // Usage log. Amount is 0 while TOKENS_ENFORCED is false (free beta).
    await supabaseRest("token_transactions", {
      method: "POST",
      body: {
        user_id: userId,
        type: "save_variation",
        amount: 0,
        image_id: image.id,
        description: `Saved variation of ${parentImage.original_filename} (free beta)`,
      },
    })

    console.log("[v0] Save variation complete!")
    return NextResponse.json({ success: true, image })
  } catch (error) {
    let errorMessage = "Unknown error"
    if (error && typeof error === "object" && "message" in error) {
      errorMessage = String(error.message)
    } else if (typeof error === "string") {
      errorMessage = error
    }
    console.error("[v0] Save variation error:", errorMessage)
    return NextResponse.json({ error: "We couldn't save this variation. Please try again.", code: "SAVE_FAILED" }, { status: 500 })
  }
}
