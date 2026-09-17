import { NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/lib/api-auth"
import { chargeForAction, refundCredits } from "@/lib/credits"
import { CREDIT_COSTS } from "@/lib/plans"
import { isDataUrl, persistDataUrlAsVariation } from "@/lib/storage/upload-data-url"

export const maxDuration = 60

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

    const { parentImageId, imageData, sourceModel, transformationPrompt, autoSave } = body ?? {}

    if (!parentImageId || !imageData) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // BILLING: results are stored automatically after a transform as part of
    // that transform's price. Explicitly saving a result as a new working
    // image (so it can be re-transformed) is its own 1-credit action.
    const isBillable = autoSave !== true
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

    if (isBillable) {
      const charge = await chargeForAction(userId, "save_variation", {
        description: `Saved working image from ${parentImage.original_filename}`,
        imageId: parentImageId,
      })
      if (!charge.ok) {
        return NextResponse.json(
          {
            error: charge.code === "past_due" ? "Your last payment failed." : "You're out of credits.",
            code: charge.code === "past_due" ? "PAST_DUE" : "INSUFFICIENT_CREDITS",
            required: CREDIT_COSTS.save_variation,
            available: charge.total,
            plan: charge.plan,
          },
          { status: 402 },
        )
      }
    }

    let finalStoragePath = imageData

    // Normally /api/edit-image has already stored the result and sent a URL;
    // this branch remains for older clients and the storage-failure fallback.
    if (isDataUrl(imageData)) {
      console.log("[v0] Uploading base64 image to storage, length:", imageData.length)

      try {
        finalStoragePath = await persistDataUrlAsVariation(userId, imageData)
        console.log("[v0] Upload successful, URL:", finalStoragePath.substring(0, 100))
      } catch (uploadError) {
        // Capture specific error during upload
        const errMsg = uploadError instanceof Error ? uploadError.message : String(uploadError)
        console.error("[v0] Upload exception:", errMsg)
        if (isBillable) {
          await refundCredits(userId, CREDIT_COSTS.save_variation, {
            description: "Refund: save failed",
            imageId: parentImageId,
          })
        }
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
      if (isBillable) {
        await refundCredits(userId, CREDIT_COSTS.save_variation, {
          description: "Refund: save failed",
          imageId: parentImageId,
        })
      }
      return NextResponse.json({ error: "Failed to save variation record" }, { status: 500 })
    }
    const image = insertedImages[0]
    console.log("[v0] Variation record created:", image.id)

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
