/**
 * Client-side image compression for uploads.
 *
 * Uploads travel to the `uploadImage` server action as a base64 data URL,
 * so the payload must stay under the Server Action body limit
 * (`experimental.serverActions.bodySizeLimit` in next.config.mjs, 4 MB)
 * and under Vercel's 4.5 MB function-payload ceiling. Base64 inflates
 * bytes by ~33%, so we aim for ~2.5 MB of JPEG.
 *
 * Browser-only (uses <canvas>).
 */

export const UPLOAD_TARGET_MB = 2.5

/** Read a Blob/File as a data URL without any re-encoding. */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.readAsDataURL(blob)
  })
}

/**
 * Downscale + re-encode an image to JPEG so it fits the upload budget.
 * Returns a data URL. Small files are still re-encoded (cheap) so the
 * caller gets a consistent JPEG regardless of input format (HEIC, PNG…).
 */
export function compressImage(blob: Blob, maxSizeMB: number = UPLOAD_TARGET_MB): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.crossOrigin = "anonymous"
    const objectUrl = URL.createObjectURL(blob)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const fileSizeMB = blob.size / (1024 * 1024)
      let scale = 1

      // Pixel count scales with the square of the side, so sqrt gets us close;
      // knock off an extra 10% because JPEG size is not perfectly linear.
      if (fileSizeMB > maxSizeMB) {
        scale = Math.sqrt(maxSizeMB / fileSizeMB) * 0.9
      }

      // Never send more than 3000px on the long side — the models don't use it.
      const maxDim = 3000
      if (img.width > maxDim || img.height > maxDim) {
        scale = Math.min(scale, maxDim / Math.max(img.width, img.height))
      }

      const canvas = document.createElement("canvas")
      canvas.width = Math.max(1, Math.round(img.width * scale))
      canvas.height = Math.max(1, Math.round(img.height * scale))

      const ctx = canvas.getContext("2d")
      if (!ctx) {
        reject(new Error("Failed to get canvas context"))
        return
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      const quality = fileSizeMB > 8 ? 0.7 : fileSizeMB > 5 ? 0.75 : 0.8
      resolve(canvas.toDataURL("image/jpeg", quality))
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error("Failed to load image for compression"))
    }
    img.src = objectUrl
  })
}

/**
 * The one call sites should use: returns a base64 data URL that is safe to
 * hand to the `uploadImage` server action. Files already under budget are
 * passed through untouched to preserve the original bytes.
 */
export async function prepareImageForUpload(blob: Blob, maxSizeMB: number = UPLOAD_TARGET_MB): Promise<string> {
  const sizeMB = blob.size / (1024 * 1024)
  if (sizeMB <= maxSizeMB) {
    return blobToDataUrl(blob)
  }
  return compressImage(blob, maxSizeMB)
}
