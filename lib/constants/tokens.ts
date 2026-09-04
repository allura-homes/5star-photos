// Token costs for various operations
// This is a shared constants file (NOT a server action)

/**
 * Master switch for token enforcement.
 *
 * While `false` (the default during the free beta) every operation is free:
 * no balance checks run and no tokens are deducted, though a 0-amount
 * transaction is still logged so usage history stays complete.
 *
 * To turn billing on, set `NEXT_PUBLIC_TOKENS_ENFORCED=true` in the Vercel
 * project environment and redeploy. The variable is public so the UI can
 * hide/show the beta banner and token costs consistently with the server.
 */
export const TOKENS_ENFORCED = process.env.NEXT_PUBLIC_TOKENS_ENFORCED === "true"

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
