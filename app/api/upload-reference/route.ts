import { NextRequest, NextResponse } from "next/server"
import { put } from "@vercel/blob"
import { v4 as uuidv4 } from "uuid"
import { requireUser } from "@/lib/api-auth"

export async function POST(request: NextRequest) {
  try {
    // SECURITY: only signed-in users may upload to Blob storage.
    const auth = await requireUser(request)
    if (!auth.ok) return auth.response

    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload a JPG, PNG, WebP, or GIF image." },
        { status: 400 }
      )
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB." },
        { status: 400 }
      )
    }

    // Generate unique filename. Extension is derived from the validated MIME
    // type (never from the user-supplied filename) and the path is scoped to
    // the caller so uploads are attributable.
    const extByType: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
    }
    const extension = extByType[file.type] ?? "jpg"
    const filename = `reference-images/${auth.user.id}/${uuidv4()}.${extension}`

    // Upload to Vercel Blob
    const blob = await put(filename, file, {
      access: "public",
      addRandomSuffix: false,
    })

    return NextResponse.json({ url: blob.url })
  } catch (error) {
    console.error("[v0] Reference image upload error:", error)
    return NextResponse.json(
      { error: "Failed to upload reference image" },
      { status: 500 }
    )
  }
}
