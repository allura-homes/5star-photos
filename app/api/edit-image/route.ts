import type { Request } from "next/server"
import { Buffer } from "buffer"

interface CloudinaryEdits {
  brightness: number
  contrast: number
  saturation: number
  gamma: number
  sharpen: number
  temperature?: number
  shadows?: number
  highlights?: number
}

function buildCloudinaryTransformString(edits: CloudinaryEdits) {
  const parts: string[] = []

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

  const brightness = clamp(Math.round(edits.brightness || 0), -50, 50)
  const contrast = clamp(Math.round(edits.contrast || 0), -50, 50)
  const saturation = clamp(Math.round(edits.saturation || 0), -50, 50)
  const gamma = clamp(Math.round(edits.gamma || 100), 60, 150)
  const sharpen = clamp(Math.round(edits.sharpen || 0), 0, 200)
  const temperature = clamp(Math.round(edits.temperature || 0), -10, 10)
  const shadows = clamp(Math.round(edits.shadows || 0), -100, 100)
  const highlights = clamp(Math.round(edits.highlights || 0), -100, 100)

  if (brightness !== 0) parts.push(`e_brightness:${brightness}`)
  if (contrast !== 0) parts.push(`e_contrast:${contrast}`)

  if (shadows > 40) {
    parts.push(`e_auto_brightness:${Math.round(shadows)}`)
  }

  if (sharpen > 0) parts.push(`e_sharpen:${sharpen}`)
  if (saturation !== 0) parts.push(`e_saturation:${saturation}`)

  if (temperature !== 0) {
    const tempColor = temperature > 0 ? "gold" : "blue"
    const tempStrength = Math.abs(temperature) * 8
    parts.push(`e_colorize:${tempStrength},co_${tempColor}`)
  }

  if (gamma !== 100) parts.push(`e_gamma:${gamma}`)

  parts.push("q_auto", "f_auto")

  return parts.join(",")
}

function buildCloudinaryFetchUrl(originalUrl: string, edits: CloudinaryEdits) {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "5starphotos"
  const transform = buildCloudinaryTransformString(edits)
  const encoded = encodeURIComponent(originalUrl)
  return `https://res.cloudinary.com/${cloudName}/image/fetch/${transform}/${encoded}`
}

// Helper function to compress/resize large images for API limits
async function compressImageFromUrl(
  originalUrl: string,
  maxSizeBytes: number = 3 * 1024 * 1024, // 3MB default
  targetDimension = 2048, // Max dimension
): Promise<Blob> {
  console.log("[v0] Compressing image from URL:", originalUrl.substring(0, 100) + "...")

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "5starphotos"

  // Use Cloudinary fetch with quality reduction and resize
  const transformations = `w_${targetDimension},h_${targetDimension},c_limit,q_75,f_jpg`
  const cloudinaryUrl = `https://res.cloudinary.com/${cloudName}/image/fetch/${transformations}/${encodeURIComponent(originalUrl)}`

  console.log("[v0] Cloudinary compression URL:", cloudinaryUrl.substring(0, 150) + "...")

  const response = await fetch(cloudinaryUrl)
  if (!response.ok) {
    throw new Error(`Cloudinary compression failed: ${response.status}`)
  }

  const compressedBlob = await response.blob()
  console.log("[v0] Compressed image to", (compressedBlob.size / 1024 / 1024).toFixed(2), "MB")

  // If still too large, try more aggressive compression
  if (compressedBlob.size > maxSizeBytes) {
    console.log("[v0] Still too large, trying more aggressive compression...")
    const aggressiveTransform = `w_1536,h_1536,c_limit,q_60,f_jpg`
    const aggressiveUrl = `https://res.cloudinary.com/${cloudName}/image/fetch/${aggressiveTransform}/${encodeURIComponent(originalUrl)}`

    const aggressiveResponse = await fetch(aggressiveUrl)
    if (aggressiveResponse.ok) {
      const aggressiveBlob = await aggressiveResponse.blob()
      console.log("[v0] Aggressively compressed to", (aggressiveBlob.size / 1024 / 1024).toFixed(2), "MB")
      return aggressiveBlob
    }
  }

  return compressedBlob
}

async function generateOpenAIImage(originalUrl: string, imagePrompt: string, model = "gpt-image-1", retryCount = 0): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error("OpenAI API key not configured")
  
  const MAX_RETRIES = 5
  const BASE_DELAY = 3000 // 3 seconds

  // gpt-image-1.5 uses the generations endpoint, not edits
  const useGenerationsEndpoint = model === "gpt-image-1.5"
  
  const isMiniModel = model === "gpt-image-1-mini"
  
  // Check if the prompt contains user instructions to ADD elements (virtual staging)
  const isVirtualStaging = imagePrompt && (
    imagePrompt.toLowerCase().includes("insert") ||
    imagePrompt.toLowerCase().includes("add ") ||
    imagePrompt.toLowerCase().includes("place ") ||
    imagePrompt.toLowerCase().includes("put ") ||
    imagePrompt.toLowerCase().includes("include ") ||
    imagePrompt.toLowerCase().includes("stage ") ||
    imagePrompt.toLowerCase().includes("furnish") ||
    imagePrompt.toLowerCase().includes("USER SPECIAL INSTRUCTIONS")
  )

  const baseInstructions = isMiniModel
    ? `CRITICAL: THIS IS AN IMAGE EDITING TASK - NOT IMAGE GENERATION.

YOU MUST OUTPUT THE EXACT SAME PHOTOGRAPH WITH ONLY LIGHTING/COLOR ADJUSTMENTS.

STRICT RULES:
- The OUTPUT must show the IDENTICAL scene as the INPUT
- Indoor photo = Indoor photo of SAME room
- Bedroom = SAME bedroom, SAME furniture, SAME walls
- Kitchen = SAME kitchen
- Outdoor = SAME outdoor location
- DO NOT generate a different image
- DO NOT substitute scenes
- DO NOT change room types
- DO NOT add or remove objects

ONLY ALLOWED: Brightness, contrast, color balance, sharpness improvements.

VERIFY: Your output must be recognizable as the SAME photograph.`
    : isVirtualStaging 
    ? `CRITICAL INSTRUCTION: You are performing VIRTUAL STAGING on this real estate photo.

ABSOLUTE REQUIREMENTS:
1. PRESERVE the existing property EXACTLY - same building, same angle, same perspective
2. PRESERVE all permanent architectural elements - walls, fences, windows, doors, etc.
3. ADD ONLY the specifically requested furniture/staging elements
4. The staging must look PHOTOREALISTIC, like items were actually there
5. Match lighting and shadows to the existing scene

STRICTLY FORBIDDEN - DO NOT DO THESE:
- Adding doors, windows, or openings that don't exist
- Removing or moving walls, doors, windows, or any architectural elements
- Changing the room layout or floor plan
- Adding appliances or fixtures not requested
- Changing paint colors or finishes unless requested
- Moving existing furniture unless requested

MUST PRESERVE EXACTLY:
- All walls and their positions
- All existing doors and windows (same number, same positions)
- The building/property structure
- Fences, gates, pergolas
- Landscaping and hardscape
- Sky and background
- Camera angle and perspective
- Existing appliances and fixtures

YOU MAY ADD (ONLY if explicitly requested):
- Furniture (chairs, tables, loungers, etc.)
- Wall art and decorative elements
- Outdoor accessories (umbrellas, cushions, planters)
- Staging props

QUALITY REQUIREMENTS:
- Items must look photorealistic, not pasted in
- Shadows and lighting must match the scene
- Scale must be accurate
- Style and colors must match any reference image description provided`
    : `CRITICAL INSTRUCTION: You are performing an IMAGE EDIT operation, NOT generating a new image.

ABSOLUTE REQUIREMENTS:
1. The output MUST be the EXACT SAME PHOTOGRAPH as the input, with ONLY quality enhancements
2. Same room/scene, same furniture, same angle, same everything
3. If the input shows a bedroom, the output MUST show that EXACT bedroom
4. If the input shows a kitchen, the output MUST show that EXACT kitchen
5. NEVER substitute a different photo or scene

STRICTLY FORBIDDEN - WILL RESULT IN FAILURE:
- Generating a different property or scene than the input
- Replacing an indoor photo with an outdoor photo (or vice versa)
- Adding or removing furniture, fixtures, or architectural elements
- Changing the room type (e.g., bedroom to living room)
- Adding grass to concrete, pavers, brick, or any hard surface
- Adding pools, hot tubs, or any objects not in the original
- Removing walls, fences, pergolas, or structural elements
- Changing the camera angle or perspective

ALLOWED ENHANCEMENTS ONLY:
- Improve lighting and exposure
- Enhance color vibrancy and white balance
- Increase sharpness and clarity
- Make existing grass/plants more lush (if already present)
- Improve sky appearance (if sky is visible)
- Reduce noise and grain
- Boost architectural details

REMEMBER: You are EDITING, not GENERATING. The output must be recognizably THE SAME PHOTO.`

  // Combine base instructions with Art Director prompt if provided
  const editingPrompt =
    imagePrompt && !isMiniModel
      ? `${baseInstructions}\n\n${isVirtualStaging ? "STAGING INSTRUCTIONS" : "ADDITIONAL ENHANCEMENT REQUESTS"} (apply while keeping the same scene):\n${imagePrompt}`
      : baseInstructions

  try {
    console.log(`[v0] Fetching original image for OpenAI ${model} reference...`)
    console.log("[v0] Using prompt:", editingPrompt.substring(0, 300) + "...")

    const imageResponse = await fetch(originalUrl)
    if (!imageResponse.ok) {
      if (imageResponse.status === 404) {
        throw new Error(`Original image not found - it may have been deleted from storage`)
      }
      throw new Error(`Failed to fetch original image: ${imageResponse.status}`)
    }

    let imageBuffer = Buffer.from(await imageResponse.arrayBuffer())
    console.log("[v0] Original image fetched, size:", imageBuffer.byteLength)

    // Compress if too large (OpenAI images/edits has 4MB limit per image)
    const MAX_SIZE = 4 * 1024 * 1024
    if (imageBuffer.byteLength > MAX_SIZE) {
      console.log("[v0] Image too large, compressing...")
      const compressed = await compressImageFromUrl(originalUrl, MAX_SIZE)
      imageBuffer = Buffer.from(await compressed.arrayBuffer())
      console.log("[v0] Compressed image size:", imageBuffer.byteLength)
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 180000)

    let response: Response
    
    if (useGenerationsEndpoint) {
      // gpt-image-1.5 uses the generations endpoint with image input
      console.log(`[v0] Using OpenAI ${model} with Images Generations API (with image input)`)
      
      // Convert image to base64 for the generations endpoint
      const imageBase64 = imageBuffer.toString("base64")
      
      // Determine mime type from URL or default to jpeg
      const mimeType = originalUrl.toLowerCase().includes(".png") ? "image/png" : "image/jpeg"
      const dataUrl = `data:${mimeType};base64,${imageBase64}`
      
      console.log(`[v0] Sending request to OpenAI images/generations API for ${model}...`)
      
      try {
        response = await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: model,
            prompt: editingPrompt,
            n: 1,
            size: "1536x1024",
            image: [{ type: "base64", media_type: mimeType, data: imageBase64 }],
          }),
          signal: controller.signal,
        })
      } catch (fetchError) {
        clearTimeout(timeoutId)
        console.error(`[v0] OpenAI ${model} fetch error:`, fetchError)
        
        if (retryCount < MAX_RETRIES) {
          const baseDelay = BASE_DELAY * Math.pow(2, retryCount)
          const jitter = Math.random() * 1000
          const delay = baseDelay + jitter
          console.log(`[v0] Network error, retrying in ${Math.round(delay)}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`)
          await new Promise(resolve => setTimeout(resolve, delay))
          return generateOpenAIImage(originalUrl, imagePrompt, model, retryCount + 1)
        }
        
        throw new Error(`OpenAI API network error after ${MAX_RETRIES} retries: ${fetchError instanceof Error ? fetchError.message : "Unknown error"}`)
      }
    } else {
      // gpt-image-1 uses the edits endpoint with form data
      console.log(`[v0] Using OpenAI ${model} with Images Edits API`)
      
      // Create form data for the images/edits endpoint
      // Note: OpenAI edits endpoint requires PNG format
      const formData = new FormData()
      formData.append("image", new Blob([imageBuffer], { type: "image/png" }), "image.png")
      formData.append("prompt", editingPrompt)
      formData.append("model", model)
      formData.append("n", "1")
      formData.append("size", "1536x1024")

      console.log(`[v0] Sending request to OpenAI images/edits API for ${model}...`)
      
      try {
        response = await fetch("https://api.openai.com/v1/images/edits", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          body: formData,
          signal: controller.signal,
        })
      } catch (fetchError) {
        clearTimeout(timeoutId)
        console.error(`[v0] OpenAI ${model} fetch error:`, fetchError)
        
        if (retryCount < MAX_RETRIES) {
          const baseDelay = BASE_DELAY * Math.pow(2, retryCount)
          const jitter = Math.random() * 1000
          const delay = baseDelay + jitter
          console.log(`[v0] Network error, retrying in ${Math.round(delay)}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`)
          await new Promise(resolve => setTimeout(resolve, delay))
          return generateOpenAIImage(originalUrl, imagePrompt, model, retryCount + 1)
        }
        
        throw new Error(`OpenAI API network error after ${MAX_RETRIES} retries: ${fetchError instanceof Error ? fetchError.message : "Unknown error"}`)
      }
    }

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      
      // Handle billing/quota errors with user-friendly message FIRST (before logging raw error)
      if (errorText.includes("billing_hard_limit_reached") || errorText.includes("Billing hard limit")) {
        console.log(`[v0] OpenAI ${model}: Billing limit reached, skipping this model`)
        throw new Error("GPT Image is temporarily unavailable (OpenAI billing limit reached). Please try again later or use other models.")
      }
      
      if (errorText.includes("insufficient_quota") || errorText.includes("exceeded your current quota")) {
        console.log(`[v0] OpenAI ${model}: Quota exceeded, skipping this model`)
        throw new Error("GPT Image is temporarily unavailable (OpenAI quota exceeded). Please try again later or use other models.")
      }
      
      console.error(`[v0] OpenAI ${model} response error (${response.status}):`, errorText.substring(0, 200))
      
      // Handle rate limiting with retry
      if (response.status === 429 && retryCount < MAX_RETRIES) {
        const baseDelay = BASE_DELAY * Math.pow(2, retryCount)
        const jitter = Math.random() * 1000
        const delay = baseDelay + jitter
        console.log(`[v0] Rate limited, retrying in ${Math.round(delay)}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`)
        await new Promise(resolve => setTimeout(resolve, delay))
        return generateOpenAIImage(originalUrl, imagePrompt, model, retryCount + 1)
      }
      
      throw new Error(`OpenAI API failed: ${response.status} - ${errorText.substring(0, 200)}`)
    }

    let data
    try {
      const responseText = await response.text()
      data = JSON.parse(responseText)
    } catch (parseError) {
      console.error(`[v0] OpenAI ${model} JSON parse error:`, parseError)
      throw new Error(`OpenAI response was not valid JSON`)
    }
    console.log(`[v0] OpenAI ${model} response received`)

    // Extract the generated image URL or base64 from the response
    if (data.data && data.data.length > 0) {
      const imageData = data.data[0]
      if (imageData.b64_json) {
        console.log(`[v0] OpenAI ${model} generated image successfully (base64)`)
        return `data:image/png;base64,${imageData.b64_json}`
      } else if (imageData.url) {
        console.log(`[v0] OpenAI ${model} generated image successfully (URL)`)
        // Fetch the URL and convert to base64 for consistent handling
        const imgResponse = await fetch(imageData.url)
        const imgBuffer = await imgResponse.arrayBuffer()
        const imgBase64 = Buffer.from(imgBuffer).toString("base64")
        return `data:image/png;base64,${imgBase64}`
      }
    }

    throw new Error("No image data in OpenAI response")
  } catch (error: any) {
    if (error.name === "AbortError") {
      throw new Error(`OpenAI ${model} request timeout after 180s`)
    }
    console.error(`[v0] OpenAI ${model} error:`, error)
    throw error
  }
}

async function generateGeminiFlashImage(originalUrl: string, editingPrompt: string): Promise<string> {
  try {
    console.log("[v0] Starting Gemini Flash generation...")
    console.log("[v0] Fetching original image for Gemini Flash reference...")

    const imageResponse = await fetch(originalUrl)
    if (!imageResponse.ok) throw new Error("Failed to fetch original image")

    const arrayBuffer = await imageResponse.arrayBuffer()
    let imageBase64 = Buffer.from(arrayBuffer).toString("base64")

    const contentType = imageResponse.headers.get("content-type")
    let mimeType = "image/jpeg"
    if (contentType?.includes("png")) mimeType = "image/png"
    else if (contentType?.includes("webp")) mimeType = "image/webp"
    else mimeType = "image/jpeg"

    console.log("[v0] Original image encoded, size:", arrayBuffer.byteLength)

    const MAX_GEMINI_SIZE = 4 * 1024 * 1024
    if (arrayBuffer.byteLength > MAX_GEMINI_SIZE) {
      console.log("[v0] Image too large for efficient Gemini request, compressing...")
      const compressed = await compressImageFromUrl(originalUrl, MAX_GEMINI_SIZE)
      const compressedArrayBuffer = await compressed.arrayBuffer()
      imageBase64 = Buffer.from(compressedArrayBuffer).toString("base64")
      mimeType = "image/jpeg"
    }

    const apiKey = process.env.GOOGLE_CLOUD_API_KEY
    if (!apiKey) {
      throw new Error("AI image generation unavailable: Missing GOOGLE_CLOUD_API_KEY")
    }

    const strictPrompt = `PROFESSIONAL REAL ESTATE PHOTO ENHANCEMENT:

CRITICAL RULES:
1. PRESERVE EXACT COMPOSITION - same angle, same scene, same objects
2. ABSOLUTELY FORBIDDEN: Adding pools, hot tubs, furniture, patio equipment, lounge chairs, or ANY objects not in original
3. ABSOLUTELY FORBIDDEN: Changing camera angle or perspective
4. ABSOLUTELY FORBIDDEN: Adding interior lights glowing through windows on DAYTIME exterior shots - windows must stay DARK or show natural reflections. Glowing windows in daylight looks FAKE.
5. OK TO REMOVE: Temporary items like cars, trash cans if it improves the shot

REQUIRED ENHANCEMENTS:
✓ Sky: Deeper blue, more vibrant (natural looking - NOT sunset/golden hour)
✓ Grass/Lawn: Rich green, lush appearance, healthy looking
✓ Landscaping: Enhanced foliage colors, vibrant plants
✓ House: Boost paint colors, enhance architectural details
✓ Lighting: Brighter OUTDOOR lighting only - do NOT illuminate interior through windows
✓ Color Balance: NEUTRAL daylight (4000-4500K) - NO warm/golden/orange tints
✓ Sharpness: Crisp details throughout
✓ Reflections: REMOVE any photographer/person reflections
✓ Garage doors: PRESERVE exact style, material, and panels - do NOT change door designs
✓ Windows: Keep DARK or naturally reflective - NO interior glow on daytime shots

CRITICAL: This is a DAYTIME photo. Windows should NOT have interior lights visible. Keep colors NEUTRAL - no golden hour warmth.

Deliver a magazine-quality real estate photo while keeping everything authentic.`

    const parts: Array<{ text: string } | { inline_data: { mime_type: string; data: string } }> = []

    if (imageBase64) {
      parts.push({
        inline_data: {
          mime_type: mimeType,
          data: imageBase64,
        },
      })
      console.log("[v0] Image added to request FIRST (for editing mode)")
    } else {
      console.warn("[v0] WARNING: No image provided - Gemini will generate instead of edit!")
    }

    parts.push({ text: strictPrompt })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 120000)

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { responseModalities: ["image", "text"] },
        }),
        signal: controller.signal,
      },
    )

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] Gemini Flash error:", errorText)
      throw new Error(`Gemini API failed: ${response.status}`)
    }

    const result = await response.json()
    const candidates = result.candidates || []
    let imageData: string | null = null

    for (const candidate of candidates) {
      const content = candidate.content
      if (content?.parts) {
        for (const part of content.parts) {
          if (part.inlineData?.data) {
            imageData = part.inlineData.data
            break
          }
        }
      }
      if (imageData) break
    }

    if (!imageData) {
      console.error("[v0] Gemini response structure:", JSON.stringify(result, null, 2).substring(0, 500))
      throw new Error("No image data returned from Gemini")
    }

    console.log("[v0] Successfully generated image with Gemini 2.0 Flash")
    return `data:image/png;base64,${imageData}`
  } catch (error) {
    console.error("[v0] Gemini Flash image generation error:", error)
    throw error
  }
}

async function generateNanoBananaImage(originalUrl: string, prompt: string): Promise<string> {
  try {
    console.log("[v0] Starting Nano Banana Pro generation...")
    console.log("[v0] Fetching original image for Nano Banana Pro reference...")

    const imageResponse = await fetch(originalUrl)
    if (!imageResponse.ok) throw new Error("Failed to fetch original image")

    const arrayBuffer = await imageResponse.arrayBuffer()
    let imageBase64 = Buffer.from(arrayBuffer).toString("base64")

    const contentType = imageResponse.headers.get("content-type")
    let mimeType = "image/jpeg"
    if (contentType?.includes("png")) mimeType = "image/png"
    else if (contentType?.includes("webp")) mimeType = "image/webp"
    else mimeType = "image/jpeg"

    console.log("[v0] Original image encoded, size:", arrayBuffer.byteLength)

    const MAX_NANO_BANANA_SIZE = 2 * 1024 * 1024 // 2MB limit for reliable processing
    if (arrayBuffer.byteLength > MAX_NANO_BANANA_SIZE) {
      console.log("[v0] Image too large for Nano Banana request, compressing from", arrayBuffer.byteLength, "bytes...")
      const compressed = await compressImageFromUrl(originalUrl, MAX_NANO_BANANA_SIZE)
      const compressedArrayBuffer = await compressed.arrayBuffer()
      imageBase64 = Buffer.from(compressedArrayBuffer).toString("base64")
      mimeType = "image/jpeg"
      console.log("[v0] Compressed to:", compressedArrayBuffer.byteLength, "bytes")
    }

    const apiKey = process.env.GOOGLE_CLOUD_API_KEY
    if (!apiKey) {
      throw new Error("AI image generation unavailable: Missing GOOGLE_CLOUD_API_KEY")
    }

    // Use the Art Director's prompt directly - it already has the right guidance
    // Only add a light wrapper for context, letting the Art Director control the transformation
    
    // IMPORTANT: Gemini cannot do outpainting (expanding the view/zooming out)
    // Remove any zoom-out instructions and add explicit framing preservation
    let processedPrompt = prompt || ""
    if (processedPrompt) {
      // Remove zoom/expand instructions that Gemini can't follow
      processedPrompt = processedPrompt
        .replace(/expand the view[^.]*\./gi, "")
        .replace(/zoom out[^.]*\./gi, "")
        .replace(/show more of the surrounding[^.]*\./gi, "")
        .replace(/wider view[^.]*\./gi, "")
        .replace(/approximately \d+%[^.]*surrounding[^.]*\./gi, "")
        .trim()
    }
    
    const editingPrompt = processedPrompt
      ? `TRANSFORM this real estate photo into a STUNNING architectural photograph worthy of Architectural Digest or Dwell magazine.

Channel the aesthetic mastery of legendary architectural photographers like Julius Shulman, Ezra Stoller, and Fernando Guerra:
- DRAMATIC yet natural lighting that makes spaces feel luminous and inviting
- RICH, vibrant colors with perfect white balance - no dull or washed-out tones
- CRYSTAL-CLEAR details with professional sharpness
- Windows should glow with beautiful natural light or show inviting outdoor views
- Every surface should have depth, texture, and visual appeal

${processedPrompt}

This should look like a SIGNIFICANT improvement over the original - the kind of transformation that makes viewers say "wow."

MANDATORY FRAMING RULES (DO NOT VIOLATE):
- Keep the EXACT same aspect ratio as the original image
- Do NOT zoom in - keep all edges aligned with the original
- Do NOT crop or cut off any part of the scene
- The output must show the SAME field of view as the input`
      : `TRANSFORM this real estate photo into a STUNNING architectural photograph worthy of Architectural Digest or Dwell magazine.

Channel the aesthetic mastery of legendary architectural photographers like Julius Shulman, Ezra Stoller, and Fernando Guerra:
- DRAMATIC yet natural lighting that makes spaces feel luminous and inviting
- RICH, vibrant colors with perfect white balance - no dull or washed-out tones
- CRYSTAL-CLEAR details with professional sharpness
- Windows should glow with beautiful natural light or show inviting outdoor views
- Sky (if visible): Vibrant blue with beautiful clouds
- Landscaping (if visible): Lush, verdant, magazine-perfect

This should look like a SIGNIFICANT improvement over the original - the kind of transformation that makes viewers say "wow."

MANDATORY FRAMING RULES (DO NOT VIOLATE):
- Keep the EXACT same aspect ratio as the original image
- Do NOT zoom in - keep all edges aligned with the original
- Do NOT crop or cut off any part of the scene
- The output must show the SAME field of view as the input`

    console.log("[v0] Using combined prompt (base + art director):", editingPrompt.substring(0, 300) + "...")

    const parts: Array<{ text: string } | { inline_data: { mime_type: string; data: string } }> = []

    if (imageBase64) {
      parts.push({
        inline_data: {
          mime_type: mimeType,
          data: imageBase64,
        },
      })
      console.log("[v0] Image added to request FIRST (for editing mode)")
    } else {
      console.warn("[v0] WARNING: No image provided - Nano Banana Pro will generate instead of edit!")
    }

    parts.push({ text: editingPrompt })

    // Retry logic for transient API errors (500, 503, etc.)
    const MAX_RETRIES = 3
    let lastError: Error | null = null
    let response: Response | null = null
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 120000)
      
      try {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts }],
              generationConfig: {
                responseModalities: ["image", "text"],
                imageConfig: {
                  aspectRatio: "4:3",
                },
              },
            }),
            signal: controller.signal,
          },
        )
        
        clearTimeout(timeoutId)
        
        if (response.ok) {
          break // Success, exit retry loop
        }
        
        const errorText = await response.text()
        console.error(`[v0] Nano Banana Pro error (attempt ${attempt}/${MAX_RETRIES}):`, response.status, errorText.substring(0, 200))
        
        // Only retry on 5xx server errors
        if (response.status >= 500 && attempt < MAX_RETRIES) {
          const backoffMs = Math.pow(2, attempt) * 1000 // 2s, 4s, 8s
          console.log(`[v0] Retrying in ${backoffMs}ms...`)
          await new Promise(resolve => setTimeout(resolve, backoffMs))
          lastError = new Error(`Nano Banana Pro API failed: ${response.status}`)
          continue
        }
        
        throw new Error(`Nano Banana Pro API failed: ${response.status} - ${errorText.substring(0, 100)}`)
      } catch (fetchError) {
        clearTimeout(timeoutId)
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          throw new Error('Nano Banana Pro request timed out after 120s')
        }
        lastError = fetchError instanceof Error ? fetchError : new Error(String(fetchError))
        if (attempt < MAX_RETRIES) {
          const backoffMs = Math.pow(2, attempt) * 1000
          console.log(`[v0] Network error, retrying in ${backoffMs}ms...`)
          await new Promise(resolve => setTimeout(resolve, backoffMs))
          continue
        }
        throw lastError
      }
    }
    
    if (!response || !response.ok) {
      throw lastError || new Error("Failed to generate image after retries")
    }

    const data = await response.json()
    console.log("[v0] Nano Banana Pro response received")

    const candidates = data.candidates || []
    let imageData: string | null = null

    for (const candidate of candidates) {
      const content = candidate.content
      if (content?.parts) {
        for (const part of content.parts) {
          if (part.inlineData?.data) {
            imageData = part.inlineData.data
            break
          }
        }
      }
      if (imageData) break
    }

    if (!imageData) {
      console.error("[v0] Gemini response structure:", JSON.stringify(data, null, 2).substring(0, 500))
      throw new Error("No image data returned from Gemini")
    }

    console.log("[v0] Successfully generated image with Nano Banana Pro")
    return `data:image/png;base64,${imageData}`
  } catch (error) {
    console.error("[v0] Nano Banana Pro image generation error:", error)
    throw error
  }
}

async function generateGeminiImage(
  prompt: string,
  imageUrl: string,
  filename: string,
  model = "gemini-2.5-flash-preview-05-20",
): Promise<{ url: string; base64?: string }> {
  const apiKey = process.env.GOOGLE_CLOUD_API_KEY
  if (!apiKey) {
    throw new Error("GOOGLE_CLOUD_API_KEY not configured")
  }

  console.log(`[v0] Using Gemini model: ${model}`)

  // Fetch the original image
  const imageResponse = await fetch(imageUrl)
  if (!imageResponse.ok) {
    throw new Error(`Failed to fetch original image: ${imageResponse.status}`)
  }

  const imageBlob = await imageResponse.blob()
  let imageBase64: string

  // Check if image is too large for Gemini (20MB limit, but we'll compress anyway for speed)
  const MAX_GEMINI_SIZE = 4 * 1024 * 1024 // 4MB for reasonable request size
  if (imageBlob.size > MAX_GEMINI_SIZE) {
    console.log("[v0] Image too large for efficient Gemini request, compressing...")
    try {
      const compressedBlob = await compressImageFromUrl(imageUrl, MAX_GEMINI_SIZE)
      const compressedArrayBuffer = await compressedBlob.arrayBuffer()
      imageBase64 = Buffer.from(compressedArrayBuffer).toString("base64")
    } catch (compressError) {
      console.error("[v0] Compression error:", compressError instanceof Error ? compressError.message : compressError)
      // Fallback to original
      const arrayBuffer = await imageBlob.arrayBuffer()
      imageBase64 = Buffer.from(arrayBuffer).toString("base64")
    }
  } else {
    const arrayBuffer = await imageBlob.arrayBuffer()
    imageBase64 = Buffer.from(arrayBuffer).toString("base64")
  }

  const mimeType = imageBlob.type || "image/jpeg"

  // This tells Gemini we want to EDIT this specific image, not generate a new one
  const parts: Array<{ text: string } | { inline_data: { mime_type: string; data: string } }> = []

  // Image first - crucial for editing mode
  if (imageBase64) {
    parts.push({
      inline_data: {
        mime_type: mimeType,
        data: imageBase64,
      },
    })
    console.log("[v0] Image added to request FIRST (for editing mode)")
  } else {
    console.warn("[v0] WARNING: No image provided - Gemini will generate instead of edit!")
  }

  // Then the instruction
  parts.push({ text: prompt })

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseModalities: ["image", "text"] },
      }),
    },
  )

  if (!response.ok) {
    const errorText = await response.text()
    console.error("[v0] Gemini error:", errorText)
    throw new Error(`Gemini API failed: ${response.status}`)
  }

  const result = await response.json()
  const candidates = result.candidates || []
  let imageData: string | null = null

  for (const candidate of candidates) {
    const content = candidate.content
    if (content?.parts) {
      for (const part of content.parts) {
        if (part.inlineData?.data) {
          imageData = part.inlineData.data
          break
        }
      }
    }
    if (imageData) break
  }

  if (!imageData) {
    console.error("[v0] Gemini response structure:", JSON.stringify(result, null, 2).substring(0, 500))
    throw new Error("No image data returned from Gemini")
  }

  console.log("[v0] Successfully generated image with Gemini")
  return { url: `data:image/png;base64,${imageData}` }
}

/**
 * Generate image using fal.ai FLUX.2 Pro Edit
 * This model is optimized for high-quality image editing with better detail preservation
 */
async function generateFlux2ProEdit(imageUrl: string, prompt: string): Promise<string> {
  const falKey = process.env.FAL_KEY
  if (!falKey) {
    throw new Error("FAL_KEY not configured")
  }

  console.log("[v0] Starting FLUX.2 Pro Edit generation via fal.ai")

  // Craft a prompt that emphasizes professional real estate enhancement
  // FLUX tends to produce darker images, so we emphasize bright lighting strongly
  const editingPrompt = `PROFESSIONAL REAL ESTATE PHOTO ENHANCEMENT:

${prompt}

CRITICAL LIGHTING REQUIREMENTS (THIS MODEL TENDS DARK - COMPENSATE):
- BRIGHTNESS: Increase overall exposure by 15-25%. The image should feel BRIGHTLY LIT like a professional real estate photo
- FILL LIGHT: Simulate fill lighting in shadows - no area should be dark or underexposed
- EVEN ILLUMINATION: Light should feel uniform across the entire space - no harsh shadows or dark corners
- WINDOWS: Windows should glow with natural daylight, not appear dark or purple-tinted
- INTERIOR LIGHTS: All visible light fixtures should appear ON and glowing warmly
- UNDER-CABINET: Kitchen under-cabinet areas should have warm ambient glow
- COLOR TEMP: Use neutral-warm white (3500-4000K) - NOT cool/blue, NOT orange

Transform this into a stunning, magazine-quality architectural photograph:
- Make the space feel BRIGHT, AIRY, and WELL-LIT throughout
- Enhance colors to be natural and inviting - accurate color representation
- Sharpen details throughout - crystal-clear professional quality
- Smooth out any wrinkles in bedding, linens, curtains, and rugs
- Make the space feel clean, bright, and aspirational
- Preserve the exact composition, framing, and original color palette
- REMOVE any photographer/person reflections from mirrors, windows, appliance glass (washer/dryer doors), chrome, and all reflective surfaces
- PRESERVE exact garage door styles and materials - do NOT change frosted glass to wood or vice versa
- For DAYTIME exterior shots: do NOT add interior lights glowing through windows - this looks fake

The final image should look like it was shot with professional studio lighting - BRIGHT, EVEN, and INVITING. Not dark, moody, or underexposed.`

  try {
    const response = await fetch("https://fal.run/fal-ai/flux-2-pro/edit", {
      method: "POST",
      headers: {
        "Authorization": `Key ${falKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: editingPrompt,
        image_urls: [imageUrl],
        image_size: {
          width: 1536,
          height: 1024,
        },
        output_format: "png", // Use PNG for higher quality like V1
        safety_tolerance: "5", // Highest allowed tolerance (1-5) for real estate photos
        enable_safety_checker: false,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] FLUX.2 Pro Edit error:", errorText)
      
      // Check for billing/balance issues
      if (errorText.includes("Exhausted balance") || errorText.includes("User is locked")) {
        throw new Error("FLUX.2 Pro is temporarily unavailable (billing issue). Please try again later or use other models.")
      }
      
      throw new Error(`FLUX.2 Pro Edit API failed: ${response.status} - ${errorText}`)
    }

    const result = await response.json()
    console.log("[v0] FLUX.2 Pro Edit response received")

    if (result.images && result.images.length > 0) {
      const imageResult = result.images[0]
      // fal returns either url or base64
      if (imageResult.url) {
        console.log("[v0] FLUX.2 Pro Edit returned URL")
        return imageResult.url
      } else if (imageResult.content) {
        console.log("[v0] FLUX.2 Pro Edit returned base64")
        return `data:image/png;base64,${imageResult.content}`
      }
    }

    throw new Error("No image returned from FLUX.2 Pro Edit")
  } catch (error) {
    console.error("[v0] FLUX.2 Pro Edit error:", error)
    throw error
  }
}

/**
 * Image Enhancement API
 *
 * VERSION: v290 (4 Model Variations)
 *
 * Endpoints:
 * - POST /api/edit-image - Generate enhanced image variation
 *
 * Supported Providers:
 * - nano_banana / nano_banana_pro: Nano Banana Pro (Gemini 3 Pro) - V1
 * - openai: OpenAI GPT Image 1 via Images Edits API - V2
 * - openai_mini: OpenAI GPT Image 1 Mini via Images Edits API - V3
 * - openai_1_5: OpenAI GPT Image 1.5 via Images Edits API - V4
 *
 * See MODEL_CONFIGURATION.md for model details.
 */

export async function POST(req: Request) {
  try {
    const {
      original_url,
      filename,
      edits,
      use_ai_models = true,
      provider,
      image_prompt, // Accept image_prompt from job-actions
      custom_prompt, // Keep for backwards compatibility
      variation_number = 1,
      room_type_guess,
      apply_watermark = true,
      style_mode, // Accept style_mode to determine if AI should be used
    } = await req.json()

    console.log(`[v0] Edit-image API called - Provider: ${provider}, Variation: ${variation_number}`)

    console.log("[v0] Edit-image request:", {
      filename,
      variation_number,
      provider,
      style_mode,
      hasOriginalUrl: !!original_url,
      originalUrlLength: original_url?.length || 0,
      hasImagePrompt: !!image_prompt,
      imagePromptLength: image_prompt?.length || 0,
    })

    const promptToUse = image_prompt || custom_prompt

    const AI_PROVIDERS = [
      "openai",
      "openai_mini",
      "openai_1_5",
      "nano_banana",
      "nano_banana_pro",
      "gemini",
      "gemini_3_pro",
      "flux_2_pro",
    ]
    const isAIProvider = AI_PROVIDERS.includes(provider)

    console.log("[v0] Provider check:", {
      provider,
      isAIProvider,
      use_ai_models,
      willUseAI: use_ai_models && isAIProvider,
    })

    if (use_ai_models && isAIProvider) {
      if (!promptToUse) {
        console.error("[v0] No image prompt provided for AI generation")
        throw new Error("No imagePrompt provided by Art Director")
      }

      console.log("[v0] Using AI provider:", provider, "with prompt length:", promptToUse?.length)

      if (provider === "openai") {
        console.log(`[v0] Calling OpenAI GPT Image 1 (v${variation_number})`)
        try {
          const openaiImageUrl = await generateOpenAIImage(original_url, promptToUse, "gpt-image-1")
          console.log(
            "[v0] OpenAI returned URL type:",
            openaiImageUrl?.startsWith("data:") ? "base64" : "url",
            "length:",
            openaiImageUrl?.length,
          )
          return Response.json({
            url: openaiImageUrl,
            filename: `${filename}-openai-v${variation_number}`,
            variation_number,
            needs_watermark: apply_watermark,
          })
        } catch (err) {
          console.error(`[v0] OpenAI GPT Image 1 failed:`, err)
          throw err
        }
      } else if (provider === "openai_mini") {
        console.log(`[v0] Calling OpenAI GPT Image 1 Mini (v${variation_number})`)
        try {
          const openaiMiniImageUrl = await generateOpenAIImage(original_url, promptToUse, "gpt-image-1-mini")
          console.log(
            "[v0] OpenAI Mini returned URL type:",
            openaiMiniImageUrl?.startsWith("data:") ? "base64" : "url",
            "length:",
            openaiMiniImageUrl?.length,
          )
          return Response.json({
            url: openaiMiniImageUrl,
            filename: `${filename}-openai-mini-v${variation_number}`,
            variation_number,
            needs_watermark: apply_watermark,
          })
        } catch (err) {
          console.error(`[v0] OpenAI GPT Image 1 Mini failed:`, err)
          throw err
        }
      } else if (provider === "openai_1_5") {
        console.log(`[v0] Calling OpenAI GPT Image 1.5 (v${variation_number})`)
        const openai15ImageUrl = await generateOpenAIImage(original_url, promptToUse, "gpt-image-1.5")
        console.log(
          "[v0] OpenAI 1.5 returned URL type:",
          openai15ImageUrl?.startsWith("data:") ? "base64" : "url",
          "length:",
          openai15ImageUrl?.length,
        )
        return Response.json({
          url: openai15ImageUrl,
          filename: `${filename}-openai-1.5-v${variation_number}`,
          variation_number,
          needs_watermark: apply_watermark,
        })
      } else if (provider === "nano_banana" || provider === "nano_banana_pro" || provider === "gemini_3_pro") {
        console.log(`[v0] Calling Nano Banana Pro / Gemini 3 Pro (v${variation_number})`)
        try {
          const nanoBananaUrl = await generateNanoBananaImage(original_url, promptToUse)
          console.log(
            "[v0] Nano Banana returned URL type:",
            nanoBananaUrl?.startsWith("data:") ? "base64" : "url",
            "length:",
            nanoBananaUrl?.length,
          )
          return Response.json({
            url: nanoBananaUrl,
            filename: `${filename}-nanobanana-v${variation_number}`,
            variation_number,
            needs_watermark: apply_watermark,
          })
        } catch (err) {
          console.error(`[v0] Nano Banana Pro failed:`, err)
          throw err
        }
      } else if (provider === "gemini") {
        console.log(`[v0] Using Gemini (v${variation_number})`)
        const geminiImageUrl = await generateGeminiImage(promptToUse, original_url, filename)
        console.log(
          "[v0] Gemini returned URL type:",
          geminiImageUrl.url?.startsWith("data:") ? "base64" : "url",
          "length:",
          geminiImageUrl.url?.length,
        )
        return Response.json({
          url: geminiImageUrl.url,
          filename: `${filename}-gemini-v${variation_number}`,
          variation_number,
          needs_watermark: apply_watermark,
        })
      } else if (provider === "flux_2_pro") {
        console.log(`[v0] Calling FLUX.2 Pro Edit via fal.ai (v${variation_number})`)
        try {
          const flux2ProUrl = await generateFlux2ProEdit(original_url, promptToUse)
          console.log(
            "[v0] FLUX.2 Pro Edit returned URL type:",
            flux2ProUrl?.startsWith("data:") ? "base64" : "url",
            "length:",
            flux2ProUrl?.length,
          )
          return Response.json({
            url: flux2ProUrl,
            filename: `${filename}-flux2pro-v${variation_number}`,
            variation_number,
            needs_watermark: apply_watermark,
          })
        } catch (err) {
          console.error(`[v0] FLUX.2 Pro Edit failed:`, err)
          throw err
        }
      } else {
        // Default to Nano Banana Pro
        console.log(`[v0] Using Nano Banana Pro (default) (v${variation_number})`)
        const nanoBananaUrl = await generateNanoBananaImage(original_url, promptToUse)
        console.log(
          "[v0] Nano Banana returned URL type:",
          nanoBananaUrl?.startsWith("data:") ? "base64" : "url",
          "length:",
          nanoBananaUrl?.length,
        )
        return Response.json({
          url: nanoBananaUrl,
          filename: `${filename}-nanobanana-v${variation_number}`,
          variation_number,
          needs_watermark: apply_watermark,
        })
      }
    } else {
      // ... existing Cloudinary fallback code ...
      console.log(
        "[v0] Falling through to Cloudinary enhancement mode (provider:",
        provider,
        "isAI:",
        isAIProvider,
        ")",
      )

      const tempMultiplier = variation_number === 1 ? 1.0 : -1.0
      const safeEdits = edits || {}

      const scaledEdits: CloudinaryEdits = {
        brightness: safeEdits.brightness || 0,
        contrast: safeEdits.contrast || 0,
        saturation: safeEdits.saturation || 0,
        gamma: safeEdits.gamma || 100,
        sharpen: safeEdits.sharpen || 0,
        temperature: Math.round((safeEdits.temperature || 0) * tempMultiplier),
        shadows: safeEdits.shadows || 0,
        highlights: safeEdits.highlights || 0,
      }

      const cloudinaryUrl = buildCloudinaryFetchUrl(original_url, scaledEdits)
      return Response.json({
        url: cloudinaryUrl,
        filename: `${filename}-v${variation_number}`,
        variation_number,
      })
    }
  } catch (error) {
    console.error("[v0] Edit-image API error:", error)

    const errorMessage = error instanceof Error ? error.message : String(error)
    const status = errorMessage.includes("quota") || errorMessage.includes("429") ? 429 : 500

    return Response.json(
      {
        error: "Failed to generate edited image",
        details: errorMessage,
      },
      { status },
    )
  }
}
