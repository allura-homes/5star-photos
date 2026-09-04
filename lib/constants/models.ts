import type { ModelProvider } from "@/lib/types"

/**
 * Single source of truth for how image models are shown to people.
 *
 * Users never see provider names; they see "V1", "V2", "V4" with a short
 * plain-language description. Keep this in sync with MODEL_CONFIGURATION.md
 * and the MODEL_CONFIG list in app/transform/[imageId]/page.tsx.
 */
export interface ModelInfo {
  provider: ModelProvider
  /** Short label shown on variation cards. */
  label: string
  /** One-line description for Help / tooltips. */
  description: string
  /** Whether the model currently runs in the transform pipeline. */
  active: boolean
  /** Underlying model id (admin-only surfaces). */
  modelId: string
}

export const MODELS: ModelInfo[] = [
  {
    provider: "openai",
    label: "V1",
    description: "Balanced enhancement. Keeps the room faithful while fixing light, color and clutter.",
    active: true,
    modelId: "gpt-image-1",
  },
  {
    provider: "nano_banana_pro",
    label: "V2",
    description: "Bolder, brighter look. Strong on skies, lawns and warm interiors.",
    active: true,
    modelId: "gemini-3-pro-image-preview",
  },
  {
    provider: "flux_2_pro",
    label: "V3",
    description: "Retired. Previously used for stylised results.",
    active: false,
    modelId: "flux-2-pro (fal.ai)",
  },
  {
    provider: "openai_2",
    label: "V4",
    description: "Newest OpenAI model. Sharpest detail when it is available.",
    active: true,
    modelId: "gpt-image-2",
  },
  {
    provider: "openai_1_5",
    label: "V1.5",
    description: "Retired.",
    active: false,
    modelId: "gpt-image-1.5",
  },
  {
    provider: "openai_mini",
    label: "Mini",
    description: "Retired low-cost draft model.",
    active: false,
    modelId: "gpt-image-1-mini",
  },
]

export const ACTIVE_MODELS = MODELS.filter((m) => m.active)

export const MODEL_LABELS: Record<ModelProvider, string> = Object.fromEntries(
  MODELS.map((m) => [m.provider, m.label]),
) as Record<ModelProvider, string>

export function modelLabel(provider: ModelProvider | string | null | undefined): string {
  if (!provider) return "Original"
  return MODEL_LABELS[provider as ModelProvider] ?? String(provider)
}
