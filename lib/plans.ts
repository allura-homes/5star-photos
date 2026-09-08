export type PlanId = "free" | "startup" | "pro" | "max"
export type PaidPlanId = Exclude<PlanId, "free">
export type BillingInterval = "month" | "year"

export interface Plan {
  id: PlanId
  name: string
  tagline: string
  monthlyPriceCents: number
  annualPriceCents: number
  monthlyCredits: number
  models: readonly string[]
  allModels: boolean
  highlights: readonly string[]
}

export const WELCOME_CREDITS = 45

export const CREDIT_COSTS = {
  upload: 1,
  transform: 10,
  save_variation: 1,
  download_hires: 3,
  upscale: 2,
} as const

export type CreditAction = keyof typeof CREDIT_COSTS

// The two approved models every plan gets (V1 + V2). Pro and Max unlock every
// active model in lib/constants/models.ts.
export const BASE_MODELS = ["openai", "nano_banana_pro"] as const

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    tagline: "Try it on three real photos",
    monthlyPriceCents: 0,
    annualPriceCents: 0,
    monthlyCredits: 0,
    models: BASE_MODELS,
    allModels: false,
    highlights: [
      `${WELCOME_CREDITS} welcome credits, one time`,
      "Enough for 3 photos with hi-res downloads",
      "2 AI models per transform",
    ],
  },
  startup: {
    id: "startup",
    name: "Start-up",
    tagline: "For agents listing a few homes a month",
    monthlyPriceCents: 1900,
    annualPriceCents: 19000,
    monthlyCredits: 100,
    models: BASE_MODELS,
    allModels: false,
    highlights: ["V1 and V2 models on every transform", "Buy top-up packs anytime", "Cancel or change plans anytime"],
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "For busy agents and small teams",
    monthlyPriceCents: 4900,
    annualPriceCents: 49000,
    monthlyCredits: 270,
    models: [],
    allModels: true,
    highlights: [
      "Every AI model, side by side",
      "More candidates per photo, better picks",
      "Buy top-up packs anytime",
      "Best value for most agents",
    ],
  },
  max: {
    id: "max",
    name: "Max",
    tagline: "For brokerages and photographers",
    monthlyPriceCents: 9900,
    annualPriceCents: 99000,
    monthlyCredits: 570,
    models: [],
    allModels: true,
    highlights: ["Every AI model, side by side", "Lowest cost per credit", "Buy top-up packs anytime", "Built for whole listings at once"],
  },
}

export const PAID_PLAN_IDS: readonly PaidPlanId[] = ["startup", "pro", "max"]

const PLAN_RANK: Record<PlanId, number> = { free: 0, startup: 1, pro: 2, max: 3 }

export interface TopupPack {
  id: string
  credits: number
  priceCents: number
}

// Priced above every plan's per-credit rate so upgrading is always the better deal.
export const TOPUP_PACKS: readonly TopupPack[] = [
  { id: "topup_50", credits: 50, priceCents: 1200 },
  { id: "topup_150", credits: 150, priceCents: 3200 },
  { id: "topup_300", credits: 300, priceCents: 6000 },
]

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && value in PLANS
}

export function isPaidPlanId(value: unknown): value is PaidPlanId {
  return isPlanId(value) && value !== "free"
}

export function isBillingInterval(value: unknown): value is BillingInterval {
  return value === "month" || value === "year"
}

export function isSubscribed(plan: PlanId): plan is PaidPlanId {
  return plan !== "free"
}

export function getTopupPack(id: string): TopupPack | undefined {
  return TOPUP_PACKS.find((pack) => pack.id === id)
}

export function planAllowsModel(plan: PlanId, modelProvider: string): boolean {
  const config = PLANS[plan]
  return config.allModels || config.models.includes(modelProvider)
}

export function comparePlans(a: PlanId, b: PlanId): number {
  return PLAN_RANK[a] - PLAN_RANK[b]
}

export function nextPlanUp(plan: PlanId): PaidPlanId | null {
  if (plan === "free") return "startup"
  if (plan === "startup") return "pro"
  if (plan === "pro") return "max"
  return null
}

export function planPriceCents(plan: PaidPlanId, interval: BillingInterval): number {
  return interval === "year" ? PLANS[plan].annualPriceCents : PLANS[plan].monthlyPriceCents
}

/** Credits needed to take one photo from upload to a hi-res download. */
export const PHOTO_COST = CREDIT_COSTS.upload + CREDIT_COSTS.transform + CREDIT_COSTS.download_hires

export function photosFromCredits(credits: number): number {
  return Math.floor(credits / PHOTO_COST)
}

export function formatPrice(cents: number): string {
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`
}

// Stripe lookup keys let the setup script and the app agree on a Price without
// storing generated IDs anywhere.
export function planLookupKey(plan: PaidPlanId, interval: BillingInterval): string {
  return `5star_${plan}_${interval}`
}

export function topupLookupKey(packId: string): string {
  return `5star_${packId}`
}
