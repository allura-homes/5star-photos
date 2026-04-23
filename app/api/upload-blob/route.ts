import { put } from "@vercel/blob"
import { type NextRequest, NextResponse } from "next/server"

/**
 * API route to upload base64 images directly to Vercel Blob storage.
 * Used for large AI-generated images that exceed the serverless function payload limit.
 * Returns the public URL which can then be stored in the database.
 */
export async function POST(request: NextRequest) {
  try {
    const { base64Data, filename } = await request.json()

    if (!base64Data) {
      return NextResponse.json({ error: "No image data provided" }, { status: 400 })
    }

    // Extract the actual base64 content (remove data URL prefix if present)
    let base64Content = base64Data
    let contentType = "image/jpeg"
    
    if (base64Data.startsWith("data:")) {
      const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/)
      if (matches) {
        contentType = matches[1]
        base64Content = matches[2]
      }
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(base64Content, "base64")
    
    // Determine file extension from content type
    const ext = contentType.includes("png") ? "png" : "jpg"
    const finalFilename = filename || `variation-${Date.now()}.${ext}`

    // Upload to Vercel Blob
    const blob = await put(`variations/${finalFilename}`, buffer, {
      access: "public",
      contentType,
    })

    return NextResponse.json({ url: blob.url })
  } catch (error) {
    console.error("[v0] Blob upload error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    )
  }
}

// Increase body size limit for this route to handle large images
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
}
