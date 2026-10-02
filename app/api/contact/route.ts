import { createHmac } from "node:crypto"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { contactSchema, SUPPORT_EMAIL } from "@/lib/contact"

export const runtime = "nodejs"
export const maxDuration = 30

const MAX_BODY_BYTES = 32_768
const SEND_WINDOW_MS = 5 * 60_000

function json(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin")
  const sameOrigin = request.headers.get("sec-fetch-site") === "same-origin" || origin === request.nextUrl.origin
  if (!origin || !sameOrigin) return json({ error: "Please send your message from the Help page." }, 403)
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return json({ error: "Unsupported request format." }, 415)
  }

  let body: unknown
  try {
    const reader = request.body?.getReader()
    if (!reader) return json({ error: "Please include a message." }, 400)
    const chunks: Uint8Array[] = []
    let size = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_BODY_BYTES) {
        await reader.cancel()
        return json({ error: "Your message is too large." }, 413)
      }
      chunks.push(value)
    }
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"))
  } catch {
    return json({ error: "We could not read your message. Please try again." }, 400)
  }

  const parsed = contactSchema.safeParse(body)
  if (!parsed.success) return json({ error: "Please check the highlighted fields.", fields: parsed.error.flatten().fieldErrors }, 400)
  if (parsed.data.website) return json({ error: "Your message could not be sent. Please email us directly." }, 400)

  const apiKey = process.env.RESEND_API_KEY
  const sender = z.string().email().safeParse(process.env.CONTACT_FROM_EMAIL)
  if (!apiKey || !sender.success) {
    return json({ error: "The contact form is temporarily unavailable. Please email our team directly below." }, 503)
  }

  const { name, email, topic, message } = parsed.data
  const ip = (request.headers.get("x-vercel-forwarded-for") || request.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim().slice(0, 128)
  const bucket = Math.floor(Date.now() / SEND_WINDOW_MS)
  // Resend enforces this key across serverless instances: retries of the same
  // message deduplicate; a different message from the same IP/window gets 409.
  // HMAC keeps the visitor's IP out of provider metadata.
  const fingerprint = createHmac("sha256", apiKey).update(`${ip}:${bucket}`).digest("hex")

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `5star-contact/${fingerprint}`,
      },
      body: JSON.stringify({
        from: `5star.photos <${sender.data}>`,
        to: [SUPPORT_EMAIL],
        reply_to: email,
        subject: `[5star.photos] ${topic}`,
        text: `New website contact request\n\nName: ${name}\nEmail: ${email}\nTopic: ${topic}\n\n${message}`,
        tags: [{ name: "source", value: "5star-contact" }],
      }),
      signal: AbortSignal.timeout(12_000),
    })
    if (response.status === 409 || response.status === 429) {
      return NextResponse.json({ error: "Please wait a few minutes before sending another message, or email us directly." }, { status: 429, headers: { "Retry-After": "300", "Cache-Control": "no-store" } })
    }
    const result = await response.json().catch(() => null)
    if (!response.ok || typeof result?.id !== "string") {
      console.error("Contact email provider rejected request", { status: response.status })
      return json({ error: "We could not send your message right now. Please try again later or email us directly." }, 502)
    }
    return json({ ok: true })
  } catch {
    console.error("Contact email provider unavailable")
    return json({ error: "Sending could not be confirmed. Please try again in a moment, or email us directly." }, 502)
  }
}
