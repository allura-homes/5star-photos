export type JobStatus = "uploaded" | "processing_preview" | "preview_ready" | "processing_final" | "done" | "error"

export type StyleMode = "full_5star_fix"

export type ModelProvider = "openai_1_5" | "nano_banana_pro" | "openai" | "openai_mini" | "flux_2_pro"

export type PhotoClassification = "indoor" | "outdoor" | "unknown"

export type ZoomPreset = "none" | "slight" | "moderate" | "significant"

export type ColorTemperature = 2500 | 3000 | 3500 | 4000 | 4500

export interface EnhancementPreferences {
  // Outdoor-specific options
  skyReplacement: "none" | "clear_blue" | "dramatic_clouds" | "golden_hour" | "twilight"
  virtualTwilight: boolean
  enhanceLawn: boolean

  // Indoor-specific options
  windowBalance: boolean
  declutter: boolean
  colorTemperature: ColorTemperature

  // Universal options
  straightenVerticals: boolean
  zoomOut: ZoomPreset
  
  // Art Director instructions
  additionalInstructions?: string
  
  // Reference image for style/content guidance
  referenceImageUrl?: string
  referenceImageDescription?: string

  // Meta
  saveAsDefaults: boolean
}

export interface ClassifiedPhoto {
  file: File
  classification: PhotoClassification
  thumbnailUrl: string
  userOverride?: PhotoClassification
}

export const DEFAULT_ENHANCEMENT_PREFERENCES: EnhancementPreferences = {
  skyReplacement: "none",
  virtualTwilight: false,
  enhanceLawn: false,
  windowBalance: false,
  declutter: false,
  colorTemperature: 4000,
  straightenVerticals: false,
  zoomOut: "none",
  saveAsDefaults: false,
}

export interface Variation {
  variation_number: number
  preview_url: string
  qa_status: "pass" | "notes"
  qa_notes: string[]
  approved: boolean
  model_provider?: ModelProvider
  feedback?: "thumbs_up" | "thumbs_down" | null
}

export interface FileItem {
  name: string
  size: number
  original_url?: string
  variations?: Variation[]
  // Legacy fields for backward compatibility
  preview_url?: string
  final_url?: string
  qa_status?: "pass" | "notes"
  qa_notes?: string[]
  approved?: boolean
}

export interface Job {
  id: string
  created_at: string
  status: JobStatus
  style_mode: StyleMode
  file_list: FileItem[]
  error_message?: string
  google_drive_link?: string
}

export interface ModelFeedback {
  id: string
  created_at: string
  job_id: string
  file_name: string
  model_provider: ModelProvider
  variation_number: number
  feedback_type: "thumbs_up" | "thumbs_down"
  feedback_notes?: string
  original_url?: string
  result_url?: string
  style_mode?: string
  prompt_used?: string
  user_id?: string
  is_exemplary: boolean
}

export type TokenTransactionType = "upload" | "transform" | "save_variation" | "download_hires" | "purchase" | "bonus"

export interface UserImage {
  id: string
  user_id: string
  parent_image_id: string | null
  project_id: string | null
  storage_path: string
  thumbnail_path: string | null
  original_filename: string
  classification: PhotoClassification
  metadata: {
    width?: number
    height?: number
    file_size?: number
    mime_type?: string
  }
  is_original: boolean
  source_model: ModelProvider | null
  transformation_prompt: string | null
  created_at: string
  updated_at: string
  // For nested view - populated client-side
  variations?: UserImage[]
  // For transform preview - temporary watermarked variations
  preview_variations?: PreviewVariation[]
}

export interface PreviewVariation {
  model: ModelProvider
  preview_url: string
  is_loading: boolean
  error?: string
}

export const TOKEN_COSTS = {
  upload: 1,
  transform: 1,
  save_variation: 1,
  download_hires: 4,
} as const

// Projects for organizing photos by property
export interface Project {
  id: string
  user_id: string
  name: string
  description: string | null
  address: string | null
  cover_image_id: string | null
  created_at: string
  updated_at: string
  // Populated client-side
  image_count?: number
  cover_image_url?: string
}
