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

export type TokenTransactionType =
  | "purchase"
  | "signup_bonus"
  | "plan_grant"
  | "topup"
  | "revision"
  | "upscale"
  | "refund"
  | "admin_grant"
  | "admin_deduct"
  | "upload"
  | "transform"
  | "save_variation"
  | "download_hires"
