import { NextResponse } from "next/server"

// Upscale images using fal.ai ESRGAN
// Returns a higher-resolution version of the input image
//
// DEPRECATED 2026-05-15: fal.ai upscaling disabled due to billing issues
// To re-enable: Remove the early return below and ensure FAL_KEY is configured
// The fal.ai ESRGAN code is preserved below for future use

export async function POST(request: Request) {
  try {
    const { imageUrl } = await request.json()

    if (!imageUrl) {
      return NextResponse.json({ error: "Image URL is required" }, { status: 400 })
    }

    // DEPRECATED: Skip fal.ai upscaling, return original image
    // This allows downloads to work without fal.ai billing
    console.log("[v0] Upscaling disabled (fal.ai deprecated), returning original image")
    return NextResponse.json({ url: imageUrl, upscaled: false })

    /* PRESERVED FOR FUTURE RE-ENABLEMENT:
    const falKey = process.env.FAL_KEY
    if (!falKey) {
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
        scale: Math.min(scale, 4),
        model: "RealESRGAN_x4plus",
        output_format: "png",
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] Upscale error:", errorText)
      return NextResponse.json({ url: imageUrl, upscaled: false })
    }

    const result = await response.json()
    console.log("[v0] Upscale complete")

    if (result.image?.url) {
      return NextResponse.json({ 
        url: result.image.url, 
        upscaled: true,
        originalUrl: imageUrl,
        width: result.image.width,
        height: result.image.height,
      })
    }

    return NextResponse.json({ url: imageUrl, upscaled: false })
    */
  } catch (error) {
    console.error("[v0] Upscale error:", error)
    const { imageUrl } = await request.json().catch(() => ({ imageUrl: null }))
    return NextResponse.json({ url: imageUrl, upscaled: false })
  }
}
