"use server"

import { createClient } from "@/lib/supabase/server"
import { TOKEN_COSTS } from "@/lib/constants/tokens"

/**
 * Token System Actions
 *
 * Handles token transactions for:
 * - Uploads (1 token per original image)
 * - Transforms (1 token per re-transformation, first is free)
 * - Save Variation (1 token to save a variation as base image)
 * - Download Hi-Res (4 tokens per non-watermarked download)
 * - Purchases (adding tokens to account)
 * - Admin grants/deductions
 */

type TransactionType =
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

async function getCurrentUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

async function getUserProfile(userId: string) {
  const supabase = await createClient()
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single()
  return profile
}

/**
 * Check if user has enough tokens for an action
 */
export async function checkTokenBalance(requiredTokens: number) {
  const user = await getCurrentUser()
  if (!user) {
    return { hasBalance: false, balance: 0, error: "Not authenticated" }
  }

  const profile = await getUserProfile(user.id)
  if (!profile) {
    return { hasBalance: false, balance: 0, error: "Profile not found" }
  }

  return {
    hasBalance: profile.tokens >= requiredTokens,
    balance: profile.tokens,
    error: null,
  }
}

/**
 * Deduct tokens for uploading an original image
 */
export async function deductTokensForUpload(imageId: string, fileName: string) {
  const supabase = await createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { success: false, error: "Not authenticated" }
  }

  const profile = await getUserProfile(user.id)
  if (!profile) {
    return { success: false, error: "Profile not found" }
  }

  const cost = TOKEN_COSTS.upload
  if (profile.tokens < cost) {
    return { success: false, error: `Insufficient tokens. You need ${cost} token to upload.` }
  }

  const newBalance = profile.tokens - cost

  const { error: updateError } = await supabase.from("profiles").update({ tokens: newBalance }).eq("id", user.id)

  if (updateError) {
    console.error("[v0] Token update error:", updateError)
    return { success: false, error: "Failed to update token balance" }
  }

  const { error: txError } = await supabase.from("token_transactions").insert({
    user_id: user.id,
    type: "upload" as TransactionType,
    amount: -cost,
    description: `Uploaded ${fileName}`,
    image_id: imageId,
    file_name: fileName,
  })

  if (txError) {
    console.error("[v0] Transaction record error:", txError)
  }

  return { success: true, newBalance }
}

/**
 * Deduct tokens for re-transforming an image
 */
export async function deductTokensForTransform(imageId: string, fileName: string, isFirstTransform: boolean) {
  const supabase = await createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { success: false, error: "Not authenticated" }
  }

  const profile = await getUserProfile(user.id)
  if (!profile) {
    return { success: false, error: "Profile not found" }
  }

  // First transform is free
  if (isFirstTransform) {
    // Just record the transaction with 0 cost
    await supabase.from("token_transactions").insert({
      user_id: user.id,
      type: "transform" as TransactionType,
      amount: 0,
      description: `Initial transform of ${fileName}`,
      image_id: imageId,
      file_name: fileName,
    })
    return { success: true, newBalance: profile.tokens }
  }

  const cost = TOKEN_COSTS.transform
  if (profile.tokens < cost) {
    return { success: false, error: `Insufficient tokens. You need ${cost} token to re-transform.` }
  }

  const newBalance = profile.tokens - cost

  const { error: updateError } = await supabase.from("profiles").update({ tokens: newBalance }).eq("id", user.id)

  if (updateError) {
    console.error("[v0] Token update error:", updateError)
    return { success: false, error: "Failed to update token balance" }
  }

  await supabase.from("token_transactions").insert({
    user_id: user.id,
    type: "transform" as TransactionType,
    amount: -cost,
    description: `Re-transformed ${fileName}`,
    image_id: imageId,
    file_name: fileName,
  })

  return { success: true, newBalance }
}

/**
 * Deduct tokens for saving a variation as a new base image
 */
export async function deductTokensForSaveVariation(imageId: string, fileName: string, sourceModel: string) {
  const supabase = await createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { success: false, error: "Not authenticated" }
  }

  const profile = await getUserProfile(user.id)
  if (!profile) {
    return { success: false, error: "Profile not found" }
  }

  const cost = TOKEN_COSTS.save_variation
  if (profile.tokens < cost) {
    return { success: false, error: `Insufficient tokens. You need ${cost} token to save variation.` }
  }

  const newBalance = profile.tokens - cost

  const { error: updateError } = await supabase.from("profiles").update({ tokens: newBalance }).eq("id", user.id)

  if (updateError) {
    console.error("[v0] Token update error:", updateError)
    return { success: false, error: "Failed to update token balance" }
  }

  await supabase.from("token_transactions").insert({
    user_id: user.id,
    type: "save_variation" as TransactionType,
    amount: -cost,
    description: `Saved ${sourceModel} variation of ${fileName}`,
    image_id: imageId,
    file_name: fileName,
  })

  return { success: true, newBalance }
}

/**
 * Deduct tokens for downloading hi-res non-watermarked image
 */
export async function deductTokensForDownload(imageId: string, fileName: string) {
  const supabase = await createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { success: false, error: "Not authenticated" }
  }

  const profile = await getUserProfile(user.id)
  if (!profile) {
    return { success: false, error: "Profile not found" }
  }

  const cost = TOKEN_COSTS.download_hires
  if (profile.tokens < cost) {
    return { success: false, error: `Insufficient tokens. You need ${cost} tokens to download hi-res.` }
  }

  const newBalance = profile.tokens - cost

  const { error: updateError } = await supabase.from("profiles").update({ tokens: newBalance }).eq("id", user.id)

  if (updateError) {
    console.error("[v0] Token update error:", updateError)
    return { success: false, error: "Failed to update token balance" }
  }

  await supabase.from("token_transactions").insert({
    user_id: user.id,
    type: "download_hires" as TransactionType,
    amount: -cost,
    description: `Downloaded hi-res ${fileName}`,
    image_id: imageId,
    file_name: fileName,
  })

  return { success: true, newBalance }
}

/**
 * Deduct tokens for a revision request
 */
export async function deductTokensForRevision(jobId: string, fileName: string) {
  const supabase = await createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { success: false, error: "Not authenticated" }
  }

  const profile = await getUserProfile(user.id)
  if (!profile) {
    return { success: false, error: "Profile not found" }
  }

  if (profile.role === "viewer") {
    return { success: false, error: "Upgrade to a paid account to request revisions" }
  }

  const cost = TOKEN_COSTS.revision
  if (profile.tokens < cost) {
    return { success: false, error: `Insufficient tokens. You need ${cost} token(s) for a revision.` }
  }

  const newBalance = profile.tokens - cost

  const { error: updateError } = await supabase.from("profiles").update({ tokens: newBalance }).eq("id", user.id)

  if (updateError) {
    console.error("[v0] Token update error:", updateError)
    return { success: false, error: "Failed to update token balance" }
  }

  const { error: txError } = await supabase.from("token_transactions").insert({
    user_id: user.id,
    type: "revision" as TransactionType,
    amount: -cost,
    description: `Revision request for ${fileName}`,
    job_id: jobId,
    file_name: fileName,
  })

  if (txError) {
    console.error("[v0] Transaction record error:", txError)
  }

  return { success: true, newBalance }
}

/**
 * Deduct tokens for an upscale/download request
 */
export async function deductTokensForUpscale(jobId: string, fileName: string) {
  const supabase = await createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { success: false, error: "Not authenticated" }
  }

  const profile = await getUserProfile(user.id)
  if (!profile) {
    return { success: false, error: "Profile not found" }
  }

  if (profile.role === "viewer") {
    return { success: false, error: "Upgrade to a paid account to download high-quality images" }
  }

  const cost = TOKEN_COSTS.upscale
  if (profile.tokens < cost) {
    return { success: false, error: `Insufficient tokens. You need ${cost} tokens for a high-quality download.` }
  }

  const newBalance = profile.tokens - cost

  const { error: updateError } = await supabase.from("profiles").update({ tokens: newBalance }).eq("id", user.id)

  if (updateError) {
    console.error("[v0] Token update error:", updateError)
    return { success: false, error: "Failed to update token balance" }
  }

  const { error: txError } = await supabase.from("token_transactions").insert({
    user_id: user.id,
    type: "upscale" as TransactionType,
    amount: -cost,
    description: `High-quality download for ${fileName}`,
    job_id: jobId,
    file_name: fileName,
  })

  if (txError) {
    console.error("[v0] Transaction record error:", txError)
  }

  return { success: true, newBalance }
}

/**
 * Add tokens to a user's account (for purchases)
 */
export async function addTokens(
  userId: string,
  amount: number,
  type: "purchase" | "signup_bonus" | "refund" | "admin_grant",
  description?: string,
  adminId?: string,
) {
  const supabase = await createClient()

  if (type === "admin_grant") {
    const caller = await getCurrentUser()
    if (!caller) {
      return { success: false, error: "Not authenticated" }
    }
    const callerProfile = await getUserProfile(caller.id)
    if (!callerProfile || callerProfile.role !== "admin") {
      return { success: false, error: "Admin access required" }
    }
  }

  const profile = await getUserProfile(userId)
  if (!profile) {
    return { success: false, error: "User not found" }
  }

  const newBalance = profile.tokens + amount

  const { error: updateError } = await supabase.from("profiles").update({ tokens: newBalance }).eq("id", userId)

  if (updateError) {
    console.error("[v0] Token update error:", updateError)
    return { success: false, error: "Failed to update token balance" }
  }

  const { error: txError } = await supabase.from("token_transactions").insert({
    user_id: userId,
    type,
    amount,
    description: description || `${type}: ${amount} tokens`,
    created_by: adminId,
  })

  if (txError) {
    console.error("[v0] Transaction record error:", txError)
  }

  return { success: true, newBalance }
}

/**
 * Get token transaction history for current user
 */
export async function getTokenHistory(limit = 20) {
  const supabase = await createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { transactions: [], error: "Not authenticated" }
  }

  const { data: transactions, error } = await supabase
    .from("token_transactions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("[v0] Token history fetch error:", error)
    return { transactions: [], error: "Failed to fetch history" }
  }

  return { transactions }
}

/**
 * Upgrade user from viewer to user role
 */
export async function upgradeToUser(userId: string, initialTokens = 10) {
  const supabase = await createClient()

  const caller = await getCurrentUser()
  if (!caller) {
    return { success: false, error: "Not authenticated" }
  }
  const callerProfile = await getUserProfile(caller.id)
  if (!callerProfile || callerProfile.role !== "admin") {
    return { success: false, error: "Admin access required" }
  }

  const profile = await getUserProfile(userId)
  if (!profile) {
    return { success: false, error: "User not found" }
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      role: "user",
      tokens: profile.tokens + initialTokens,
    })
    .eq("id", userId)

  if (updateError) {
    console.error("[v0] Upgrade error:", updateError)
    return { success: false, error: "Failed to upgrade user" }
  }

  await supabase.from("token_transactions").insert({
    user_id: userId,
    type: "signup_bonus" as TransactionType,
    amount: initialTokens,
    description: "Upgrade bonus tokens",
    created_by: caller.id,
  })

  return { success: true }
}
