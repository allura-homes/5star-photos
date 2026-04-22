"use server"

import { createClient } from "@/lib/supabase/server"
import type { Project } from "@/lib/types"

// Get all projects for the current user
export async function getUserProjects(): Promise<{ projects: Project[]; error?: string }> {
  const supabase = await createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) {
    return { projects: [], error: "Not authenticated" }
  }

  const user = session.user

  // Fetch all projects with image counts
  const { data: projects, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })

  if (error) {
    return { projects: [], error: error.message }
  }

  // Get image counts and cover images for each project
  const projectsWithCounts = await Promise.all(
    (projects || []).map(async (project) => {
      // Count images in this project
      const { count } = await supabase
        .from("images")
        .select("*", { count: "exact", head: true })
        .eq("project_id", project.id)
        .eq("is_original", true)

      // Get cover image URL if set
      let cover_image_url: string | null = null
      if (project.cover_image_id) {
        const { data: coverImage } = await supabase
          .from("images")
          .select("storage_path, thumbnail_path")
          .eq("id", project.cover_image_id)
          .single()

        if (coverImage) {
          cover_image_url = coverImage.thumbnail_path || coverImage.storage_path
        }
      } else {
        // Use first image as cover if no cover set
        const { data: firstImages } = await supabase
          .from("images")
          .select("storage_path, thumbnail_path")
          .eq("project_id", project.id)
          .eq("is_original", true)
          .order("created_at", { ascending: true })
          .limit(1)

        if (firstImages && firstImages.length > 0) {
          cover_image_url = firstImages[0].thumbnail_path || firstImages[0].storage_path
        }
      }

      return {
        ...project,
        image_count: count || 0,
        cover_image_url,
      }
    })
  )

  return { projects: projectsWithCounts as Project[] }
}

// Get a single project by ID
export async function getProjectById(projectId: string): Promise<{ project: Project | null; error?: string }> {
  const supabase = await createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) {
    return { project: null, error: "Not authenticated" }
  }

  const { data: project, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", session.user.id)
    .single()

  if (error) {
    return { project: null, error: error.message }
  }

  // Get image count
  const { count } = await supabase
    .from("images")
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("is_original", true)

  return {
    project: {
      ...project,
      image_count: count || 0,
    } as Project,
  }
}

// Create a new project
export async function createProject(data: {
  name: string
  description?: string
  address?: string
}): Promise<{ project: Project | null; error?: string }> {
  const supabase = await createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) {
    return { project: null, error: "Not authenticated" }
  }

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      user_id: session.user.id,
      name: data.name,
      description: data.description || null,
      address: data.address || null,
    })
    .select()
    .single()

  if (error) {
    return { project: null, error: error.message }
  }

  return { project: { ...project, image_count: 0 } as Project }
}

// Update a project
export async function updateProject(
  projectId: string,
  data: {
    name?: string
    description?: string
    address?: string
    cover_image_id?: string | null
  }
): Promise<{ project: Project | null; error?: string }> {
  const supabase = await createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) {
    return { project: null, error: "Not authenticated" }
  }

  const { data: project, error } = await supabase
    .from("projects")
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId)
    .eq("user_id", session.user.id)
    .select()
    .single()

  if (error) {
    return { project: null, error: error.message }
  }

  return { project: project as Project }
}

// Delete a project (images are unassigned, not deleted)
export async function deleteProject(projectId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) {
    return { success: false, error: "Not authenticated" }
  }

  // First, unassign all images from this project
  await supabase
    .from("images")
    .update({ project_id: null })
    .eq("project_id", projectId)
    .eq("user_id", session.user.id)

  // Then delete the project
  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId)
    .eq("user_id", session.user.id)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

// Assign images to a project
export async function assignImagesToProject(
  imageIds: string[],
  projectId: string | null
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) {
    return { success: false, error: "Not authenticated" }
  }

  const { error } = await supabase
    .from("images")
    .update({ project_id: projectId })
    .in("id", imageIds)
    .eq("user_id", session.user.id)

  if (error) {
    return { success: false, error: error.message }
  }

  // Update project's updated_at timestamp
  if (projectId) {
    await supabase
      .from("projects")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", projectId)
  }

  return { success: true }
}

// Get images for a specific project
export async function getProjectImages(projectId: string): Promise<{ images: import("@/lib/types").UserImage[]; error?: string }> {
  const supabase = await createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) {
    return { images: [], error: "Not authenticated" }
  }

  // Fetch all images in this project
  const { data: allImages, error } = await supabase
    .from("images")
    .select("*")
    .eq("project_id", projectId)
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })

  if (error) {
    return { images: [], error: error.message }
  }

  // Organize into nested structure: originals with variations
  const originals = allImages?.filter((img) => img.is_original) || []
  const variations = allImages?.filter((img) => !img.is_original) || []

  // Nest variations under their parent originals
  const nestedImages = originals.map((original) => ({
    ...original,
    variations: variations.filter((v) => v.parent_image_id === original.id),
  }))

  return { images: nestedImages as import("@/lib/types").UserImage[] }
}
