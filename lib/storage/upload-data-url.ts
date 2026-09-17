const BUCKET = "original-uploads"

function getSupabaseConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase not configured")
  }
  return { supabaseUrl, supabaseKey }
}

export function isDataUrl(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("data:image/")
}

/** Uploads raw base64 (no data: prefix) to Storage and returns its public URL. */
export async function uploadBase64ToStorage(
  storagePath: string,
  base64Data: string,
  contentType: string,
): Promise<string> {
  const { supabaseUrl, supabaseKey } = getSupabaseConfig()

  const binaryString = atob(base64Data)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  const blob = new Blob([bytes], { type: contentType })

  const response = await fetch(`${supabaseUrl}/storage/v1/object/${BUCKET}/${storagePath}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: blob,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Storage upload failed: ${response.status} ${errorText}`)
  }

  return `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${storagePath}`
}

/**
 * Persists a `data:image/...;base64,...` string as a variation file under the
 * user's folder and returns its public URL. Generated images are routinely
 * 5-10 MB as base64, which is over Vercel's 4.5 MB request-body limit, so the
 * server must store them before the client is ever asked to send them back.
 */
export async function persistDataUrlAsVariation(userId: string, dataUrl: string): Promise<string> {
  const matches = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/)
  if (!matches) {
    throw new Error("Invalid base64 image format")
  }
  const imageFormat = matches[1]
  const base64Data = matches[2]
  const extension = imageFormat === "jpeg" ? "jpg" : imageFormat
  const storagePath = `${userId}/variations/variation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`
  return uploadBase64ToStorage(storagePath, base64Data, `image/${imageFormat}`)
}
