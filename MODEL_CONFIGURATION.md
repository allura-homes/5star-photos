# Model Configuration Documentation

**DO NOT CHANGE THESE MODELS WITHOUT EXPLICIT APPROVAL**

This document defines the exact AI models used for image enhancement. These configurations have been tested and should remain stable.

## v1 - OpenAI
- **Model**: `gpt-image-1`
- **API**: OpenAI Images Edits API (NOT Responses API)
- **Endpoint**: `https://api.openai.com/v1/images/edits`
- **Method**: Multipart FormData (NOT JSON)
- **Required fields**:
  - `image`: PNG file as Blob
  - `prompt`: Text prompt string
  - `model`: "gpt-image-1"
  - `n`: "1"
  - `size`: "1536x1024" (4:3 landscape)
- **Supported sizes**: `1024x1024` (square), `1536x1024` (landscape 4:3), `1024x1536` (portrait 3:4), `auto`
- **Response**: JSON with `data[0].url` or `data[0].b64_json`
- **Purpose**: High-quality image editing with good lighting adjustments
- **Notes**: MUST use FormData, NOT JSON body. The Responses API does NOT work for image editing.

## v2 - Nano Banana Pro
- **Model**: `gemini-3-pro-image-preview`
- **API**: Google Generative Language API
- **Endpoint**: `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent`
- **Purpose**: Best color accuracy and quality for real estate photo enhancement
- **Quality**: Excellent - maintains original color palette, natural-looking enhancements
- **Notes**: Also known as "Nano Banana Pro", requires GOOGLE_CLOUD_API_KEY

## Deprecated Models

### ~~Gemini Flash~~ (DEPRECATED - was v2)
- **Model**: `gemini-2.0-flash-exp-image-generation`
- **Status**: DEPRECATED - removed from production on 2025-12-03
- **Reason**: Consistently produced over-saturated colors, changed house colors dramatically (green houses became yellow/orange), unnatural sky gradients. Not suitable for real estate photo enhancement where color accuracy is critical.

## Art Director Strategy

The Art Director is an AI system that analyzes uploaded photos and generates enhancement prompts for the image models. See [docs/ART_DIRECTOR_STRATEGY.md](docs/ART_DIRECTOR_STRATEGY.md) for the complete guide.

### Key Principles

1. **Golden Rule**: Only describe elements that are VISIBLE in the photo. Never mention pools, lawns, or features that don't exist.

2. **Conditional Enhancements**: All instructions must be conditional - "IF there is a pool, enhance it" not "Enhance the pool"

3. **Preserve Structure**: Driveways, fences, neighbor homes, and property boundaries must never be removed or relocated

4. **Photorealism**: Output should look like professional real estate photography, not AI art. Avoid over-saturation.

5. **Background Preservation**: Explicitly describe and preserve background elements like neighbor homes visible behind fences

## Anti-Hallucination Measures

The prompt explicitly forbids:
- Adding elements not in the original photo
- Removing structural elements (driveways, fences)
- Changing the camera angle or composition
- Over-saturating colors beyond the original palette
- Replacing background buildings with trees/sky

## Version History

- **2025-12-03 (V2 Deprecation)**: Deprecated Gemini Flash due to poor color accuracy
  - Removed gemini-2.0-flash-exp-image-generation from production
  - Renumbered Nano Banana Pro from v3 to v2
  - Reduced variation count from 3 to 2
  - Reason: V2 consistently over-saturated colors and changed house colors

- **2025-12-03 (Art Director Update)**: Enhanced Art Director prompts
  - Added paint/surface condition analysis (chipped paint, peeling, weathering)
  - Added grass/lawn improvement instructions

- **2025-12-03 (V1 Size Fix)**: Updated V1 to use 4:3 landscape format
  - v1: Changed size from "1024x1024" to "1536x1024" (proper 4:3 landscape)
  - Confirmed OpenAI gpt-image-1 supports: 1024x1024, 1536x1024, 1024x1536, auto

- **2025-12-03 (API Fix)**: Fixed V1 API endpoint
  - v1: Changed from Responses API to Images Edits API (`/v1/images/edits`)
  - v1: Changed from JSON body to multipart FormData

---

**⚠️ IMPORTANT**: These model names and endpoints should only be updated when:
1. A model is officially deprecated by the provider
2. Explicit approval is given to test a new model
3. Significant quality improvements are verified through testing
