/**
 * Moves a set of image ids from the Library to /batch-transform.
 *
 * The URL is the primary channel so the hand-off survives browsers that block
 * or partition sessionStorage (private windows, strict privacy settings).
 * sessionStorage is written too, as a fallback for very large selections whose
 * ids would not fit comfortably in a URL.
 */
export const BATCH_IDS_STORAGE_KEY = "batch_transform_ids"
export const BATCH_IDS_QUERY_PARAM = "ids"

// Roughly 50 UUIDs. Above this we rely on sessionStorage only.
const MAX_IDS_IN_URL = 50

export function buildBatchTransformHref(ids: string[]): string {
  try {
    sessionStorage.setItem(BATCH_IDS_STORAGE_KEY, JSON.stringify(ids))
  } catch {
    // Storage unavailable; the URL carries the ids instead.
  }
  if (ids.length === 0 || ids.length > MAX_IDS_IN_URL) return "/batch-transform"
  return `/batch-transform?${BATCH_IDS_QUERY_PARAM}=${encodeURIComponent(ids.join(","))}`
}

export function readBatchTransformIds(searchParams: URLSearchParams | null): string[] {
  const fromUrl = searchParams?.get(BATCH_IDS_QUERY_PARAM)
  if (fromUrl) {
    const ids = fromUrl.split(",").map((s) => s.trim()).filter(Boolean)
    if (ids.length > 0) return ids
  }
  try {
    const stored = sessionStorage.getItem(BATCH_IDS_STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === "string" && v.length > 0)
    }
  } catch {
    // Storage unavailable or corrupt; fall through.
  }
  return []
}

export function clearBatchTransformIds() {
  try {
    sessionStorage.removeItem(BATCH_IDS_STORAGE_KEY)
  } catch {
    // Nothing to clear.
  }
}
