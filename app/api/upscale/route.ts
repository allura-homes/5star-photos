import { NextResponse } from "next/server"

// Upscale images using fal.ai ESRGAN
// Returns a higher-resolution version of the input image

export async function POST(request: Request) {
  try {
    const { imageUrl, scale = 2 } = await request.json()

    if (!imageUrl) {
      return NextResponse.json({ error: "Image URL is required" }, { status: 400 })
    }

    const falKey = process.env.FAL_KEY
    if (!falKey) {
      // If no fal key, just return the original URL
      console.warn("[v0] No FAL_KEY configured, returning original image")
      return NextResponse.json({ url: imageUrl })
    }

    console.log(`[v0] Upscaling image ${scale}x using ESRGAN...`)

    const response = await fetch("https://fal.run/fal-ai/esrgan", {
      method: "POST",
      headers: {
        "Authorization": `Key ${falKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image_url: imageUrl,
        scale: Math.min(scale, 4), // Cap at 4x to avoid excessive processing time
        model: "RealESRGAN_x4plus", // Best quality model
        output_format: "png",
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] Upscale error:", errorText)
      // Return original if upscale fails
      return NextResponse.json({ url: imageUrl, upscaled: false })
    }

    const result = await response.json()
    console.log("[v0] Upscale complete")

    // fal returns result.image as an object with { url, content_type, file_name, file_size, width, height }
    if (result.image?.url) {
      return NextResponse.json({ 
        url: result.image.url, 
        upscaled: true,
        originalUrl: imageUrl,
        width: result.image.width,
        height: result.image.height,
      })
    }

    // Fallback to original
    return NextResponse.json({ url: imageUrl, upscaled: false })
  } catch (error) {
    console.error("[v0] Upscale error:", error)
    // Return original URL on any error
    const { imageUrl } = await request.json().catch(() => ({ imageUrl: null }))
    return NextResponse.json({ url: imageUrl, upscaled: false })
  }
}
