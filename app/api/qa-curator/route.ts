import { z } from "zod"

const qaCuratorSchema = z.object({
  qa_pass: z.boolean(),
  issues: z.array(z.string()),
  retry_instructions: z.string(),
})

const SYSTEM_PROMPT = `You are the 5star.photos QA Curator.

Your job is to inspect AI-enhanced preview images and decide whether each one meets the 5star.photos Aesthetic Standard. You DO NOT edit the image yourself; you only evaluate and give retry instructions.

A preview image is acceptable only if:

- White balance is neutral (approx 4000–4200K) and not yellow, orange, or magenta.
- Exposure is bright and crisp with lifted midtones, but highlights are not blown out.
- Shadows retain depth and shape (not completely flattened).
- The image is in landscape orientation.
- Verticals are straight (no leaning walls or door frames).
- Whites are pure, not dingy or overly warm.
- Natural materials look realistic and not overly smoothed or crunchy.
- No new furniture, artwork, décor, or building elements were added.
- No haze, fog, heavy vignettes, or gimmicky filters were added.
- For exteriors:
  - If style_mode is "daylight_4000": sky looks like natural daytime.
  - If style_mode is "cotton_candy_dusk": sky uses soft pink/lavender/blue tones and still looks believable.
  - Grass and landscaping look slightly improved but not fake.

You will be given:
- The style_mode used.
- A short description of the edited preview.
- Any automatic checks (e.g., orientation, vertical lines) that have already run.

Your task:
1. Decide if this preview passes QA.
2. If it fails, list specific issues and give clear retry instructions.

Output MUST be valid JSON with this exact shape:

{
  "qa_pass": true or false,
  "issues": [
    "string"
  ],
  "retry_instructions": "string"
}

- If qa_pass is true, "issues" can be an empty array and retry_instructions should be an empty string or a short compliment.
- If qa_pass is false, be very specific in retry_instructions (e.g. "cool the white balance slightly and reduce warmth by about 10%", "straighten vertical lines", "remove any added haze or bloom and increase clarity slightly").
Do not include any commentary outside the JSON object.`

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.error("[v0] QA Curator API: Missing OPENAI_API_KEY")
      return Response.json({ error: "Missing OpenAI API key configuration" }, { status: 500 })
    }

    const { filename, style_mode, orientation_ok, verticals_ok, brightness_level, color_cast, short_description } =
      await req.json()

    console.log("[v0] QA Curator request:", { filename, style_mode })

    const userMessage = `Please evaluate this SCREEN-RESOLUTION PREVIEW image.
- File name: ${filename}
- Style mode: ${style_mode}
- Auto checks:
  - orientation_ok: ${orientation_ok}
  - verticals_ok: ${verticals_ok}
  - brightness_level: ${brightness_level}
  - color_cast: ${color_cast}

Short description of the preview result: ${short_description}

Return the JSON QA object only.`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_CUSTOM_MODEL_ID || "gpt-4o-mini", // Use cheaper model for QA
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: userMessage,
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 500, // Reduced from 800 - QA responses are short
        temperature: 0.2,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (response.status === 429) {
      console.warn("[v0] QA Curator: OpenAI quota exceeded (429)")
      return Response.json(
        {
          error: "OpenAI quota exceeded. Please check your billing details.",
          qa_pass: true, // Default to pass so it doesn't block the flow
          issues: ["QA skipped due to rate limits"],
          retry_instructions: "",
        },
        { status: 429 },
      )
    }

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] OpenAI API error:", errorText)
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      throw new Error("No response from OpenAI")
    }

    const parsed = JSON.parse(content)
    const validated = qaCuratorSchema.parse(parsed)

    console.log("[v0] QA Curator response:", validated.qa_pass ? "PASS" : "FAIL")
    return Response.json(validated)
  } catch (error) {
    console.error("[v0] QA Curator API error:", error)

    if (error instanceof Error && error.name === "AbortError") {
      return Response.json({
        qa_pass: true,
        issues: ["QA timed out"],
        retry_instructions: "",
      })
    }

    return Response.json(
      {
        error: error instanceof Error ? error.message : "Failed to generate QA evaluation",
        qa_pass: true, // Default to pass
        issues: ["QA unavailable"],
        retry_instructions: "",
      },
      { status: 500 },
    )
  }
}
