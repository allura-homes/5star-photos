import { createBrowserClient } from "@supabase/ssr"

let supabaseClient: ReturnType<typeof createBrowserClient> | null = null

export function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
  }
  return supabaseClient
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
