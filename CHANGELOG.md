# Changelog

All notable changes to the 5star.photos app will be documented in this file.

## [v197] - 2025-12-03 - STABLE CHECKPOINT

### Summary
This version represents a stable checkpoint after significant improvements to the AI image enhancement pipeline. Both V1 (OpenAI) and V2 (Nano Banana Pro) are producing good results with proper color preservation and structural integrity.

### Active Models
- **V1 - OpenAI gpt-image-1**: High-quality image editing via Images Edits API (1536x1024 landscape)
- **V2 - Nano Banana Pro (gemini-3-pro-image-preview)**: Best color accuracy, photorealistic results

### Key Accomplishments
- Deprecated Gemini Flash (V2) due to poor color accuracy (changed house colors)
- Fixed OpenAI API from using Responses API to proper Images Edits API
- Implemented 4:3 landscape aspect ratio (1536x1024) for all outputs
- Added comprehensive Art Director strategy with conditional enhancement rules
- Fixed filename sanitization for Supabase storage (spaces in filenames)
- Reduced V2 max image size to 2MB for reliable API calls
- Fixed error handling for non-JSON error responses

### Art Director Improvements
- Implemented "Golden Rule: Describe Only What You See" to prevent hallucinated elements
- Added conditional enhancement rules (only describe elements that exist)
- Added photorealism requirements to prevent cartoonish/over-saturated outputs
- Added structural preservation rules for driveways, fences, and background elements
- Comprehensive documentation in docs/ART_DIRECTOR_STRATEGY.md

### Known Behaviors
- V1 (OpenAI): Tends to make more dramatic enhancements, occasionally looks slightly stylized
- V2 (Nano Banana Pro): More conservative, better color preservation, very photorealistic
- Both models respect driveway/fence preservation after Art Director updates

---

## Version History

### Pre-v197 Changes (2025-12-03)
- Initial multi-model pipeline with OpenAI, Gemini Flash, and Nano Banana Pro
- Gemini Flash deprecated due to color accuracy issues
- Multiple API fixes for OpenAI endpoint and FormData handling
