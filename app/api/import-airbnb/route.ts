import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { put } from "@vercel/blob"
import { v4 as uuidv4 } from "uuid"

// Browserless.io API endpoint
const BROWSERLESS_API = "https://chrome.browserless.io"

interface ImportResult {
  success: boolean
  images: Array<{
    id: string
    url: string
    filename: string
  }>
  listingTitle?: string
  error?: string
}

export async function POST(request: Request): Promise<Response> {
  try {
    const { airbnbUrl, projectId } = await request.json()

    if (!airbnbUrl || !airbnbUrl.includes("airbnb.com/rooms/")) {
      return NextResponse.json(
        { success: false, error: "Invalid Airbnb URL. Please provide a valid listing URL." },
        { status: 400 }
      )
    }

    const apiKey = process.env.BROWSERLESS_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "Browserless API key not configured" },
        { status: 500 }
      )
    }

    // Get authenticated user
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      )
    }

    console.log("[v0] Starting Airbnb import for:", airbnbUrl)

    // Step 1: Use Browserless to render the page and get full HTML content
    // Using /content endpoint which is more reliable for scraping
    const contentResponse = await fetch(`${BROWSERLESS_API}/content?token=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: airbnbUrl,
        gotoOptions: {
          waitUntil: "networkidle2",
          timeout: 30000,
        },
        waitForSelector: {
          selector: "img[src*='muscache']",
          timeout: 10000,
        },
      }),
    })

    if (!contentResponse.ok) {
      const errorText = await contentResponse.text()
      console.error("[v0] Browserless content failed:", errorText)
      
      // Try simpler request without waitForSelector
      return await fallbackScrape(airbnbUrl, apiKey, user.id, projectId, supabase)
    }

    const html = await contentResponse.text()
    console.log("[v0] Got HTML content, length:", html.length)

    // Extract image URLs and listing title from HTML
    const imageUrls = extractImagesFromHtml(html)
    const listingTitle = extractTitleFromHtml(html, airbnbUrl)

    if (imageUrls.length === 0) {
      // Try fallback method with simpler request
      return await fallbackScrape(airbnbUrl, apiKey, user.id, projectId, supabase)
    }

    console.log("[v0] Found", imageUrls.length, "images to import")

    // Step 2: Download and upload each image to Blob storage
    const uploadedImages = await uploadImages(imageUrls, user.id, listingTitle, projectId, supabase)

    return NextResponse.json({
      success: true,
      images: uploadedImages,
      listingTitle,
      totalFound: imageUrls.length,
      totalImported: uploadedImages.length,
    })

  } catch (error) {
    console.error("[v0] Airbnb import error:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Import failed" },
      { status: 500 }
    )
  }
}

// Fallback: Use simpler Browserless content API request
async function fallbackScrape(
  airbnbUrl: string, 
  apiKey: string, 
  userId: string, 
  projectId: string | null,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<Response> {
  console.log("[v0] Trying fallback scrape method...")
  
  const contentResponse = await fetch(`${BROWSERLESS_API}/content?token=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: airbnbUrl,
      gotoOptions: {
        waitUntil: "domcontentloaded",
        timeout: 45000,
      },
    }),
  })

  if (!contentResponse.ok) {
    const errorText = await contentResponse.text()
    console.error("[v0] Fallback scrape failed:", errorText)
    return NextResponse.json(
      { success: false, error: "Failed to load Airbnb listing. Please try again." },
      { status: 500 }
    )
  }

  const html = await contentResponse.text()
  
  // Extract image URLs from HTML using regex patterns
  const imageUrls = extractImagesFromHtml(html)
  const listingTitle = extractTitleFromHtml(html, airbnbUrl)

  if (imageUrls.length === 0) {
    return NextResponse.json(
      { success: false, error: "No images found in the listing. The page may have changed or be blocked." },
      { status: 404 }
    )
  }

  console.log("[v0] Fallback found", imageUrls.length, "images")

  const uploadedImages = await uploadImages(imageUrls, userId, listingTitle, projectId, supabase)

  return NextResponse.json({
    success: true,
    images: uploadedImages,
    listingTitle,
    totalFound: imageUrls.length,
    totalImported: uploadedImages.length,
  })
}

// Clean and normalize a URL extracted from HTML
function cleanImageUrl(rawUrl: string): string {
  let url = rawUrl
    .replace(/"/g, "")
    .replace(/&amp;/g, "&")
    .split("&quot;")[0]
    // Remove srcset density descriptors like " 1x" or " 2x"
    .replace(/\s+\d+x$/g, "")
    .replace(/%20\d+x$/g, "")
    // Remove any trailing whitespace or commas (from srcset)
    .replace(/[\s,]+$/g, "")
    .trim()
  
  return url
}

// Extract images from raw HTML
function extractImagesFromHtml(html: string): string[] {
  const urls = new Set<string>()
  
  // Match various Airbnb image URL patterns - be more specific about ending
  const patterns = [
    // Match URLs in src/srcset attributes ending at quote or space+digit (srcset)
    /https:\/\/a0\.muscache\.com\/im\/pictures\/[^"'\s,]+/g,
    // Match quoted URLs
    /"(https:\/\/a0\.muscache\.com\/im\/pictures\/[^"]+)"/g,
    // Match URLs with specific extensions
    /https:\/\/a0\.muscache\.com\/[^"'\s,]+\.(jpg|jpeg|png|webp)/gi,
  ]
  
  for (const pattern of patterns) {
    const matches = html.matchAll(pattern)
    for (const match of matches) {
      const rawUrl = match[1] || match[0]
      const url = cleanImageUrl(rawUrl)
      
      if (isValidAirbnbImage(url)) {
        const upgraded = upgradeImageUrl(url)
        urls.add(upgraded)
        console.log("[v0] Found valid image URL:", upgraded.substring(0, 100))
      }
    }
  }
  
  console.log("[v0] Total unique images found:", urls.size)
  return Array.from(urls).slice(0, 30)
}

// Check if URL is a valid Airbnb listing image (not icons, avatars, JS files, etc.)
function isValidAirbnbImage(url: string): boolean {
  if (!url || url.length < 20) return false
  
  // Must be from Airbnb's image CDN
  if (!url.includes("muscache") && !url.includes("airbnbstatic")) return false
  
  // MUST be specifically a listing photo path
  // Listing photos are in /im/pictures/prohost-api/Hosting-{id}/ or similar
  // They contain UUIDs in the path
  const isListingPhoto = url.includes("/im/pictures/prohost-api/") || 
                         url.includes("/im/pictures/hosting/") ||
                         url.includes("/im/pictures/miso/") ||
                         // Check for UUID pattern in path (listing photos have these)
                         /\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i.test(url)
  
  if (!isListingPhoto) return false
  
  // Reject non-image file types
  if (url.includes(".js") || url.includes(".css") || url.includes(".svg")) return false
  if (url.includes("/static/packages/") || url.includes("/static/bundles/")) return false
  
  // Filter out user avatars, profile pictures, and generic Airbnb images
  if (url.includes("/users/") || url.includes("avatar") || url.includes("profile")) return false
  if (url.includes("icon") || url.includes("logo") || url.includes("badge")) return false
  
  // Filter out tiny images (icons, thumbnails)
  if (url.includes("w=32") || url.includes("w=48") || url.includes("w=64") || url.includes("w=96")) return false
  
  // Reject generic Airbnb marketing/illustration images
  if (url.includes("/airbnb-core-") || url.includes("illustration")) return false
  
  return true
}

// Upgrade image URL to high resolution
function upgradeImageUrl(url: string): string {
  // First, remove any existing im_w parameter
  let upgraded = url.replace(/[?&]im_w=\d+/g, "")
  
  // Clean up any double ? or & that might result
  upgraded = upgraded.replace(/\?&/g, "?").replace(/&&/g, "&")
  
  // Remove trailing ? or & if present
  upgraded = upgraded.replace(/[?&]$/, "")
  
  // Add high resolution parameter
  upgraded += upgraded.includes("?") ? "&im_w=1200" : "?im_w=1200"
  
  return upgraded
}

// Extract title from HTML
function extractTitleFromHtml(html: string, fallbackUrl: string): string {
  // Try to find title in meta tags or h1
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i) ||
                     html.match(/<h1[^>]*>([^<]+)<\/h1>/i) ||
                     html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)
  
  if (titleMatch && titleMatch[1]) {
    return titleMatch[1].replace(/ - Airbnb.*$/i, "").trim()
  }
  
  const match = fallbackUrl.match(/rooms\/(\d+)/)
  return match ? `Airbnb Listing ${match[1]}` : "Airbnb Import"
}

// Download images and upload to Blob storage
async function uploadImages(
  imageUrls: string[],
  userId: string,
  listingTitle: string,
  projectId: string | null,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<Array<{ id: string; url: string; filename: string }>> {
  const uploaded: Array<{ id: string; url: string; filename: string }> = []
  
  // Process images in parallel with concurrency limit
  const CONCURRENT_LIMIT = 5
  
  for (let i = 0; i < imageUrls.length; i += CONCURRENT_LIMIT) {
    const batch = imageUrls.slice(i, i + CONCURRENT_LIMIT)
    
    const results = await Promise.allSettled(
      batch.map(async (imageUrl, batchIndex) => {
        const index = i + batchIndex + 1
        const imageId = uuidv4()
        const filename = `${listingTitle.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30)}_${index}.jpg`
        
        try {
          console.log(`[v0] Downloading image ${index}: ${imageUrl.substring(0, 80)}...`)
          
          // Download image
          const imageResponse = await fetch(imageUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
              "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
              "Referer": "https://www.airbnb.com/",
            },
          })
          
          if (!imageResponse.ok) {
            console.error(`[v0] Failed to download image ${index}: status ${imageResponse.status}`)
            return null
          }
          
          const imageBuffer = await imageResponse.arrayBuffer()
          const contentType = imageResponse.headers.get("content-type") || "image/jpeg"
          
          console.log(`[v0] Downloaded image ${index}: ${imageBuffer.byteLength} bytes, type: ${contentType}`)
          
          // Validate content type is actually an image
          if (!contentType.startsWith("image/")) {
            console.error(`[v0] Image ${index} is not an image (${contentType}), skipping`)
            return null
          }
          
          if (imageBuffer.byteLength < 5000) {
            console.error(`[v0] Image ${index} too small (${imageBuffer.byteLength} bytes), skipping`)
            return null
          }
          
          // Upload to Vercel Blob
          const blob = await put(`airbnb-imports/${userId}/${imageId}.jpg`, imageBuffer, {
            access: "public",
            contentType,
          })
          
          console.log(`[v0] Uploaded image ${index} to blob: ${blob.url.substring(0, 60)}...`)
          
          // Save to database - using only columns that exist in the images table
          const { error: dbError } = await supabase.from("images").insert({
            id: imageId,
            user_id: userId,
            original_filename: filename,
            storage_path: blob.url,
            classification: "unknown",
            project_id: projectId || null,
            is_original: true,
            metadata: {
              source: "airbnb_import",
              file_size: imageBuffer.byteLength,
              mime_type: contentType,
              airbnb_url: imageUrl,
            },
          })
          
          if (dbError) {
            console.error(`[v0] Failed to save image ${index} to database:`, dbError.message, dbError.details)
            return null
          }
          
          console.log(`[v0] Successfully imported image ${index}: ${filename}`)
          return { id: imageId, url: blob.url, filename }
        } catch (error) {
          console.error(`[v0] Error processing image ${index}:`, error instanceof Error ? error.message : error)
          return null
        }
      })
    )
    
    // Collect successful uploads
    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        uploaded.push(result.value)
      } else if (result.status === "rejected") {
        console.error("[v0] Upload batch item rejected:", result.reason)
      }
    }
  }
  
  console.log(`[v0] Upload complete: ${uploaded.length} of ${imageUrls.length} images successful`)
  return uploaded
}
