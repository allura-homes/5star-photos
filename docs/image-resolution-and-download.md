# Image Resolution and Hi-Res Download System

## Overview

This document describes how each image generation model produces images and how the hi-res download system ensures consistent, high-quality output regardless of which model generated the image.

---

## Model Output Specifications

### V1 (GPT Image / OpenAI gpt-image-1)
- **Resolution:** 1536 x 1024 pixels
- **Format:** PNG
- **Quality:** High fidelity, excellent lighting
- **Location:** `/app/api/edit-image/route.ts` (OpenAI generation block)

\`\`\`typescript
size: "1536x1024"
\`\`\`

### V2 (Nano Banana / Google Gemini)
- **Resolution:** Variable (Gemini auto-selects based on input)
- **Format:** PNG
- **Quality:** Good color accuracy, may produce smaller dimensions
- **Note:** Gemini's image generation API doesn't support explicit resolution parameters
- **Location:** `/app/api/edit-image/route.ts` (Gemini generation block)

### V3 (FLUX.2 Pro / fal.ai)
- **Resolution:** 1536 x 1024 pixels (explicitly set to match V1)
- **Format:** PNG
- **Quality:** Good detail, requires enhanced lighting instructions
- **Location:** `/app/api/edit-image/route.ts` (FLUX generation block)

\`\`\`typescript
image_size: {
  width: 1536,
  height: 1024,
},
output_format: "png"
\`\`\`

---

## Hi-Res Download Flow

### Problem Solved
V2 (Nano Banana/Gemini) images were often smaller than V1 or V3 because Gemini auto-selects resolution. Users expecting consistent hi-res downloads were getting varying quality.

### Solution: On-Demand Upscaling

When a user clicks "Download Hi-Res", the system:

1. **Calls the Upscale API** (`/api/upscale`)
2. **Uses fal.ai ESRGAN** to 2x upscale the image
3. **Falls back gracefully** to original image if upscaling fails
4. **Downloads the result** as a PNG file

### Upscale API Endpoint

**Location:** `/app/api/upscale/route.ts`

**Request:**
\`\`\`typescript
POST /api/upscale
{
  "imageUrl": "https://...",  // URL of image to upscale
  "scale": 2                   // Upscale factor (2x default)
}
\`\`\`

**Response:**
\`\`\`typescript
{
  "url": "https://...",        // URL of upscaled image
  "width": 3072,               // New dimensions
  "height": 2048
}
\`\`\`

**Technology:** Uses fal.ai's ESRGAN model (`fal-ai/esrgan`) for high-quality upscaling.

### Download Modal Implementation

**Location:** `/components/download-selection-modal.tsx`

The `downloadImage` function:
1. Validates the preview URL exists
2. Calls `/api/upscale` with the image URL and 2x scale
3. If upscaling succeeds, uses the upscaled URL
4. If upscaling fails, falls back to original URL
5. Fetches the final image and triggers browser download
6. Names file as `{originalname}_{model}_hires.png`

---

## Output Quality Summary

| Model | Generation Resolution | After Hi-Res Download (2x) |
|-------|----------------------|---------------------------|
| V1    | 1536 x 1024          | 3072 x 2048               |
| V2    | Variable (~1024)     | ~2048 x 2048              |
| V3    | 1536 x 1024          | 3072 x 2048               |

---

## Related Files

- `/app/api/edit-image/route.ts` - Model-specific generation settings
- `/app/api/upscale/route.ts` - ESRGAN upscaling endpoint
- `/components/download-selection-modal.tsx` - Hi-res download UI and logic

---

## Future Improvements

1. **Pre-generate hi-res versions** - Upscale during initial generation instead of on-demand
2. **4x upscaling option** - Allow users to choose upscale factor
3. **Gemini resolution hints** - Investigate if newer Gemini APIs support resolution parameters
4. **Caching** - Store upscaled versions to avoid re-processing on repeat downloads
