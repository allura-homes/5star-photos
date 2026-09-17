import "server-only"
import type { PhotoClassification } from "@/lib/types"

/**
 * Looks at the actual pixels of a listing photo and decides indoor vs outdoor,
 * plus a specific room/space label the Art Director can use as a hint.
 *
 * Primary: gemini-2.5-flash (same key the Art Director already uses).
 * Fallback: gpt-4o-mini. Both are asked for strict JSON.
 */

export interface SceneClassification {
  classification: Exclude<PhotoClassification, "unknown">
  roomType: string
  confidence: number
  source: "gemini" | "openai"
}

const ROOM_TYPES = [
  // indoor
  "kitchen",
  "living room",
  "bedroom",
  "bathroom",
  "dining room",
  "home office",
  "laundry room",
  "hallway",
  "entryway",
  "stairwell",
  "basement",
  "garage interior",
  "closet",
  "pantry",
  "sunroom",
  "other interior",
  // outdoor
  "front exterior",
  "rear exterior",
  "backyard",
  "patio",
  "deck",
  "pool area",
  "garden",
  "driveway",
  "balcony",
  "porch",
  "aerial view",
  "street view",
  "other exterior",
] as const

const INSTRUCTIONS = `You classify short-term-rental listing photos.

Decide whether the camera is INDOORS (inside a building, even if windows show outside) or OUTDOORS (open air: yards, exteriors, patios, balconies, pools, streets, aerial shots). Covered porches, balconies and open patios count as outdoor.

Return ONLY JSON: {"classification":"indoor"|"outdoor","roomType":<one of ${JSON.stringify(ROOM_TYPES)}>,"confidence":0..1}`

const GEMINI_TIMEOUT_MS = 8000
const OPENAI_TIMEOUT_MS = 8000

export async function classifyScene(base64: string, mimeType: string): Promise<SceneClassification | null> {
  const data = base64.includes(",") ? base64.split(",")[1] : base64
  const type = normalizeMime(mimeType)

  const fromGemini = await classifyWithGemini(data, type).catch((err) => {
    console.error("[v0] classifyScene gemini failed:", err instanceof Error ? err.message : err)
    return null
  })
  if (fromGemini) return fromGemini

  return classifyWithOpenAI(data, type).catch((err) => {
    console.error("[v0] classifyScene openai failed:", err instanceof Error ? err.message : err)
    return null
  })
}

/** Convenience for backfilling existing rows that only have a public URL. */
export async function classifySceneFromUrl(url: string): Promise<SceneClassification | null> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Fetch image failed: ${res.status}`)
  const type = res.headers.get("content-type") || "image/jpeg"
  const buf = Buffer.from(await res.arrayBuffer())
  return classifyScene(buf.toString("base64"), type)
}

async function classifyWithGemini(data: string, mimeType: string): Promise<SceneClassification | null> {
  const apiKey = process.env.GOOGLE_CLOUD_API_KEY
  if (!apiKey) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS)
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: INSTRUCTIONS }, { inlineData: { mimeType, data } }] }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 100,
            // 2.5 Flash "thinks" by default (~1k+ hidden tokens even for a
            // trivial prompt), which is wasted latency for a one-look
            // indoor/outdoor decision.
            thinkingConfig: { thinkingBudget: 0 },
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                classification: { type: "STRING", enum: ["indoor", "outdoor"] },
                roomType: { type: "STRING", enum: [...ROOM_TYPES] },
                confidence: { type: "NUMBER" },
              },
              required: ["classification", "roomType", "confidence"],
            },
          },
        }),
      },
    )
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`)
    const json = await res.json()
    const text: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text
    return parseResult(text, "gemini")
  } finally {
    clearTimeout(timer)
  }
}

async function classifyWithOpenAI(data: string, mimeType: string): Promise<SceneClassification | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS)
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        max_tokens: 100,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: INSTRUCTIONS },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${data}`, detail: "low" } },
            ],
          },
        ],
      }),
    })
    if (!res.ok) throw new Error(`OpenAI ${res.status}`)
    const json = await res.json()
    return parseResult(json?.choices?.[0]?.message?.content, "openai")
  } finally {
    clearTimeout(timer)
  }
}

function parseResult(text: string | undefined, source: SceneClassification["source"]): SceneClassification | null {
  if (!text) return null
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  const parsed = JSON.parse(match[0]) as Partial<SceneClassification>
  if (parsed.classification !== "indoor" && parsed.classification !== "outdoor") return null
  return {
    classification: parsed.classification,
    roomType: typeof parsed.roomType === "string" ? parsed.roomType : parsed.classification === "indoor" ? "other interior" : "other exterior",
    confidence: typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5,
    source,
  }
}

function normalizeMime(mime: string): string {
  const m = mime.toLowerCase()
  if (m.includes("png")) return "image/png"
  if (m.includes("webp")) return "image/webp"
  if (m.includes("heic") || m.includes("heif")) return "image/heic"
  return "image/jpeg"
}
