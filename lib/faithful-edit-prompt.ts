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

export function buildFaithfulEditPrompt(instructions: string): string {
  return `${PROPERTY_PRESERVATION_RULES}\n\nREQUESTED PHOTO ADJUSTMENTS (subject to the preservation rules):\n${instructions.trim() || "Improve exposure, neutral white balance, and detail only."}\n\nFINAL CHECK: Same photograph, same ground coverage, same painted finishes, same architecture. Prefer a subtle edit over an invented improvement.`
}
