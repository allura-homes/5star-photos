export const PROPERTY_PRESERVATION_RULES = `PROPERTY FIDELITY IS MORE IMPORTANT THAN BEAUTIFICATION.
Edit the supplied photograph; do not render a new view of this property.
- Preserve the camera position, viewing angle, crop, field of view, and aspect ratio. Do not reveal a new side of the building or invent content outside the frame.
- Preserve every ground region and its exact boundary: bare soil stays bare soil, mulch stays mulch, gravel stays gravel, and paving stays paving. Never add, extend, or fill in grass, turf, plants, or planting beds. Existing vegetation may receive modest color correction only, without changing its coverage, shape, density, or size.
- Preserve each surface's material, paint color, stain, finish, and texture independently. White painted stair rails must remain white painted rails; wood stair treads must remain the same wood tone. Never strip paint to expose raw wood, repaint rails, replace solid porch walls with balusters, or redesign stairs, siding, lattice, fences, or roofs.
- Preserve the exact number, size, and positions of windows, doors, posts, stairs, and other permanent structures.
- Improve exposure, white balance, clarity, and noise without changing the property. Lighting changes must not masquerade as a different paint color or material.
- Add movable staging props only when explicitly requested by the user. Prohibitions such as "do NOT add" and generic enhancement language are not staging requests.
- Sky and lighting styling may change when requested, but never the geometry or materials below the sky.
If a stylistic request conflicts with these rules, preserve the original property instead.`

export const FULL_SUN_MARKER = "FULL SUN — EXTERIOR DAYLIGHT RELIGHTING"

export const FULL_SUN_INSTRUCTIONS = `${FULL_SUN_MARKER}
For an exterior photograph, transform the WHOLE visible scene into a bright, inviting, professionally photographed clear day around solar noon. This is a lighting transformation, not just cloud removal or a blue-sky swap. Apply it even when little or no sky is visible. For an interior photograph, skip this exterior treatment.
- Replace visible overcast sky with a natural clear blue daytime sky, preserving rooflines, fine branches, and all foreground edges. Do not invent sky where none is visible.
- Relight the existing building, ground, and vegetation together with one coherent high-angle sun direction. Respect surface orientation and occlusion; retain believable short cast shadows, contact shadows, texture, and depth. Adjust existing incompatible shadows rather than adding a second shadow direction.
- Simulate large OFF-CAMERA neutral-white bounce boards and fill cards lifting shaded facades, covered porches, entryways, and foliage. These are lighting effects only: never render boards, cards, lights, stands, or crew. Aim for even exposure with dimensional sunlight, not flat ambient light or harsh black noon shadows. Covered areas receive indirect fill, not impossible direct sun through solid roofs.
- Lift drab midtones and recover low-light detail while protecting bright siding, clouds, paving, and reflective surfaces from clipping. Keep natural local contrast; avoid HDR halos, gray lifted blacks, crunchy sharpening, plastic textures, and invented detail in unrecoverable shadows.
- Create a gently warm, fresh daylight impression with neutral whites and accurate paint, wood, brick, and foliage colors. Use daylight-balanced fill; do not apply an orange/yellow filter, sunset coloring, or golden-hour lighting. Warmth comes from believable illumination, not recoloring materials.
- Match existing glass and water reflections to the daytime illumination without inventing reflected objects. Windows must have natural daytime reflections or plausible unlit interiors, not artificial glowing interiors. Convert the source lighting to noon even if the original was dusk, night, or underexposed.
- Preserve the exact property, viewpoint, crop, architecture, material finishes, landscaping coverage, and every bare ground patch. Do not add plants, grass, furnishings, or fixtures. A clearly visible lighting improvement is wanted; a redesigned property is not.
This selected Full Sun target overrides conflicting source-time descriptions and generic instructions to keep existing dim lighting, but NEVER overrides property-preservation rules.`

export function applyFullSunLighting(instructions: string, skyReplacement: unknown): string {
  // Keep the existing preference key so saved Clear Blue selections remain compatible.
  if (skyReplacement !== "clear_blue" || instructions.includes(FULL_SUN_INSTRUCTIONS)) return instructions
  return `${instructions}\n\n${FULL_SUN_INSTRUCTIONS}`
}

export function getWindowLightingGuidance(instructions: string): string {
  // Source-time descriptions and negated night instructions must not override Full Sun.
  const fullSun = instructions.includes(FULL_SUN_MARKER)
  const isDuskOrNightScene = !fullSun && /twilight|dusk|night|evening|blue hour/i.test(instructions)
  return isDuskOrNightScene
    ? "Windows should glow with warm, inviting interior light appropriate for this dusk/night scene."
    : "This is a DAYTIME photo. Windows must show natural daylight and realistic outdoor reflections - do NOT add interior lighting glow, illuminated lamps, or any warm light behind the glass. A daytime photo with glowing windows looks fake."
}

export function buildFaithfulEditPrompt(instructions: string): string {
  return `${PROPERTY_PRESERVATION_RULES}\n\nREQUESTED PHOTO ADJUSTMENTS (subject to the preservation rules):\n${instructions.trim() || "Improve exposure, neutral white balance, and detail only."}\n\nFINAL CHECK: Same photograph, same ground coverage, same painted finishes, same architecture. Prefer a subtle edit over an invented improvement.`
}
