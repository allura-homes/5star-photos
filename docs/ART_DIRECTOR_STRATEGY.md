# Art Director Strategy & Prompt Engineering Guide

This document defines the core principles and strategies for the Art Director AI system that generates enhancement prompts for real estate photos.

## The Golden Rule

> **ONLY DESCRIBE WHAT YOU ACTUALLY SEE IN THE IMAGE**

This is the most critical rule. Mentioning elements that don't exist in the photo will cause the image generation models to ADD those elements, creating hallucinations.

### Why This Matters

Image generation models are highly literal. When a prompt says "enhance the pool water clarity," the model will:
1. Look for a pool in the image
2. If no pool exists, CREATE one to fulfill the instruction

This caused early versions to add pools, hot tubs, and furniture to photos that never had them.

---

## Conditional Enhancement Pattern

Every enhancement instruction must be conditional - only apply if the element exists.

### Bad Pattern (Prescriptive)
\`\`\`
Enhance the pool water to crystal clear turquoise.
Make the lawn lush and green.
Clean up the driveway.
\`\`\`

This assumes pools, lawns, and driveways exist. If they don't, models may add them.

### Good Pattern (Conditional)
\`\`\`
[Only if visible] If there is a pool, maintain its exact shape and enhance water clarity.
[Only if visible] If there is a lawn, fill in any bare patches with matching grass.
[Only if visible] If there is a driveway, preserve its exact location and material.
\`\`\`

---

## Element Categories

### MUST PRESERVE (Never Remove or Relocate)
These structural elements define the property and must never be altered:

- **Driveways** - Exact location, material, and boundaries
- **Fences** - Property boundaries between neighbors
- **Walkways** - Paths, steps, and sidewalks
- **Building structures** - The home itself, garages, sheds
- **Neighbor homes** - Visible structures behind fences
- **Property boundaries** - Where the property ends

### ENHANCE ONLY IF PRESENT
These can be improved but never added:

- **Pools/Spas** - Improve water clarity, NOT add new water features
- **Lawns** - Fill bare patches, NOT add lawns where none exist
- **Landscaping** - Enhance existing plants, NOT add new gardens
- **Outdoor furniture** - Clean up existing, NEVER add new furniture

### ALWAYS IMPROVE (When Visible)
These enhancements are safe when the element exists:

- **Sky** - Clear blue, remove overcast (but keep natural)
- **Lighting** - Golden hour warmth, even exposure
- **Paint condition** - Fix chips/peeling on existing painted surfaces
- **Grass health** - Make existing grass lusher and greener

---

## Photorealism Requirements

Real estate photos must look REAL, not AI-generated.

### Avoid
- Over-saturated colors (especially greens and blues)
- HDR-style processing with unnatural contrast
- Cartoonish or plastic-looking textures
- Unnaturally perfect skies
- Colors that don't match the original palette

### Target
- Professional real estate photography look
- Natural color grading
- Subtle enhancements that could be achieved in Lightroom
- Authentic textures and materials
- Sky that looks like the same day/time as original

---

## Background Preservation

A common failure mode is replacing background elements with trees/sky.

### Problem
Models sometimes "clean up" backgrounds by removing neighbor homes visible behind fences, replacing them with generic trees or sky.

### Solution
The Art Director must explicitly describe background elements:
\`\`\`
Preserve the [color] neighbor home visible behind the wooden fence on the [left/right] side.
\`\`\`

---

## Anti-Hallucination Checklist

Before finalizing a prompt, verify:

- [ ] No element is mentioned that isn't visible in the photo
- [ ] All enhancement instructions are conditional ("if present")
- [ ] Background structures are explicitly described for preservation
- [ ] No furniture, vehicles, or features are being added
- [ ] Colors match the original palette
- [ ] Structural elements (driveways, fences) are marked as sacred

---

## Prompt Structure Template

\`\`\`
## SCENE DESCRIPTION
[Describe exactly what's in the photo - interior/exterior, room type, key features]

## PRESERVE EXACTLY
[List all structural elements that must not change]
- [Element 1]
- [Element 2]

## ENHANCE (ONLY IF VISIBLE)
[Conditional improvements for elements that exist]
- [If X is present]: [Enhancement instruction]
- [If Y is present]: [Enhancement instruction]

## DO NOT
[Explicit list of forbidden actions]
- Do NOT add [element not in photo]
- Do NOT remove [element that exists]
- Do NOT change [colors/structural elements]

## PHOTOREALISM REMINDER
Maintain natural, professional real estate photography look. Avoid over-saturation.
\`\`\`

---

## Version History

- **2025-12-03**: Initial documentation
  - Established Golden Rule: Only describe what you see
  - Defined conditional enhancement pattern
  - Added anti-hallucination checklist
  - Documented photorealism requirements
  - Added background preservation rules
