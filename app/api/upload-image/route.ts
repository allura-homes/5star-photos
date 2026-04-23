import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { put } from "@vercel/blob"
import { v4 as uuidv4 } from "uuid"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const {
      data: { session },
    } = await supabase.auth.getSession()
    
    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    
    const user = session.user
    
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const classification = formData.get("classification") as string || "unknown"
    const projectId = formData.get("projectId") as string | null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/heic"]
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload a JPG, PNG, WebP, or HEIC image." },
        { status: 400 }
      )
    }

    // Validate file size (50MB limit)
    const maxSize = 50 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 50MB." },
        { status: 400 }
      )
    }
    
    // Check token balance (temporarily disabled for development)
    const { data: profile } = await supabase.from("profiles").select("tokens").eq("id", user.id).single()
    // Token check bypassed - uncomment to re-enable:
    // if (!profile || profile.tokens < 1) {
    //   return NextResponse.json({ error: "Insufficient tokens" }, { status: 402 })
    // }

    // Generate unique filename
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg"
    const filename = `user-images/${user.id}/${uuidv4()}.${extension}`

    console.log("[v0] Uploading image:", filename, "size:", file.size)

    // Upload to Vercel Blob
    const blob = await put(filename, file, {
      access: "public",
      addRandomSuffix: false,
    })
    
    console.log("[v0] Blob upload successful:", blob.url)

    // Deduct token after successful upload
    if (profile) {
      const { error: tokenError } = await supabase
        .from("profiles")
        .update({ tokens: profile.tokens - 1 })
        .eq("id", user.id)
      
      if (tokenError) {
        console.error("[v0] Token deduction error:", tokenError)
      }
    }
    
    // Create image record
    const { data: image, error: dbError } = await supabase
      .from("images")
      .insert({
        user_id: user.id,
        project_id: projectId || null,
        storage_path: blob.url,
        thumbnail_path: null,
        original_filename: file.name,
        classification,
        metadata: { 
          fileType: file.type, 
          uploadedAt: new Date().toISOString(),
          blobUrl: blob.url,
          size: file.size,
        },
        is_original: true,
        source_model: null,
        transformation_prompt: null,
      })
      .select()
      .single()
    
    if (dbError) {
      console.error("[v0] Database insert error:", dbError)
      // Refund token on failure
      if (profile) {
        await supabase.from("profiles").update({ tokens: profile.tokens }).eq("id", user.id)
      }
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }
    
    // Log token transaction
    await supabase.from("token_transactions").insert({
      user_id: user.id,
      type: "purchase",
      amount: -1,
      image_id: image.id,
      description: `Uploaded ${file.name}`,
    })

    return NextResponse.json({ 
      success: true,
      image,
      url: blob.url,
    })
  } catch (error) {
    console.error("[v0] Image upload error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to upload image" },
      { status: 500 }
    )
  }
}
