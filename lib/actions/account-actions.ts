"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

/**
 * Account-level server actions. Every query is scoped to the verified
 * session user; the client never supplies a user id.
 */

export interface AccountSummary {
  id: string
  email: string
  display_name: string | null
  role: string
  tokens: number
  created_at: string
  image_count: number
  saved_variation_count: number
}

export async function getAccountSummary(): Promise<{ account: AccountSummary | null; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { account: null, error: "Not authenticated" }

  const [{ data: profile }, { count: imageCount }, { count: variationCount }] = await Promise.all([
    supabase.from("profiles").select("id, email, display_name, role, tokens, created_at").eq("id", user.id).single(),
    supabase
      .from("images")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("parent_image_id", null),
    supabase
      .from("images")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .not("parent_image_id", "is", null),
  ])

  if (!profile) return { account: null, error: "Profile not found" }

  return {
    account: {
      ...profile,
      email: profile.email ?? user.email ?? "",
      image_count: imageCount ?? 0,
      saved_variation_count: variationCount ?? 0,
    },
  }
}

export async function updateDisplayName(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const raw = formData.get("display_name")
  const displayName = typeof raw === "string" ? raw.trim().slice(0, 60) : ""

  if (displayName.length < 1) return { success: false, error: "Name can't be empty." }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "Not authenticated" }

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName, updated_at: new Date().toISOString() })
    .eq("id", user.id)

  if (error) {
    console.error("[v0] updateDisplayName failed:", error.message)
    return { success: false, error: "Couldn't save your name. Please try again." }
  }

  revalidatePath("/account")
  return { success: true }
}
