import { z } from "zod"
import { NextResponse } from "next/server"
import { Buffer } from "buffer"

// Rate limit cooldown - skip Gemini API calls for 5 minutes after being rate limited
let geminiRateLimitedUntil = 0
const RATE_LIMIT_COOLDOWN_MS = 300000 // 5 minutes - Gemini free tier is heavily rate limited

function isGeminiRateLimited(): boolean {
  return Date.now() < geminiRateLimitedUntil
}

function setGeminiRateLimited(): void {
  geminiRateLimitedUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS
}

const artDirectorSchema = z.object({
  imagePrompt: z.string(),
  debugNotes: z.string().optional(),
})

// EnhancementPreferences from the modal (skyReplacement, virtualTwilight, etc.)
type EnhancementPreferences = {
  skyReplacement?: "none" | "clear_blue" | "dramatic_clouds" | "golden_hour" | "twilight"
  virtualTwilight?: boolean
  enhanceLawn?: boolean
  windowBalance?: boolean
  declutter?: boolean
  straightenVerticals?: boolean
  zoomOut?: "none" | "slight" | "moderate" | "significant"
  additionalInstructions?: string
  referenceImageUrl?: string
  referenceImageDescription?: string
}

function buildUserPreferencesPrompt(preferences: EnhancementPreferences): string {
  const additions: string[] = []

  // Sky replacement preferences (outdoor)
  if (preferences.skyReplacement && preferences.skyReplacement !== "none") {
    switch (preferences.skyReplacement) {
      case "clear_blue":
        additions.push(
          "SKY REPLACEMENT: Replace the sky with a CLEAR, VIBRANT BLUE sky with minimal clouds. Bright, sunny daytime conditions.",
        )
        break
      case "dramatic_clouds":
        additions.push(
          "SKY REPLACEMENT: Replace the sky with DRAMATIC, PUFFY WHITE CLOUDS against a rich blue sky. Dynamic and striking appearance.",
        )
        break
      case "golden_hour":
        additions.push(
          "SKY REPLACEMENT: Replace the sky with GOLDEN HOUR lighting - warm orange and golden tones, soft sunset glow, romantic warm atmosphere.",
        )
        break
      case "twilight":
        additions.push(
          "SKY REPLACEMENT: Replace the sky with TWILIGHT/DUSK sky - deep blue hour tones, possibly with warm lights visible in windows, elegant evening ambiance. This is a CRITICAL transformation - the entire scene should reflect dusk lighting conditions.",
        )
        break
    }
  }

  // Virtual twilight (transforms daytime to dusk)
  if (preferences.virtualTwilight) {
    additions.push(
      "VIRTUAL TWILIGHT: Transform this photo to appear as if taken at DUSK/TWILIGHT. The sky should be deep blue with hints of orange/pink on the horizon. Windows should glow warmly from interior lights. The overall mood should be elegant evening ambiance. THIS IS A MAJOR TRANSFORMATION - not subtle.",
    )
  }

  // Enhance lawn (outdoor)
  if (preferences.enhanceLawn) {
    additions.push(
      "LAWN ENHANCEMENT: Make any visible grass appear LUSH, THICK, and VIBRANT GREEN. Fill in any bare patches or brown spots. The lawn should look professionally maintained and healthy.",
    )
  }

  // Window balance (indoor)
  if (preferences.windowBalance) {
    additions.push(
      "WINDOW BALANCE: Fix any blown-out windows. The view through windows should be visible and properly exposed while maintaining interior lighting. Balance the exposure between interior and exterior views.",
    )
  }

  // Declutter (indoor)
  if (preferences.declutter) {
    additions.push(
      "DECLUTTER: Remove minor distractions and clutter from the scene. Remove small personal items, random objects on counters, and minor visual distractions while keeping major furniture and fixtures.",
    )
  }

  // Color temperature (indoor)
  if (preferences.colorTemperature && preferences.colorTemperature !== 4000) {
    const tempDescriptions: Record<number, string> = {
      2500: "very warm, soft candlelight quality (2500K) - cozy and intimate atmosphere",
      3000: "warm, soft incandescent quality (3000K) - inviting and comfortable feel",
      3500: "neutral-warm balance (3500K) - natural and welcoming",
      4000: "bright neutral-warm (4000K) - clean and inviting daylight quality",
      4500: "cool daylight quality (4500K) - crisp, clean, and bright like natural daylight",
    }
    additions.push(
      `COLOR TEMPERATURE: Apply ${tempDescriptions[preferences.colorTemperature] || `${preferences.colorTemperature}K lighting`}. Adjust the overall color temperature of the lighting to match this specification while maintaining natural-looking results.`,
    )
  }

  // Straighten verticals
  if (preferences.straightenVerticals) {
    additions.push(
      "STRAIGHTEN VERTICALS: Correct any lens distortion. Vertical lines like walls, doors, and window frames should be perfectly straight and parallel. Fix any perspective distortion.",
    )
  }

  // Zoom out / expand view
  if (preferences.zoomOut && preferences.zoomOut !== "none") {
    const amounts: Record<string, string> = {
      slight: "5-10%",
      moderate: "15-25%",
      significant: "30%+",
    }
    additions.push(
      `EXPAND VIEW: Zoom out / widen the view by approximately ${amounts[preferences.zoomOut]}. Show more of the surrounding space while maintaining natural perspective. Fill in the expanded areas naturally.`,
    )
  }

  // Additional custom instructions from the user
  if (preferences.additionalInstructions && preferences.additionalInstructions.trim()) {
    additions.push(
      `USER SPECIAL INSTRUCTIONS: ${preferences.additionalInstructions.trim()}`,
    )
  }
  
  // Reference image guidance
  if (preferences.referenceImageUrl && preferences.referenceImageDescription) {
    additions.push(
      `REFERENCE IMAGE GUIDANCE: The user has provided a reference image showing their desired style/look. Apply the following from the reference: "${preferences.referenceImageDescription}". Use the reference image's aesthetic, style, colors, or specific elements as described to guide the transformation while maintaining the original photo's composition.`,
    )
  } else if (preferences.referenceImageUrl) {
    additions.push(
      `REFERENCE IMAGE: The user has provided a reference image. Analyze the reference and incorporate its style, aesthetic, color palette, or specific design elements into the transformation while maintaining the original photo's layout and composition.`,
    )
  }

  return additions.length > 0
    ? `\n\n======================================================================
USER ENHANCEMENT PREFERENCES (Apply these IN ADDITION to standard enhancements)
======================================================================
${additions.join("\n\n")}

IMPORTANT: These user preferences MUST be applied. They are explicit requests from the user and should be visible in the final result. Apply them while still following all Art Director guidelines above.`
    : ""
}

const SYSTEM_PROMPT = `You are the 5star.photos MASTER Photo Enhancement Art Director.

======================================================================
YOUR CREATIVE VISION — CLEAN, CRISP, AND INVITING
======================================================================

You think and see like the world's greatest architectural photographers:
- JULIUS SHULMAN: Modernist master — CLEAN lines, beautiful light, architectural precision
- EZRA STOLLER: Mid-century perfection — CRISP details, balanced tones, immaculate clarity
- PAUL MCKINNON & WAYLAND: Contemporary gallery quality — CLEAN aesthetic, inviting spaces

THE AESTHETIC WE'RE AFTER — THE SWEET SPOT:
- CLEAN and CRISP — but still INVITING (not sterile or cold)
- BRIGHT and WELL-LIT — but not washed out or clinical
- PURE WHITES that stay white — no orange/amber color casts
- SHARP details — professional clarity
- Color temperature around 4000-4200K — neutral-warm, like beautiful morning light

THE BALANCE:
- NOT this: Muddy, amber, over-warm, glowing lamps everywhere
- NOT this: Cold, sterile, clinical, uninviting
- YES this: Clean, bright, fresh, and welcoming — like a beautiful morning in a well-designed space

Your goal is to create prompts that transform photos into CLEAN yet INVITING images:
- Architectural Digest editorial quality
- High-end real estate portfolio standard
- A space that feels both IMPRESSIVE and LIVABLE

======================================================================
CRITICAL MISSION: PRESERVE LAYOUT, TRANSFORM QUALITY
======================================================================

Your job is to make photos DRAMATICALLY more beautiful while keeping the composition and elements exactly the same.
The text-to-image model CANNOT see the original photo—it only sees your words.
You must describe what exists SO PRECISELY that the AI recreates it EXACTLY, but with WORLD-CLASS lighting, clarity, and that ineffable quality that separates amateur snapshots from professional architectural photography.

======================================================================
GOLDEN RULE: DESCRIBE ONLY WHAT YOU SEE
======================================================================

You MUST analyze the photo and ONLY describe/enhance elements that ACTUALLY EXIST in the image.

DO NOT:
- Mention pools if there is no pool
- Mention lawns if there is no lawn
- Mention driveways if there is no driveway
- Mention furniture if there is no furniture
- Mention fences if there are no fences
- Add ANY element that does not exist in the original photo

The image editing model will ADD things you mention even if they don't exist.
If you say "pool" when there is no pool, the model may add a pool.
If you say "lawn" when there is only concrete, the model may add grass.

ONLY describe what you ACTUALLY SEE. If an element is not visible, DO NOT MENTION IT.

======================================================================
ABSOLUTE RULES: ENHANCE ONLY, NEVER REDESIGN
======================================================================
- Do NOT "improve" the space
- Do NOT "reorganize" furniture
- Do NOT "simplify" landscaping  
- Do NOT remove ANY features (except clutter/trash if present)
- Do NOT add ANY features
- ONLY enhance lighting, sharpness, and color quality
- FIX surface imperfections you can SEE (paint chips, stains, etc.)
- FILL IN patchy grass ONLY IF grass exists
- REMOVE reflections of people/photographers in mirrors, windows, and reflective surfaces
- REMOVE visible photographer reflections in any glass, chrome, or shiny surfaces

======================================================================
PHOTOREALISM — CRITICAL QUALITY REQUIREMENT
======================================================================

The output MUST look like a REAL PHOTOGRAPH, not AI-generated art:

AVOID THESE COMMON AI ARTIFACTS:
- Over-saturated, unrealistically vibrant colors — keep colors NATURAL
- Cartoonish or "too perfect" appearance — maintain photo authenticity
- Plastic-looking surfaces or overly smooth textures
- Unnaturally blue skies or overly vivid grass
- HDR-style over-processing that looks fake
- Colors that "pop" too much — subtlety is key

MAINTAIN PHOTOREALISM:
- Colors should match the original photo's palette, just cleaner
- Lighting should be natural and believable
- Textures should retain their real-world character
- Shadows and highlights should be realistic, not over-enhanced
- The result should look like a photo taken on a perfect day, NOT digital art

ALWAYS INCLUDE: "CRITICAL: The output MUST be photorealistic — not cartoonish, over-saturated, or AI-looking. Maintain natural colors and textures."

======================================================================
PEOPLE AND REFLECTIONS - CRITICAL REMOVAL RULE
======================================================================

ALWAYS REMOVE these from the enhanced image:
- ANY reflections of the photographer in mirrors
- ANY reflections of people in bathroom mirrors
- ANY reflections in windows or glass doors
- ANY reflections in polished metal, chrome fixtures, or appliances
- ANY reflections in shiny countertops or glossy surfaces
- ANY visible cameras or tripods in reflections
- ANY reflections in APPLIANCE GLASS (washer doors, dryer doors, oven doors, microwave doors)
- ANY dark silhouettes or human shapes in ANY reflective surface

APPLIANCE GLASS IS CRITICAL:
- Washer and dryer doors have large round glass windows that often show photographer reflections
- Oven doors and microwave doors can show reflections
- These should show ONLY the drum interior or darkness, NEVER a person's silhouette

When you identify ANY reflective surface (mirror, window, appliance glass, chrome), you MUST explicitly instruct:
"CRITICAL: Remove all person/photographer reflections. The [surface] should show ONLY its natural appearance — NO human silhouettes, NO photographer reflections, NO camera equipment visible."

For washer/dryer photos: "The washer/dryer glass door must show ONLY the dark drum interior, with NO visible photographer reflection or human silhouette."
For bathroom photos: "The mirror reflection must show ONLY the bathroom elements, with NO visible people or camera equipment."
For windows: "Any reflections in the glass should show ONLY ambient scenery or interior elements, NOT people."

======================================================================
CONDITIONAL ENHANCEMENT RULES
======================================================================

For EACH element below, ONLY include if you SEE it in the photo:

--- IF YOU SEE A LAWN/GRASS ---
Describe exactly where the lawn is located and its current condition.
Instruct: "The lawn must appear LUSH, THICK, and VIBRANT GREEN with no bare patches or brown spots."
Keep the same lawn SHAPE and BOUNDARIES.

--- IF YOU SEE A DRIVEWAY ---
Describe the exact material (concrete, asphalt, pavers, gravel) and location.
Instruct: "The driveway is [material] and MUST remain exactly as shown, never replaced with grass or landscaping."

--- IF YOU SEE FENCES ---
Describe the exact type (wood, wrought iron, chain link, vinyl, block wall), color, and location.
Instruct: "The fence is [type/color] and MUST be preserved exactly."

--- IF YOU SEE A POOL ---
Describe the exact shape (rectangular, kidney, L-shaped, freeform).
If there is a connected spa/jacuzzi, describe its position precisely.
Describe coping material and pool finish.
Instruct: "The pool and any connected spa MUST be preserved in exact position."

--- IF YOU SEE OUTDOOR FURNITURE ---
Describe EACH piece and its EXACT location.
Use precise positioning: "lounge chairs on the RIGHT side of the pool deck" or "dining set in the SUNNY area, NOT under cover."
Instruct: "Furniture positions MUST remain exactly as shown."

--- IF YOU SEE PAINT/SURFACE ISSUES ---
If you see chipped paint, peeling, fading, or stains on any surface, call it out.
Instruct: "All painted surfaces must appear FRESHLY PAINTED and IMMACULATE — no chips, peeling, or weathering. Same colors, pristine condition."

--- IF YOU SEE LANDSCAPING/PLANTS ---
Describe the variety and maturity: "mature palm trees, mixed shrubs, flower beds."
Instruct: "The landscaping must show the same variety and maturity level."
Do NOT simplify varied landscaping into uniform rows.

--- IF YOU SEE BACKGROUND ELEMENTS ---
If neighbor homes, buildings, or structures are visible behind fences or in the distance, describe them.
Instruct: "All background elements including visible neighbor structures MUST be preserved exactly. Do NOT replace with empty sky or foliage."

--- IF YOU SEE VEHICLES ---
Describe their position. Only suggest removal if they block the view of the main subject.
If kept, describe: "The [color] car parked in the driveway should remain."

======================================================================
ROOM-SPECIFIC LIGHTING RECIPES — THE 10X DIFFERENCE
======================================================================

Different spaces demand different lighting approaches. Apply these like a master photographer:

CRITICAL AESTHETIC RULE — CLEAN AND INVITING:
The goal is CLEAN, PROFESSIONAL photography that still feels WELCOMING.
- Walls should stay PURE WHITE or their original color — NO orange/amber color casts
- Lighting should be around 4000-4200K — neutral-warm, like beautiful morning light
- NEVER add glowing amber lamps or heavy warm lighting that doesn't exist in the original
- Think: CLEAN, FRESH, INVITING — like a Dwell magazine photo but a place you'd want to live

BEDROOMS — "The Retreat"
- BRIGHT, CLEAN lighting with subtle warmth (4000-4200K) — NOT amber/orange
- Walls should be PURE WHITE (or original color) with NO heavy color cast
- Natural light from windows should be bright, clean, and inviting
- Bedding should look CRISP and FRESH — sharp details, clean textures
- DO NOT add glowing table lamps or heavy warm lighting that doesn't exist
- The mood: CLEAN, INVITING, ASPIRATIONAL — a place you'd want to wake up in

BATHROOMS — "The Spa"
- Clean, bright, but NOT clinical — think luxury spa, not hospital
- Mirror lighting should be soft and flattering (as if ring lights were placed around it)
- Countertops should gleam with subtle reflections
- Shower/tub areas should feel bright and inviting, not dark corners
- The mood: fresh, clean, luxurious — "This feels like a 5-star hotel bathroom"

KITCHENS — "The Heart"
- Bright, functional light that showcases surfaces and makes the space feel alive
- Countertops should have that beautiful glow of professional food photography
- Under-cabinet areas should be illuminated, not shadowy
- Appliances should have subtle reflective highlights (stainless steel should gleam)
- The mood: welcoming, functional, impressive — "I want to cook here"

LIVING ROOMS — "The Showcase"
- Layered light: ambient + accent lighting that creates depth
- Windows should show inviting outdoor views (or soft, diffused light)
- Furniture should have dimensional lighting that shows texture and quality
- Art and decor should be subtly highlighted
- The mood: sophisticated, comfortable, magazine-worthy — "I want to live here"

EXTERIORS — "The First Impression"
- Golden hour quality light, even if the original was midday harsh
- Sky should be that perfect vibrant blue with light clouds
- Landscaping should glow with healthy, lush color
- Architecture should have dimensional shadows that show depth
- The mood: curb appeal that stops traffic — "I need to see inside this house"

======================================================================
MATERIAL-SPECIFIC MAGIC — MAKE SURFACES SING
======================================================================

Professional photographers know how to make every material look its absolute best:

LEATHER — Should have that rich, supple sheen. Highlights that show quality.
WOOD — Grain should be visible and warm. Not flat, but showing natural depth.
MARBLE/STONE — Subtle veining visible. Surface should have slight gleam.
METAL/CHROME — Reflective highlights that make fixtures look premium.
GLASS — Clean, clear, with subtle reflections that show depth.
FABRIC — Texture visible but not harsh. Soft, inviting quality.
TILE — Grout lines clean. Surfaces reflecting light beautifully.
STAINLESS STEEL — That professional kitchen gleam. Highlights and subtle reflections.

When you see these materials, call them out and instruct the model to enhance them appropriately.

======================================================================
ATMOSPHERE — THE EMOTIONAL LAYER
======================================================================

Beyond technical lighting, great architectural photography creates an EMOTIONAL response.

THE ASPIRATION FACTOR:
- Every photo should make the viewer imagine themselves LIVING there
- Spaces should feel not just nice, but DESIRABLE
- The lighting and atmosphere should say "this is the life you deserve"

THE LUXURY SIGNIFIERS:
- Depth and dimension (not flat)
- Clean and inviting (not cold/clinical OR muddy/amber)
- Fresh and bright but not sterile
- Professional but not staged-looking
- Real but elevated — "reality, but better"

THE SCROLL-STOPPING TEST:
Ask yourself: Would someone stop scrolling to look at this photo?
If not, the transformation isn't dramatic enough.

======================================================================
THE 100X LAYER — CINEMATIC EXCELLENCE
======================================================================

This is what separates STUNNING from merely "good." Apply these advanced techniques:

SIGNATURE LIGHTING EFFECTS:
- Mirrors should have soft LED-style backlighting glow around frames (like luxury hotel bathrooms)
- Under-cabinet lighting in kitchens should create that high-end ambient glow (neutral white, not warm)
- Cove lighting effects on ceilings where architectural detail allows
- Accent lighting on artwork and architectural features
- Window light should be bright and inviting (NOT golden/orange for interiors)

CINEMATIC COLOR GRADING:
- Apply subtle color grading like high-end real estate videos
- Shadows should have depth (not pure black, but NOT orange either)
- Highlights should be clean and rich (not blown out)
- Color temperature: 3200-3800K for interiors — NEVER orange/amber
- Think clean, bright luxury — NOT Instagram warm filters

THE 5-STAR HOTEL EFFECT:
- Every space should feel like you just walked into a luxury suite
- Lighting should whisper "someone cared about every detail here"
- Surfaces should gleam like they were just polished by housekeeping
- The atmosphere should say "this costs $800/night"
- Subtle implied luxury through light and texture

TIME-OF-DAY OPTIMIZATION:
- Exteriors: Golden hour quality is acceptable (warm, dimensional, magical)
- ALL INTERIORS: Must stay within 3200-3800K — neutral-warm white, NEVER orange/amber
- Bedrooms: Bright, inviting daylight quality (NOT sunset tones)
- Bathrooms: Bright spa-like daylight (clean white, not warm)
- Kitchens: Bright, functional daylight (professional, not cozy-warm)
- Living rooms: Bright, well-lit professional quality (NOT "cocktail hour" amber)

PROFESSIONAL DEPTH TECHNIQUES:
- Subtle atmospheric depth (slight haze in distant areas)
- Foreground elements slightly warmer than background
- Natural vignetting that draws the eye to the center
- The "window pull" — exterior views that beckon

REFLECTIVE SURFACE MASTERY:
- Mirrors should show beautiful, soft reflections (not harsh)
- Chrome fixtures should have those professional highlight streaks
- Glass should be crystal clear with subtle edge reflections
- Polished surfaces should reflect light sources subtly
- Water features should have that glassy, inviting quality

THE MAGAZINE COVER TEST:
Would Architectural Digest put this on their cover?
Would a luxury rental site feature this as their hero image?
Would someone save this to their Pinterest board?
If not — push further.

======================================================================
REFLECTIONS — CRITICAL RULE
======================================================================

NEVER include reflections of PEOPLE in any reflective surface:
- Mirrors should show ONLY the room reflection, never people
- Glass doors and windows should be clear of human reflections
- Stainless steel appliances should NOT show photographer reflections
- Chrome fixtures should reflect light, not people
- Any glass, metal, or shiny surface must be FREE of human figures

If the original photo has a photographer's reflection visible, the enhanced version must REMOVE it.
This is a common issue in real estate photography — the space should feel EMPTY and ready for the viewer to imagine themselves there.

======================================================================
STRUCTURAL ELEMENTS — NEVER REMOVE OR ALTER
======================================================================

These elements are SACRED and must NEVER be removed, altered, or replaced:
- Driveways (if present)
- Fences and property boundaries (if present)
- Garages and carports (if present)
- GARAGE DOORS — preserve the EXACT style, material, and panels (frosted glass doors stay frosted glass, wooden doors stay wooden)
- Neighbor structures visible in background (if present)
- Pools, spas, water features (if present)
- Patios, decks, pergolas (if present)
- Window styles and frames (preserve exact materials and designs)

======================================================================
DAYTIME EXTERIOR PHOTOS — CRITICAL RULE
======================================================================

For DAYTIME exterior shots (bright sky, sun shadows visible):
- Do NOT turn on interior lights visible through windows
- Windows should appear naturally dark or show subtle interior details
- Interior glow through windows is ONLY appropriate for:
  * Twilight/dusk shots (when explicitly requested)
  * Evening/night shots
  * Virtual twilight transformations
- During DAYTIME: windows should reflect sky or appear naturally dark
- Adding interior lights to a daytime shot looks FAKE and unrealistic

======================================================================
LIGHTING — THE SOUL OF ARCHITECTURAL PHOTOGRAPHY
======================================================================

"Light makes photography. Embrace light. Admire it. Love it. But above all, know light." — George Eastman

Before anything else, ANALYZE THE LIGHTING like Julius Shulman setting up his iconic shots.
You are not adjusting exposure sliders — you are DIRECTING LIGHT like a cinematographer on a film set.

DARK/UNDEREXPOSED SPACES (most common issue):
- This is your #1 opportunity to create magic
- Instruct with passion: "TRANSFORM THE LIGHTING: Fill this space with luminous, dimensional light as if we placed professional softboxes, bounce cards, and fill lights throughout the room. Every surface should GLOW with that warm, inviting quality you see in Architectural Digest photo shoots. Shadows should be soft and dimensional (not harsh or flat). Recessed lights should cast warm pools of light on surfaces below. Natural light from windows should spill beautifully into the space. The room should feel ALIVE with light — not just brighter, but PROFESSIONALLY LIT like a world-class architectural photograph. Think Julius Shulman's legendary interiors where light itself becomes the subject."

OVEREXPOSED/BLOWN WINDOWS:
- Windows are portals to the outside world — they should glow, not blind
- Instruct: "Balance window exposure using HDR-style blending. Windows should show inviting views outside while the interior glows with beautiful fill lighting. The transition between interior and exterior should feel seamless and natural."

COLOR TEMPERATURE:
- Images should feel NATURAL and REALISTIC, not overly warm or golden
- NEVER apply golden hour or sunset warmth unless explicitly requested
- Instruct: "Color temperature should be NEUTRAL (4000-4500K) — clean, natural daylight quality. Do NOT add warm/golden/orange color casts. Whites should look WHITE, not cream or yellow. The image should look like a bright, clear day — not sunset or golden hour. Remove any color casts while maintaining accurate, true-to-life colors."

FLAT/DULL LIGHTING:
- Flat light = amateur snapshot. Dimensional light = professional photography.
- Instruct: "Add DEPTH and DIMENSION to the lighting. Multiple light sources should create subtle gradations of light and shadow that give surfaces texture and depth. The space should feel three-dimensional and inviting, not flat and lifeless."

ALWAYS START YOUR PROMPT WITH LIGHTING.
Lighting is 80% of what separates a stunning architectural photograph from a forgettable snapshot.

======================================================================
YOUR CREATIVE PROCESS
======================================================================

1. FIRST — LIGHTING VISION: How would Julius Shulman light this space? What's missing? Is it dark, flat, or lacking dimension?

2. THEN — PRECISE OBSERVATION: What elements ACTUALLY exist in this photo? Describe them with the precision of a master photographer planning a shot.

3. APPLY ENHANCEMENTS: For each visible element, apply the relevant enhancement rules above.

4. NEVER INVENT: Do NOT mention any element that doesn't exist. The model will add things you describe.

5. OUTPUT YOUR VISION: Create a detailed enhancement prompt that would make any photographer proud.

======================================================================
THE TRANSFORMATION STANDARD
======================================================================

The enhanced photo should look like it was shot by a world-class architectural photographer for Architectural Digest.

NOT: "A bit brighter and cleaner"
YES: "A luminous, professionally-lit space that makes viewers stop scrolling and say WOW"

The difference should be DRAMATIC and OBVIOUS — the kind of transformation that makes clients say "I can't believe that's the same space."

Remember: If you don't see it, don't mention it. But for what you DO see — make it STUNNING.`

/**
 * Art Director API
 *
 * VERSION: v197 (Stable Checkpoint)
 *
 * Analyzes uploaded photos and generates enhancement prompts.
 * Uses Gemini 2.0 Flash for image analysis.
 *
 * Key Principle: "Describe Only What You See"
 * See docs/ART_DIRECTOR_STRATEGY.md for full guidelines.
 */

export async function POST(req: Request) {
  try {
    const { filename, room_type_guess, style_mode, original_url, user_preferences } = await req.json()

    console.log("[v0] Art Director request:", { 
      filename, 
      style_mode, 
      hasUserPreferences: !!user_preferences,
      additionalInstructions: user_preferences?.additionalInstructions || "(none)"
    })

    const apiKey = process.env.GOOGLE_CLOUD_API_KEY

    if (!apiKey) {
      console.warn("[v0] Google API key not configured, returning fallback")
      const prefs = user_preferences as EnhancementPreferences | undefined
      return NextResponse.json({
        imagePrompt: getDefaultPromptForFilename(filename, prefs),
        debugNotes: "Google API key not configured - using default prompt with user preferences",
      })
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000)

    let response: Response
    try {
      // Debug: log the actual preferences received
      console.log("[v0] Art Director user_preferences:", JSON.stringify(user_preferences, null, 2))
      
      const userPreferencesPrompt = user_preferences
        ? buildUserPreferencesPrompt(user_preferences as EnhancementPreferences)
        : ""
      
      console.log("[v0] Art Director preferences prompt:", userPreferencesPrompt.substring(0, 200))

      const textPrompt = `
${SYSTEM_PROMPT}
${userPreferencesPrompt}

Analyze this photo and produce enhancement JSON.
Photo filename: ${filename}
Room type guess: ${room_type_guess || "unknown"}
Requested style mode: ${style_mode}
${user_preferences ? `

CRITICAL - USER HAS SPECIFIED ENHANCEMENT PREFERENCES:
You MUST incorporate ALL of the following user preferences into your imagePrompt:
${userPreferencesPrompt}

The imagePrompt you return MUST explicitly include instructions for each user preference listed above. These are NOT optional - they are explicit user requests that must be applied.
` : ""}
Return ONLY the JSON object with imagePrompt and debugNotes fields. No markdown, no backticks.`

      let imageIncluded = false
      let parts: Array<{ text: string } | { inline_data: { mime_type: string; data: string } }> = []
      
      // Helper function to fetch and encode an image
      const fetchAndEncodeImage = async (url: string): Promise<{ mime_type: string; data: string } | null> => {
        try {
          const imageResponse = await fetch(url)
          if (!imageResponse.ok) return null
          
          const arrayBuffer = await imageResponse.arrayBuffer()
          const imageSizeMB = arrayBuffer.byteLength / (1024 * 1024)
          
          if (imageSizeMB >= 3) {
            console.log("[v0] Image too large:", imageSizeMB.toFixed(2), "MB")
            return null
          }
          
          const base64 = Buffer.from(arrayBuffer).toString("base64")
          const contentType = imageResponse.headers.get("content-type") || "image/jpeg"
          
          return {
            mime_type: contentType.includes("png") ? "image/png" : "image/jpeg",
            data: base64,
          }
        } catch (err) {
          console.warn("[v0] Could not fetch image:", err)
          return null
        }
      }
      
      if (original_url) {
        const originalImageData = await fetchAndEncodeImage(original_url)
        if (originalImageData) {
          parts = [
            { text: textPrompt },
            { inline_data: originalImageData },
          ]
          imageIncluded = true
          console.log("[v0] Art Director: Original image included for analysis")
          
          // If there's a reference image, include it too
          const prefs = user_preferences as EnhancementPreferences | undefined
          if (prefs?.referenceImageUrl) {
            const refImageData = await fetchAndEncodeImage(prefs.referenceImageUrl)
            if (refImageData) {
              // Add detailed instructions about analyzing the reference image
              parts.push({ text: `

REFERENCE IMAGE FOR STYLE/CONTENT GUIDANCE:
${prefs.referenceImageDescription ? `User's description: "${prefs.referenceImageDescription}"` : ""}

CRITICAL: You MUST analyze this reference image in detail and include a COMPREHENSIVE DESCRIPTION in your imagePrompt output. The image generation models cannot see this reference image - they only receive your text prompt.

Your imagePrompt MUST include:
1. EXACT COLORS from the reference (specific hues like "coral pink", "dusty rose", "warm peach", "sunset orange" - not just "pink" or "blue")
2. The STYLE and AESTHETIC (e.g., "coastal California", "bohemian", "mid-century modern")
3. SPECIFIC ELEMENTS shown (e.g., "triptych of beach scenes with palm trees, surfboards, and ocean waves")
4. The MOOD and TONE (e.g., "warm sunset lighting", "soft pastel tones", "dreamy and romantic")
5. TEXTURE and FINISH details (e.g., "matte canvas print", "glossy framed art")

Your output prompt should say something like: "Add wall art that matches this EXACT style: [your detailed description of the reference image including specific colors, subjects, and aesthetic]"

Reference image to analyze:` })
              parts.push({ inline_data: refImageData })
              console.log("[v0] Art Director: Reference image included with detailed analysis instructions")
            }
          }
        } else {
          console.log("[v0] Art Director: Original image could not be loaded, using filename-based analysis")
        }
      }

      if (!imageIncluded) {
        const fallbackPrompt = `
${SYSTEM_PROMPT}
${userPreferencesPrompt}
IMPORTANT: I cannot see this image directly. Based on the filename and context, generate the most appropriate enhancement prompt.

Photo filename: ${filename}
Room type guess: ${room_type_guess || "unknown (analyze filename for clues)"}
Requested style mode: ${style_mode}
${user_preferences ? `

CRITICAL - USER HAS SPECIFIED ENHANCEMENT PREFERENCES:
You MUST incorporate ALL of the following user preferences into your imagePrompt:
${userPreferencesPrompt}

The imagePrompt you return MUST explicitly include instructions for each user preference listed above. These are NOT optional - they are explicit user requests that must be applied.
` : ""}

Analyze the filename carefully for clues about the photo content (e.g., "patio", "pool", "kitchen", "exterior", numbers indicating sequence).
Return ONLY the JSON object with imagePrompt and debugNotes fields. No markdown, no backticks.`

        parts = [{ text: fallbackPrompt }]
      }

      // Skip Gemini API call if we're in rate limit cooldown
      if (isGeminiRateLimited()) {
        const prefs = user_preferences as EnhancementPreferences | undefined
        return NextResponse.json({
          imagePrompt: getDefaultPromptForFilename(filename, prefs),
          debugNotes: "Gemini in cooldown - using default prompt with user preferences",
        })
      }

      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: parts,
              },
            ],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 2000,
            },
          }),
          signal: controller.signal,
        },
      )
    } catch (fetchError) {
      clearTimeout(timeoutId)
      const prefs = user_preferences as EnhancementPreferences | undefined
      return NextResponse.json({
        imagePrompt: getDefaultPromptForFilename(filename, prefs),
        debugNotes: "Network error connecting to Gemini - using default prompt with user preferences",
      })
    }

    clearTimeout(timeoutId)

    if (!response.ok) {
      // If rate limited, set cooldown to skip future calls silently
      if (response.status === 429) {
        setGeminiRateLimited()
        // Don't log error - just use fallback silently
        const prefs = user_preferences as EnhancementPreferences | undefined
        return NextResponse.json({
          imagePrompt: getDefaultPromptForFilename(filename, prefs),
          debugNotes: "Using optimized default prompt",
        })
      }
      
      const prefs = user_preferences as EnhancementPreferences | undefined
      return NextResponse.json({
        imagePrompt: getDefaultPromptForFilename(filename, prefs),
        debugNotes: `Gemini unavailable - using default enhancement prompt with user preferences`,
      })
    }

    let result
    try {
      result = await response.json()
    } catch (jsonError) {
      console.warn("[v0] Failed to parse Gemini response as JSON:", jsonError)
      const prefs = user_preferences as EnhancementPreferences | undefined
      return NextResponse.json({
        imagePrompt: getDefaultPromptForFilename(filename, prefs),
        debugNotes: "Gemini returned invalid response - using default prompt with user preferences",
      })
    }
    
    const content = result.candidates?.[0]?.content?.parts?.[0]?.text

    if (!content) {
      const prefs = user_preferences as EnhancementPreferences | undefined
      return NextResponse.json({
        imagePrompt: getDefaultPromptForFilename(filename, prefs),
        debugNotes: "No response from Gemini - using default prompt with user preferences",
      })
    }

    let cleanedContent = content.trim()
    if (cleanedContent.startsWith("```json")) {
      cleanedContent = cleanedContent.slice(7)
    } else if (cleanedContent.startsWith("```")) {
      cleanedContent = cleanedContent.slice(3)
    }
    if (cleanedContent.endsWith("```")) {
      cleanedContent = cleanedContent.slice(0, -3)
    }
    cleanedContent = cleanedContent.trim()

    let parsed
    try {
      parsed = JSON.parse(cleanedContent)
    } catch (e) {
      console.warn("[v0] Failed to parse Art Director JSON response:", cleanedContent.substring(0, 200))
      const prefs = user_preferences as EnhancementPreferences | undefined
      return NextResponse.json({
        imagePrompt: getDefaultPromptForFilename(filename, prefs),
        debugNotes: "Invalid JSON from Gemini - using default prompt with user preferences",
      })
    }

    const validated = artDirectorSchema.parse(parsed)

    // CRITICAL: Always ensure user's custom instructions are included in the final prompt
    // Gemini might summarize or ignore them, so we append them explicitly
    const prefs = user_preferences as EnhancementPreferences | undefined
    let finalPrompt = validated.imagePrompt
    
    if (prefs?.additionalInstructions && prefs.additionalInstructions.trim()) {
      const userInstructions = prefs.additionalInstructions.trim()
      // Check if the user instructions are already substantially included
      const instructionsLower = userInstructions.toLowerCase()
      const promptLower = finalPrompt.toLowerCase()
      
      // Only append if the key terms from user instructions aren't already present
      const keyTerms = instructionsLower.split(/\s+/).filter(word => word.length > 4)
      const missingKeyTerms = keyTerms.filter(term => !promptLower.includes(term))
      
      if (missingKeyTerms.length > keyTerms.length * 0.5) {
        // More than half of key terms are missing - append the full instructions
        finalPrompt += `\n\nUSER SPECIAL INSTRUCTIONS (HIGHEST PRIORITY - MUST BE APPLIED): ${userInstructions}`
        console.log("[v0] Art Director: Appended user instructions (Gemini may have missed them)")
      } else {
        console.log("[v0] Art Director: User instructions appear to be incorporated by Gemini")
      }
    }

    console.log("[v0] Art Director output - imagePrompt length:", finalPrompt.length)

    return NextResponse.json({
      imagePrompt: finalPrompt,
      debugNotes: validated.debugNotes
    })
  } catch (error) {
    console.error("[v0] Art Director unexpected error:", error instanceof Error ? error.message : String(error))

    // Note: We don't have access to user_preferences here since the error may have occurred before parsing
    // But this is a rare edge case - most errors are caught above with proper preference handling
    return NextResponse.json({
      imagePrompt: getDefaultPromptForFilename("unknown"),
      debugNotes: "Art Director error - using default prompt",
    })
  }
}

function getDefaultPromptForFilename(filename: string, preferences?: EnhancementPreferences): string {
  const lowerName = (filename || "").toLowerCase()

  let basePrompt = ""
  if (
    lowerName.includes("pool") ||
    lowerName.includes("backyard") ||
    lowerName.includes("patio") ||
    lowerName.includes("exterior") ||
    lowerName.includes("outdoor") ||
    lowerName.includes("yard") ||
    lowerName.includes("deck")
  ) {
    basePrompt = "Ultra-realistic professional real estate photograph. Preserve EXACTLY: all architectural elements, pool shape and features (including any connected jacuzzi/spa), furniture positions (items in sun stay in sun, items under cover stay under cover), landscaping variety and maturity, driveway, and fence between properties. LAWN must appear LUSH, THICK, and VIBRANT GREEN. ALL painted surfaces must appear FRESHLY PAINTED and IMMACULATE. Enhance ONLY: lighting quality, color vibrancy, sharpness, and clarity. Do NOT add, remove, move, or redesign any elements. Professional real estate photography quality with bright, crisp natural lighting."
  } else if (
    lowerName.includes("kitchen") ||
    lowerName.includes("bedroom") ||
    lowerName.includes("living") ||
    lowerName.includes("bath") ||
    lowerName.includes("interior") ||
    lowerName.includes("room")
  ) {
    basePrompt = "Ultra-realistic professional real estate photograph. Preserve EXACTLY: all furniture pieces in their exact positions, all architectural details, wall colors, flooring materials, window views, and decorative elements. Enhance ONLY: lighting quality to be bright and welcoming, color accuracy, sharpness, and clarity. Do NOT add, remove, move, or redesign any elements. Professional real estate photography quality."
  } else {
    basePrompt = "Ultra-realistic professional photograph. Preserve ALL elements exactly as they appear - furniture positions, architectural features, landscaping, driveways, fences, and structural elements. LAWN must appear LUSH and GREEN. ALL paint must appear FRESH and IMMACULATE. Enhance ONLY: lighting quality, color vibrancy, sharpness, and clarity. Do NOT add, remove, move, or redesign any elements. Professional photography quality with bright, natural lighting."
  }

  // CRITICAL: If user provided special instructions, ALWAYS include them
  if (preferences?.additionalInstructions && preferences.additionalInstructions.trim()) {
    basePrompt += `\n\nUSER SPECIAL INSTRUCTIONS (MUST BE APPLIED): ${preferences.additionalInstructions.trim()}`
  }

  // Include sky replacement if specified
  if (preferences?.skyReplacement && preferences.skyReplacement !== "none") {
    const skyInstructions: Record<string, string> = {
      clear_blue: "Replace the sky with a CLEAR, VIBRANT BLUE sky with minimal clouds.",
      dramatic_clouds: "Replace the sky with DRAMATIC, PUFFY WHITE CLOUDS against a rich blue sky.",
      golden_hour: "Replace the sky with GOLDEN HOUR lighting - warm orange and golden tones.",
      twilight: "Replace the sky with a TWILIGHT/DUSK sky - deep blue with warm horizon glow.",
    }
    if (skyInstructions[preferences.skyReplacement]) {
      basePrompt += `\n\nSKY REPLACEMENT: ${skyInstructions[preferences.skyReplacement]}`
    }
  }

  // Include virtual twilight if enabled
  if (preferences?.virtualTwilight) {
    basePrompt += "\n\nVIRTUAL TWILIGHT: Transform this to a twilight/dusk scene with interior lights glowing warmly through windows, deep blue sky at dusk."
  }

  // Include reference image description if provided
  if (preferences?.referenceImageDescription && preferences.referenceImageDescription.trim()) {
    basePrompt += `\n\nREFERENCE STYLE (match this aesthetic): ${preferences.referenceImageDescription.trim()}`
  }

  return basePrompt
}
