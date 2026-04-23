"use server"

import { createClient } from "@/lib/supabase-server"
import type { ModelProvider, ModelFeedback } from "@/lib/types"

export async function submitFeedback(
  jobIdOrImageId: string,
  fileName: string,
  modelProvider: ModelProvider,
  variationNumber: number,
  feedbackType: "thumbs_up" | "thumbs_down",
  originalUrl?: string,
  resultUrl?: string,
  styleMode?: string,
  feedbackNotes?: string,
  isImageFeedback?: boolean, // If true, use image_id instead of job_id
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    // Build query based on whether this is image feedback or job feedback
    let query = supabase
      .from("model_feedback")
      .select("id")
      .eq("file_name", fileName)
      .eq("model_provider", modelProvider)
      .eq("variation_number", variationNumber)
    
    if (isImageFeedback) {
      query = query.eq("image_id", jobIdOrImageId)
    } else {
      query = query.eq("job_id", jobIdOrImageId)
    }

    const { data: existing, error: selectError } = await query.maybeSingle()

    // Only throw on actual errors, not on "no rows found"
    if (selectError && selectError.code !== "PGRST116") {
      throw selectError
    }

    if (existing) {
      // Update existing feedback
      const { error } = await supabase
        .from("model_feedback")
        .update({
          feedback_type: feedbackType,
          feedback_notes: feedbackNotes,
        })
        .eq("id", existing.id)

      if (error) throw error
    } else {
      // Insert new feedback - use image_id or job_id based on context
      const insertData: Record<string, unknown> = {
        file_name: fileName,
        model_provider: modelProvider,
        variation_number: variationNumber,
        feedback_type: feedbackType,
        feedback_notes: feedbackNotes,
        original_url: originalUrl,
        result_url: resultUrl,
        style_mode: styleMode,
      }
      
      if (isImageFeedback) {
        insertData.image_id = jobIdOrImageId
      } else {
        insertData.job_id = jobIdOrImageId
      }

      const { error } = await supabase.from("model_feedback").insert(insertData)

      if (error) throw error
    }

    // Only update job's file_list if this is job feedback (not image feedback)
    if (!isImageFeedback) {
      const { data: job } = await supabase.from("jobs").select("file_list").eq("id", jobIdOrImageId).single()

      if (job?.file_list) {
        const fileList = job.file_list as any[]
        const fileIndex = fileList.findIndex((f: any) => f.name === fileName)

        if (fileIndex >= 0 && fileList[fileIndex].variations) {
          const varIndex = fileList[fileIndex].variations.findIndex((v: any) => v.variation_number === variationNumber)
          if (varIndex >= 0) {
            fileList[fileIndex].variations[varIndex].feedback = feedbackType

            await supabase.from("jobs").update({ file_list: fileList }).eq("id", jobIdOrImageId)
          }
        }
      }
    }

    return { success: true }
  } catch (error) {
    console.error("[v0] Failed to submit feedback:", error)
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

export async function getFeedbackStats(): Promise<{
  nano_banana_pro: { thumbs_up: number; thumbs_down: number }
  openai: { thumbs_up: number; thumbs_down: number }
  openai_mini: { thumbs_up: number; thumbs_down: number }
  openai_1_5: { thumbs_up: number; thumbs_down: number }
}> {
  const supabase = await createClient()

  const { data } = await supabase.from("model_feedback").select("model_provider, feedback_type")

  const stats = {
    nano_banana_pro: { thumbs_up: 0, thumbs_down: 0 },
    openai: { thumbs_up: 0, thumbs_down: 0 },
    openai_mini: { thumbs_up: 0, thumbs_down: 0 },
    openai_1_5: { thumbs_up: 0, thumbs_down: 0 },
  }

  if (data) {
    for (const row of data) {
      const provider = row.model_provider as keyof typeof stats
      const type = row.feedback_type as "thumbs_up" | "thumbs_down"
      if (stats[provider]) {
        stats[provider][type]++
      }
    }
  }

  return stats
}

export async function getAllFeedback(filters?: {
  modelProvider?: ModelProvider
  feedbackType?: "thumbs_up" | "thumbs_down"
  isExemplary?: boolean
}): Promise<ModelFeedback[]> {
  const supabase = await createClient()

  let query = supabase.from("model_feedback").select("*").order("created_at", { ascending: false })

  if (filters?.modelProvider) {
    query = query.eq("model_provider", filters.modelProvider)
  }
  if (filters?.feedbackType) {
    query = query.eq("feedback_type", filters.feedbackType)
  }
  if (filters?.isExemplary !== undefined) {
    query = query.eq("is_exemplary", filters.isExemplary)
  }

  const { data, error } = await query

  if (error) {
    console.error("[v0] Failed to fetch feedback:", error)
    return []
  }

  return data as ModelFeedback[]
}

export async function markAsExemplary(
  feedbackId: string,
  isExemplary: boolean,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    const { error } = await supabase.from("model_feedback").update({ is_exemplary: isExemplary }).eq("id", feedbackId)

    if (error) throw error

    return { success: true }
  } catch (error) {
    console.error("[v0] Failed to update exemplary status:", error)
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

export async function getExemplaryExamples(modelProvider: ModelProvider, limit = 3): Promise<ModelFeedback[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("model_feedback")
    .select("*")
    .eq("model_provider", modelProvider)
    .eq("is_exemplary", true)
    .eq("feedback_type", "thumbs_up")
    .limit(limit)

  if (error) {
    console.error("[v0] Failed to fetch exemplary examples:", error)
    return []
  }

  return data as ModelFeedback[]
}
