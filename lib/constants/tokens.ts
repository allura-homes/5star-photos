// Legacy token constants. Credits are the current model; the source of truth
// for costs and plans is lib/plans.ts. This file re-exports for older readers.

import { CREDIT_COSTS } from "@/lib/plans"

/**
 * Billing is always on. Kept so old call sites compile; remove with them.
 * (Previously read NEXT_PUBLIC_TOKENS_ENFORCED during the free beta.)
 */
export const TOKENS_ENFORCED = true

export const TOKEN_COSTS = {
  upload: CREDIT_COSTS.upload,
  transform: CREDIT_COSTS.transform,
  save_variation: CREDIT_COSTS.save_variation,
  download_hires: CREDIT_COSTS.download_hires,
  upscale: CREDIT_COSTS.upscale,
  // Legacy alias (re-run a transform); same price as a transform.
  revision: CREDIT_COSTS.transform,
} as const

// Mirrors the token_transactions.type CHECK constraint (scripts/021_bonus_credits.sql).
export type TokenTransactionType =
  | "purchase"
  | "revision"
  | "upscale"
  | "bonus"
  | "refund"
  | "upload"
  | "transform"
  | "save_variation"
  | "download_hires"
  | "welcome_grant"
  | "plan_grant"
  | "period_reset"
  | "topup_purchase"
  | "admin_adjust"
  | "bonus_grant"
