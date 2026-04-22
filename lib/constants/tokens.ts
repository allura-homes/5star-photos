// Token costs for various operations
// This is a shared constants file (NOT a server action)

export const TOKEN_COSTS = {
  upload: 1, // Upload an original image
  transform: 1, // Re-run transformation (first transform is free)
  save_variation: 1, // Save a variation as new base image
  download_hires: 4, // Download high-res non-watermarked version

  // Legacy costs (keeping for backward compatibility)
  revision: 1,
  upscale: 2,
} as const

export type TokenTransactionType =
  | "purchase"
  | "signup_bonus"
  | "revision"
  | "upscale"
  | "refund"
  | "admin_grant"
  | "admin_deduct"
  | "upload"
  | "transform"
  | "save_variation"
  | "download_hires"
