/**
 * Watermarking Utility
 *
 * Applies a watermark to preview images for non-paid users.
 * Uses Cloudinary's text overlay feature for server-side watermarking.
 */

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "dijfjevte"

/**
 * Apply a watermark to an image URL using Cloudinary transformations
 *
 * @param imageUrl - The original image URL
 * @param text - Watermark text (default: "5-STAR PHOTOS PREVIEW")
 * @returns URL with watermark applied
 */
export function applyWatermark(imageUrl: string, text = "5-STAR PHOTOS PREVIEW"): string {
  // If it's already a Cloudinary URL, add the overlay transformation
  if (imageUrl.includes("cloudinary.com")) {
    // Insert watermark transformation before the last part of the URL
    const parts = imageUrl.split("/upload/")
    if (parts.length === 2) {
      const watermarkTransform = [
        // Semi-transparent dark overlay for text background
        "l_text:Arial_40_bold:" + encodeURIComponent(text),
        "co_white",
        "o_40",
        "g_center",
        "y_0",
      ].join(",")

      // Add diagonal repeating watermark
      const repeatingWatermark = [
        "l_text:Arial_24_bold:" + encodeURIComponent(text),
        "co_white",
        "o_20",
        "g_north_west",
        "x_50",
        "y_50",
        "a_-30",
      ].join(",")

      return `${parts[0]}/upload/${watermarkTransform}/${repeatingWatermark}/${parts[1]}`
    }
  }

  // For non-Cloudinary URLs, use fetch URL with overlay
  const encodedUrl = encodeURIComponent(imageUrl)

  // Cloudinary fetch with text overlay - use comma-separated transformations
  // Single centered watermark for simplicity and reliability
  const watermarkTransform = ["l_text:Arial_60_bold:" + encodeURIComponent(text), "co_white", "o_40", "g_center"].join(
    ",",
  )

  return `https://res.cloudinary.com/${CLOUD_NAME}/image/fetch/${watermarkTransform}/${encodedUrl}`
}

/**
 * Apply a subtle corner watermark (for less intrusive marking)
 */
export function applyCornerWatermark(imageUrl: string, text = "5-STAR PHOTOS"): string {
  const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "demo"
  const encodedUrl = encodeURIComponent(imageUrl)

  // Corner watermark with background
  const watermarkTransform = [
    "l_text:Arial_18_bold:" + encodeURIComponent(text),
    "co_white",
    "o_80",
    "g_south_east",
    "x_20",
    "y_20",
    // Add dark background behind text
    "b_rgb:00000080",
    "r_8",
  ].join(",")

  return `https://res.cloudinary.com/${CLOUD_NAME}/image/fetch/${watermarkTransform}/${encodedUrl}`
}

/**
 * Check if an image URL already has a watermark applied
 */
export function hasWatermark(imageUrl: string): boolean {
  return imageUrl.includes("l_text:") && imageUrl.includes("5-STAR")
}

/**
 * Remove watermark transformations from a Cloudinary URL
 * (Used when generating final paid downloads)
 */
export function removeWatermarkFromUrl(imageUrl: string): string {
  if (!imageUrl.includes("cloudinary.com")) {
    return imageUrl
  }

  // Remove text overlay transformations
  return imageUrl.replace(/l_text:[^/]+\//g, "")
}
