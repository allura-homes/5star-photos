import { NextResponse, type NextRequest } from "next/server"
import { requireUser } from "@/lib/api-auth"
import { chargeForAction, refundCredits } from "@/lib/credits"
import { CREDIT_COSTS } from "@/lib/plans"

// Hi-res download gate.
//
// Every hi-res download goes through here so the credit charge is enforced
// server-side. Real upscaling (fal.ai ESRGAN) is currently disabled; when it is
// re-enabled set UPSCALE_ENABLED=true and the extra `upscale` credit is charged
// on top of the download.
//
// DEPRECATED 2026-05-15: fal.ai upscaling disabled due to billing issues.

const UPSCALE_ENABLED = process.env.UPSCALE_ENABLED === "true"

function isAllowedImageUrl(raw: string): boolean {
  try {
    const url = new URL(raw)
    if (url.protocol !== "https:") return false
    const supabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname
    return (
      url.hostname === supabaseHost ||
      url.hostname.endsWith(".public.blob.vercel-storage.com") ||
      url.hostname.endsWith(".fal.media") ||
      url.hostname === "res.cloudinary.com"
    )
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  // SECURITY: gate before any paid provider call.
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  const userId = auth.user.id

  let body: { imageUrl?: unknown; scale?: unknown; filename?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl : ""
  if (!imageUrl || (!imageUrl.startsWith("data:image/") && !isAllowedImageUrl(imageUrl))) {
    return NextResponse.json({ error: "Image URL is required" }, { status: 400 })
  }
  const filename = typeof body.filename === "string" ? body.filename.slice(0, 200) : "photo"

  const total = CREDIT_COSTS.download_hires + (UPSCALE_ENABLED ? CREDIT_COSTS.upscale : 0)
  const charge = await chargeForAction(userId, "download_hires", {
    description: `Hi-res download of ${filename}`,
    amount: total,
  })
  if (!charge.ok) {
    return NextResponse.json(
      {
        error: charge.code === "past_due" ? "Your last payment failed." : "You're out of credits.",
        code: charge.code === "past_due" ? "PAST_DUE" : "INSUFFICIENT_CREDITS",
        required: total,
        available: charge.total,
        plan: charge.plan,
      },
      { status: 402 },
    )
  }

  if (!UPSCALE_ENABLED) {
    return NextResponse.json({ url: imageUrl, upscaled: false, creditsRemaining: charge.total })
  }

  try {
    const falKey = process.env.FAL_KEY
    if (!falKey) {
      await refundCredits(userId, CREDIT_COSTS.upscale, { description: "Refund: upscaler unavailable" })
      return NextResponse.json({ url: imageUrl, upscaled: false })
    }

    const scale = typeof body.scale === "number" ? Math.min(Math.max(body.scale, 1), 4) : 2
    const response = await fetch("https://fal.run/fal-ai/esrgan", {
      method: "POST",
      headers: { Authorization: `Key ${falKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: imageUrl, scale, model: "RealESRGAN_x4plus", output_format: "png" }),
    })

    if (!response.ok) {
      console.error("[v0] Upscale error:", response.status)
      await refundCredits(userId, CREDIT_COSTS.upscale, { description: "Refund: upscale failed" })
      return NextResponse.json({ url: imageUrl, upscaled: false })
    }

    const result = await response.json()
    if (result.image?.url) {
      return NextResponse.json({
        url: result.image.url,
        upscaled: true,
        originalUrl: imageUrl,
        width: result.image.width,
        height: result.image.height,
      })
    }

    await refundCredits(userId, CREDIT_COSTS.upscale, { description: "Refund: upscale returned no image" })
    return NextResponse.json({ url: imageUrl, upscaled: false })
  } catch (error) {
    console.error("[v0] Upscale error:", error)
    await refundCredits(userId, CREDIT_COSTS.upscale, { description: "Refund: upscale failed" })
    return NextResponse.json({ url: imageUrl, upscaled: false })
  }
}
