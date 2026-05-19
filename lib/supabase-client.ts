import { createClient } from "@/lib/supabase/client"

// Re-export createClient as getSupabaseClient for backwards compatibility
// This file is deprecated - use @/lib/supabase/client directly
export function getSupabaseClient() {
  return createClient()
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/\s+/g, "_") // Replace spaces with underscores
    .replace(/[^a-zA-Z0-9._-]/g, "") // Remove any other special characters
}

export async function uploadFileToStorage(
  file: File,
  jobId: string,
): Promise<{ name: string; size: number; original_url: string } | null> {
  const supabase = getSupabaseClient()

  const sanitizedName = sanitizeFileName(file.name)
  const fileName = `${jobId}/${Date.now()}-${sanitizedName}`

  const { data, error } = await supabase.storage.from("original-uploads").upload(fileName, file, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  })

  if (error) {
    console.error(`[v0] Client upload error for ${file.name}:`, error.message)
    return null
  }

  const { data: urlData } = supabase.storage.from("original-uploads").getPublicUrl(fileName)

  return {
    name: file.name, // Keep original name for display
    size: file.size,
    original_url: urlData.publicUrl,
  }
}
