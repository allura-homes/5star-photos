"use server"

import { createClient } from "@/lib/supabase/server"
import type { UserImage, PhotoClassification, EnhancementPreferences } from "@/lib/types"

// Safe revalidation helper - revalidatePath doesn't work in v0 preview
function safeRevalidate(_path: string) {
  // No-op in v0 preview environment
  // revalidatePath causes "e.getAll is not a function" errors
}

// Get all images for the current user (originals only, with variations nested)
export async function getUserImages(): Promise<{ images: UserImage[]; error?: string }> {
  try {
    const supabase = await createClient()

    // Use getSession() instead of getUser() - it doesn't throw on missing session
    const {
      data: { session },
    } = await supabase.auth.getSession()
    
    if (!session?.user) {
      return { images: [], error: "Not authenticated" }
    }
    
    const user = session.user

    // Fetch all user images
    const { data: allImages, error } = await supabase
      .from("images")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[v0] getUserImages query error:", error)
      return { images: [], error: error.message }
    }

    // Organize into nested structure: originals with variations
    const originals = allImages?.filter((img) => img.is_original) || []
    const variations = allImages?.filter((img) => !img.is_original) || []

    // Nest variations under their parent originals
    const nestedImages = originals.map((original) => ({
      ...original,
      variations: variations.filter((v) => v.parent_image_id === original.id),
    }))

    return { images: nestedImages as UserImage[] }
  } catch (error) {
    console.error("[v0] getUserImages error:", error)
    return { images: [], error: error instanceof Error ? error.message : "Failed to load images" }
  }
}

// Get a single image by ID with its variations
export async function getImageById(imageId: string): Promise<{ image: UserImage | null; error?: string }> {
  const supabase = await createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()
  
  console.log("[v0] getImageById - session exists:", !!session?.user)
  
  if (!session?.user) {
    return { image: null, error: "Not authenticated" }
  }
  const user = session.user

  const { data: image, error } = await supabase
    .from("images")
    .select("*")
    .eq("id", imageId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (error) {
    console.log("[v0] getImageById - image fetch error:", error.message)
    return { image: null, error: error.message }
  }
  
  if (!image) {
    console.log("[v0] getImageById - image not found:", imageId)
    return { image: null, error: "Image not found" }
  }
  
  console.log("[v0] getImageById - image found:", image.original_filename)

  // Also fetch any saved variations
  const { data: variations, error: varError } = await supabase
    .from("images")
    .select("*")
    .eq("parent_image_id", imageId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  console.log("[v0] getImageById - variations found:", variations?.length || 0, "error:", varError?.message)

  return {
    image: {
      ...image,
      variations: variations || [],
    } as UserImage,
  }
}

// Transform a single image - generates preview variations
export async function transformImage(
  imageId: string,
  preferences: EnhancementPreferences,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.user) {
    return { success: false, error: "Not authenticated" }
  }
  const user = session.user

  // Get the image
  const { data: image } = await supabase.from("images").select("*").eq("id", imageId).eq("user_id", user.id).single()

  if (!image) {
    return { success: false, error: "Image not found" }
  }

  // Check token balance (1 token for transform if not first time)
  const { data: profile } = await supabase.from("profiles").select("tokens").eq("id", user.id).single()

  // Check if this image has been transformed before
  const { count } = await supabase
    .from("token_transactions")
    .select("*", { count: "exact", head: true })
    .eq("image_id", imageId)
    .eq("type", "revision")

  const isFirstTransform = (count || 0) === 0

  // TEMPORARILY DISABLED: All transforms are free for development/testing
  // Token deduction bypassed - just log the transaction
  await supabase.from("token_transactions").insert({
    user_id: user.id,
    type: "revision",
    amount: 0, // No deduction
    image_id: imageId,
    description: `${isFirstTransform ? "Initial" : "Re-"}transform of ${image.original_filename} (FREE - tokens disabled)`,
  })

  // The actual transformation happens via the API route which is called client-side
  // This function just handles the token logic
  return { success: true }
}

async function uploadToStorage(base64Data: string, storagePath: string, contentType: string): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[v0] uploadToStorage: Missing Supabase configuration")
    throw new Error("Missing Supabase configuration")
  }

  // Convert base64 to Buffer
  const buffer = Buffer.from(base64Data, "base64")
  console.log("[v0] uploadToStorage: Buffer size:", buffer.length, "bytes, content type:", contentType)

  // Normalize and validate content type - Supabase is strict about MIME types
  const validMimeTypes: Record<string, string> = {
    "image/jpeg": "image/jpeg",
    "image/jpg": "image/jpeg",
    "image/png": "image/png",
    "image/webp": "image/webp",
    "image/heic": "image/heic",
    "image/heif": "image/heif",
  }
  
  // Get extension from path for fallback
  const ext = storagePath.split(".").pop()?.toLowerCase() || "jpg"
  const extToMime: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    heic: "image/heic",
    heif: "image/heif",
  }
  
  // Normalize the content type
  const normalizedContentType = validMimeTypes[contentType?.toLowerCase()] || extToMime[ext] || "image/jpeg"

  const uploadPath = `/storage/v1/object/original-uploads/${storagePath}`
  const hostname = new URL(supabaseUrl).hostname

  return new Promise((resolve, reject) => {
    import("https")
      .then((https) => {
        const options = {
          hostname,
          port: 443,
          path: uploadPath,
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": normalizedContentType,
            "x-upsert": "true",
            "Content-Length": buffer.length,
          },
        }

        const req = https.request(options, (res) => {
          let data = ""
          res.on("data", (chunk) => {
            data += chunk
          })
          res.on("end", () => {
            console.log("[v0] uploadToStorage: Response status:", res.statusCode, "data:", data?.substring(0, 200))
            
            // Check for error messages in response body (Vercel may return 200 with error in body)
            const isPayloadTooLarge = data?.includes("FUNCTION_PAYLOAD_TOO_LARGE") || 
                                       data?.includes("Request Entity Too Large") ||
                                       data?.includes("PayloadTooLargeError")
            
            if (isPayloadTooLarge) {
              console.error("[v0] uploadToStorage: File too large for serverless function")
              reject(new Error("File is too large. Please use an image under 4MB or compress it before uploading."))
              return
            }
            
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              const publicUrl = `${supabaseUrl}/storage/v1/object/public/original-uploads/${storagePath}`
              console.log("[v0] uploadToStorage: Success, URL:", publicUrl)
              resolve(publicUrl)
            } else {
              console.error("[v0] uploadToStorage: Failed with status", res.statusCode, data)
              reject(new Error(`Upload failed with status ${res.statusCode}: ${data}`))
            }
          })
        })

        req.on("error", (e) => {
          console.error("[v0] uploadToStorage: Request error:", e)
          reject(new Error(`Upload request failed: ${e.message}`))
        })

        req.write(buffer)
        req.end()
      })
      .catch(reject)
  })
}

// Upload a new original image
export async function uploadImage(
  fileBase64: string,
  fileName: string,
  fileType: string,
  classification: PhotoClassification,
  projectId?: string | null,
): Promise<{ image: UserImage | null; error?: string }> {
  const supabase = await createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.user) {
    return { image: null, error: "Not authenticated" }
  }
  const user = session.user

  // TEMPORARILY DISABLED: Token balance check for development/testing
  const { data: profile } = await supabase.from("profiles").select("tokens").eq("id", user.id).single()
  // Token check bypassed - uncomment to re-enable:
  // if (!profile || profile.tokens < 1) {
  //   return { image: null, error: "Insufficient tokens" }
  // }

  // Convert base64 - strip data URL prefix if present
  const base64Data = fileBase64.includes(",") ? fileBase64.split(",")[1] : fileBase64
  
  // Log upload attempt
  console.log("[v0] uploadImage: Starting upload for", fileName, "size:", base64Data.length, "chars")

  // Generate unique storage path
  const fileExt = fileName.split(".").pop()?.toLowerCase() || "jpg"
  const storagePath = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

  try {
    console.log("[v0] uploadImage: Uploading to path:", storagePath)
    const publicUrl = await uploadToStorage(base64Data, storagePath, fileType || "image/jpeg")
    console.log("[v0] uploadImage: Upload successful, URL:", publicUrl?.substring(0, 80) + "...")

    // Deduct token after successful upload
    const { error: tokenError } = await supabase
      .from("profiles")
      .update({ tokens: profile.tokens - 1 })
      .eq("id", user.id)

    if (tokenError) {
      return { image: null, error: "Failed to deduct token" }
    }

    // Create image record
    const { data: image, error } = await supabase
      .from("images")
      .insert({
        user_id: user.id,
        project_id: projectId || null,
        storage_path: publicUrl, // Store full URL for direct use in <Image> component
        thumbnail_path: null,
        original_filename: fileName,
        classification,
        metadata: { fileType, uploadedAt: new Date().toISOString(), storagePath }, // Keep relative path in metadata for storage operations
        is_original: true,
        source_model: null,
        transformation_prompt: null,
      })
      .select()
      .single()

    if (error) {
      // Refund token on failure
      await supabase.from("profiles").update({ tokens: profile.tokens }).eq("id", user.id)
      return { image: null, error: error.message }
    }

    // Use 'purchase' type instead of 'upload'
    await supabase.from("token_transactions").insert({
      user_id: user.id,
      type: "purchase",
      amount: -1,
      image_id: image.id,
      description: `Uploaded ${fileName}`,
    })

    safeRevalidate("/library")
    return { image: image as UserImage }
  } catch (uploadError) {
    console.error("[v0] Upload error:", uploadError)
    return {
      image: null,
      error: `Upload failed: ${uploadError instanceof Error ? uploadError.message : String(uploadError)}`,
    }
  }
}

// Save a variation as a new base image
export async function saveVariation(
  parentImageId: string,
  imageData: string, // Can be a base64 data URL or a regular URL
  thumbnailPath: string | null,
  sourceModel: string,
  transformationPrompt: string | null,
): Promise<{ image: UserImage | null; error?: string }> {
  const supabase = await createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.user) {
    return { image: null, error: "Not authenticated" }
  }
  const user = session.user

  // Get parent image info
  const { data: parentImage } = await supabase
    .from("images")
    .select("*")
    .eq("id", parentImageId)
    .eq("user_id", user.id)
    .single()

  if (!parentImage) {
    return { image: null, error: "Parent image not found" }
  }

  // TEMPORARILY DISABLED: Token balance check for development/testing
  // Save variation is free for now
  const { data: profile } = await supabase.from("profiles").select("tokens").eq("id", user.id).single()

  let finalStoragePath = imageData

  // Check if imageData is a base64 data URL and needs to be uploaded
  if (imageData.startsWith("data:image/")) {
    try {
      // Extract base64 data
      const matches = imageData.match(/^data:image\/(\w+);base64,(.+)$/)
      if (!matches) {
        return { image: null, error: "Invalid base64 image format" }
      }

      const imageFormat = matches[1]
      const base64Data = matches[2]
      const buffer = Buffer.from(base64Data, "base64")

      // Generate unique filename
      const timestamp = Date.now()
      const randomId = Math.random().toString(36).substring(2, 8)
      const filename = `variation-${timestamp}-${randomId}.${imageFormat === "jpeg" ? "jpg" : imageFormat}`
      const storagePath = `${user.id}/variations/${filename}`

      // Upload using direct HTTPS to Supabase Storage
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

      const uploadResponse = await fetch(
        `${supabaseUrl}/storage/v1/object/original-uploads/${storagePath}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": `image/${imageFormat}`,
            "x-upsert": "true",
          },
          body: buffer,
        },
      )

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text()
        console.error("[v0] Variation upload failed:", errorText)
        return { image: null, error: `Failed to upload variation: ${errorText}` }
      }

      // Generate public URL
      finalStoragePath = `${supabaseUrl}/storage/v1/object/public/original-uploads/${storagePath}`
      console.log("[v0] Variation uploaded successfully:", finalStoragePath)
    } catch (uploadError) {
      console.error("[v0] Variation upload error:", uploadError)
      return {
        image: null,
        error: `Upload failed: ${uploadError instanceof Error ? uploadError.message : String(uploadError)}`,
      }
    }
  }

  // Create variation record
  const { data: image, error } = await supabase
    .from("images")
    .insert({
      user_id: user.id,
      parent_image_id: parentImageId,
      storage_path: finalStoragePath,
      thumbnail_path: thumbnailPath || finalStoragePath,
      original_filename: parentImage.original_filename,
      classification: parentImage.classification,
      metadata: parentImage.metadata,
      is_original: false,
      source_model: sourceModel,
      transformation_prompt: transformationPrompt,
    })
    .select()
    .single()

  if (error) {
    console.error("[v0] Failed to save variation record:", error)
    return { image: null, error: error.message }
  }

  await supabase.from("token_transactions").insert({
    user_id: user.id,
    type: "purchase",
    amount: 0, // Free in development mode
    image_id: image.id,
    description: `Saved variation of ${parentImage.original_filename} (FREE - tokens disabled)`,
  })

  safeRevalidate("/library")
  return { image: image as UserImage }
}

// Update image classification
export async function updateImageClassification(
  imageId: string,
  classification: PhotoClassification,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.user) {
    return { success: false, error: "Not authenticated" }
  }
  const user = session.user

  const { error } = await supabase.from("images").update({ classification }).eq("id", imageId).eq("user_id", user.id)

  if (error) {
    return { success: false, error: error.message }
  }

  safeRevalidate("/library")
  return { success: true }
}

// Delete an image
export async function deleteImage(imageId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.user) {
    return { success: false, error: "Not authenticated" }
  }
  const user = session.user

  // Delete from database (cascade will handle variations)
  const { error } = await supabase.from("images").delete().eq("id", imageId).eq("user_id", user.id)

  if (error) {
    return { success: false, error: error.message }
  }

  safeRevalidate("/library")
  return { success: true }
}

// Delete multiple images at once
export async function deleteImages(imageIds: string[]): Promise<{ success: boolean; deletedCount: number; error?: string }> {
  const supabase = await createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.user) {
    return { success: false, deletedCount: 0, error: "Not authenticated" }
  }
  const user = session.user

  // Delete all images in the list
  const { error, count } = await supabase
    .from("images")
    .delete({ count: "exact" })
    .in("id", imageIds)
    .eq("user_id", user.id)

  if (error) {
    return { success: false, deletedCount: 0, error: error.message }
  }

  safeRevalidate("/library")
  return { success: true, deletedCount: count || 0 }
}

// Record a download transaction (4 tokens)
export async function recordDownload(
  imageId: string,
): Promise<{ success: boolean; downloadUrl?: string; error?: string }> {
  const supabase = await createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.user) {
    return { success: false, error: "Not authenticated" }
  }
  const user = session.user

  // Get image info
  const { data: image } = await supabase.from("images").select("*").eq("id", imageId).eq("user_id", user.id).single()

  if (!image) {
    return { success: false, error: "Image not found" }
  }

  // TEMPORARILY DISABLED: Token balance check for development/testing
  // Download is free for now - just log the transaction
  await supabase.from("token_transactions").insert({
    user_id: user.id,
    type: "upscale",
    amount: 0, // No deduction
    image_id: imageId,
    description: `Downloaded hi-res ${image.original_filename} (FREE - tokens disabled)`,
  })

  // Generate signed URL for download
  const { data: signedUrl } = await supabase.storage.from("original-uploads").createSignedUrl(image.storage_path, 3600) // 1 hour expiry

  safeRevalidate("/library")
  return { success: true, downloadUrl: signedUrl?.signedUrl }
}
