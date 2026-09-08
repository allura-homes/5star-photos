import type { ModelProvider } from "@/lib/types"

/**
 * Single source of truth for how image models are shown to people.
 *
 * Users never see provider names; they see "V1", "V2", "V3" with a short
 * plain-language description. Keep this in sync with plan access rules.
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
    provider: "openai_1_5",
    label: "V1",
    description: "OpenAI's earlier image model. Balanced, faithful room enhancements.",
    active: true,
    modelId: "gpt-image-1.5",
  },
  {
    provider: "openai_2",
    label: "V2",
    description: "OpenAI's newest image model for the sharpest detail and finish.",
    active: true,
    modelId: "gpt-image-2",
  },
  {
    provider: "nano_banana_pro",
    label: "V3",
    description: "Google's latest image model. Strong on light, color and composition.",
    active: true,
    modelId: "gemini-3-pro-image",
  },
  {
    provider: "flux_2_pro",
    label: "V4",
    description: "Reserved for a future model or legacy comparison.",
    active: false,
    modelId: "flux-2-pro (fal.ai)",
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
