"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { useAuthContext } from "@/lib/contexts/auth-context"
import { getProjectById, getProjectImages, updateProject, assignImagesToProject } from "@/lib/actions/project-actions"
import type { Project, UserImage } from "@/lib/types"
import {
  Loader2,
  ArrowLeft,
  Sparkles,
  Trash2,
  MoreVertical,
  ImageIcon,
  MapPin,
  Edit2,
  X,
  Check,
  Home,
  Mountain,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  FolderMinus,
  Upload,
  Square,
  CheckSquare,
  Layers,
  FolderPlus,
  FolderOpen,
} from "lucide-react"
import { ImageUploader } from "@/components/image-uploader"
import { getUserProjects } from "@/lib/actions/project-actions"

export default function ProjectDetailPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.projectId as string
  const { isAuthenticated, isLoading: authLoading, profile } = useAuthContext()

  const [project, setProject] = useState<Project | null>(null)
  const [images, setImages] = useState<UserImage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedImages, setExpandedImages] = useState<Set<string>>(new Set())
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [showUploader, setShowUploader] = useState(false)

  // Editing state
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState("")
  
  // Batch selection state
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set())
  const [showBatchProjectMenu, setShowBatchProjectMenu] = useState(false)
  const [allProjects, setAllProjects] = useState<Project[]>([])

  useEffect(() => {
    if (projectId && isAuthenticated) {
      loadProject()
      loadAllProjects()
    }
  }, [projectId, isAuthenticated])
  
  async function loadAllProjects() {
    const { projects } = await getUserProjects()
    setAllProjects(projects || [])
  }

  async function loadProject() {
    setIsLoading(true)
    const [projectResult, imagesResult] = await Promise.all([
      getProjectById(projectId),
      getProjectImages(projectId),
    ])

    if (projectResult.project) {
      setProject(projectResult.project)
      setEditedName(projectResult.project.name)
    }
    if (imagesResult.images) {
      setImages(imagesResult.images)
    }
    setIsLoading(false)
  }

  async function handleUpdateName() {
    if (!editedName.trim() || !project) return

    const { project: updated } = await updateProject(projectId, { name: editedName.trim() })
    if (updated) {
      setProject({ ...project, name: updated.name })
    }
    setIsEditingName(false)
  }

  function handleUploadComplete() {
    setShowUploader(false)
    loadProject() // Reload to show new images
  }

  async function handleRemoveFromProject(imageId: string) {
    setMenuOpenId(null)
    const { success } = await assignImagesToProject([imageId], null)
    if (success) {
      setImages(images.filter((img) => img.id !== imageId))
      if (project) {
        setProject({ ...project, image_count: (project.image_count || 1) - 1 })
      }
    }
  }
  
  // Batch selection functions
  function toggleImageSelection(imageId: string) {
    setSelectedImages((prev) => {
      const next = new Set(prev)
      if (next.has(imageId)) {
        next.delete(imageId)
      } else {
        next.add(imageId)
      }
      return next
    })
  }
  
  function selectAllImages() {
    setSelectedImages(new Set(images.map(img => img.id)))
  }
  
  function clearSelection() {
    setSelectedImages(new Set())
  }
  
  async function handleBatchMoveToProject(targetProjectId: string | null) {
    const imageIds = Array.from(selectedImages)
    const { success } = await assignImagesToProject(imageIds, targetProjectId)
    if (success) {
      // Remove from current project view if moved to different project
      if (targetProjectId !== projectId) {
        setImages(images.filter(img => !selectedImages.has(img.id)))
        if (project) {
          setProject({ ...project, image_count: Math.max(0, (project.image_count || 0) - imageIds.length) })
        }
      }
      clearSelection()
    }
    setShowBatchProjectMenu(false)
  }

  const toggleExpanded = (imageId: string) => {
    setExpandedImages((prev) => {
      const next = new Set(prev)
      if (next.has(imageId)) {
        next.delete(imageId)
      } else {
        next.add(imageId)
      }
      return next
    })
  }

  const getClassificationIcon = (classification: string) => {
    switch (classification) {
      case "indoor":
        return <Home className="w-3 h-3" />
      case "outdoor":
        return <Mountain className="w-3 h-3" />
      default:
        return <HelpCircle className="w-3 h-3" />
    }
  }

  const getClassificationColor = (classification: string) => {
    switch (classification) {
      case "indoor":
        return "text-blue-400"
      case "outdoor":
        return "text-green-400"
      default:
        return "text-slate-400"
    }
  }

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 to-slate-950">
        <Loader2 className="w-8 h-8 text-[#FF3EDB] animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) {
    router.push("/auth/login?redirect=/library")
    return null
  }

  if (!project) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex flex-1 pt-20">
          <Sidebar />
          <main className="flex-1 ml-20 p-8">
            <div className="max-w-6xl mx-auto text-center py-20">
              <h1 className="text-2xl font-bold text-white mb-4">Project Not Found</h1>
              <Link href="/library" className="text-fuchsia-400 hover:text-fuchsia-300">
                Return to Library
              </Link>
            </div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <div className="flex flex-1 pt-20">
        <Sidebar />

        <main className="flex-1 ml-20 p-8">
          <div className="max-w-6xl mx-auto">
            {/* Back Link */}
            <Link
              href="/library"
              className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Library
            </Link>

            {/* Project Header */}
            <div className="flex items-start justify-between mb-8">
              <div className="flex-1">
                {/* Upload Button */}
                <button
                  onClick={() => setShowUploader(true)}
                  className="float-right flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-magenta-violet text-white font-semibold hover:scale-105 transition-all"
                >
                  <Upload className="w-4 h-4" />
                  Upload Photos
                </button>
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      className="text-3xl font-bold bg-transparent border-b-2 border-fuchsia-500 text-white focus:outline-none"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleUpdateName()
                        if (e.key === "Escape") {
                          setIsEditingName(false)
                          setEditedName(project.name)
                        }
                      }}
                    />
                    <button
                      onClick={handleUpdateName}
                      className="p-1 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingName(false)
                        setEditedName(project.name)
                      }}
                      className="p-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-bold text-white">{project.name}</h1>
                    <button
                      onClick={() => setIsEditingName(true)}
                      className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {project.address && (
                  <p className="text-slate-400 flex items-center gap-1.5 mt-2">
                    <MapPin className="w-4 h-4" />
                    {project.address}
                  </p>
                )}

                <div className="flex items-center gap-4 mt-3 text-sm text-slate-400">
                  <span className="flex items-center gap-1">
                    <ImageIcon className="w-4 h-4" />
                    {images.length} photo{images.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            </div>

            {/* Uploader Modal */}
            {showUploader && (
              <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                  <ImageUploader
                    onComplete={handleUploadComplete}
                    onCancel={() => setShowUploader(false)}
                    tokenBalance={profile?.tokens || 0}
                    preselectedProjectId={projectId}
                  />
                </div>
              </div>
            )}

            {/* Images Grid */}
            {images.length === 0 ? (
              <div className="text-center py-20">
                <ImageIcon className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">No Photos Yet</h3>
                <p className="text-slate-400 mb-6">
                  Upload photos directly to this project or assign existing photos from your library.
                </p>
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={() => setShowUploader(true)}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl gradient-magenta-violet text-white font-semibold hover:scale-105 transition-all"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Photos
                  </button>
                  <Link
                    href="/library"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/10 text-white font-semibold hover:bg-white/20 transition-colors"
                  >
                    Assign from Library
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {images.map((image) => {
                  const isExpanded = expandedImages.has(image.id)
                  const variationCount = image.variations?.length || 0
                  const hasVariations = variationCount > 0

                    return (
                    <div key={image.id} className={`rounded-xl bg-white/5 border overflow-hidden transition-all ${
                      selectedImages.has(image.id) ? "border-fuchsia-500 ring-1 ring-fuchsia-500" : "border-white/10"
                    }`}>
                      {/* Main Image Row */}
                      <div className="flex items-center gap-4 p-4">
                        {/* Selection Checkbox */}
                        <button
                          onClick={() => toggleImageSelection(image.id)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
                        >
                          {selectedImages.has(image.id) ? (
                            <CheckSquare className="w-5 h-5 text-fuchsia-500" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-500 hover:text-slate-300" />
                          )}
                        </button>
                        
                        {/* Expand Toggle */}
                        <button
                          onClick={() => hasVariations && toggleExpanded(image.id)}
                          className={`p-1 rounded ${hasVariations ? "hover:bg-white/10 cursor-pointer" : "cursor-default opacity-50"}`}
                          disabled={!hasVariations}
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5 text-slate-400" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-slate-400" />
                          )}
                        </button>

                        {/* Thumbnail */}
                        <div
                          className="relative w-20 h-20 rounded-lg overflow-hidden cursor-pointer"
                          onClick={() => router.push(`/transform/${image.id}`)}
                        >
                          <Image
                            src={image.thumbnail_path || image.storage_path}
                            alt={image.original_filename}
                            fill
                            className="object-cover"
                          />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white truncate">{image.original_filename}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className={`flex items-center gap-1 text-xs ${getClassificationColor(image.classification)}`}>
                              {getClassificationIcon(image.classification)}
                              {image.classification}
                            </span>
                            {hasVariations && (
                              <span className="text-xs text-slate-400">
                                {variationCount} variation{variationCount !== 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => router.push(`/transform/${image.id}`)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-fuchsia-500/20 text-fuchsia-400 hover:bg-fuchsia-500/30 transition-colors text-sm"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            Transform
                          </button>

                          <div className="relative">
                            <button
                              onClick={() => setMenuOpenId(menuOpenId === image.id ? null : image.id)}
                              className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {menuOpenId === image.id && (
                              <div className="absolute right-0 top-full mt-1 w-48 rounded-lg bg-slate-800 border border-white/10 shadow-xl py-1 z-10">
                                <button
                                  onClick={() => handleRemoveFromProject(image.id)}
                                  className="w-full px-3 py-2 text-left text-sm text-amber-400 hover:bg-amber-500/10 flex items-center gap-2"
                                >
                                  <FolderMinus className="w-4 h-4" />
                                  Remove from Project
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Variations */}
                      {isExpanded && hasVariations && (
                        <div className="border-t border-white/10 bg-white/2 p-4 pl-16">
                          <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
                            {image.variations?.map((variation) => (
                              <div
                                key={variation.id}
                                className="relative aspect-square rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-fuchsia-500 transition-all"
                                onClick={() => router.push(`/transform/${image.id}`)}
                              >
                                <Image
                                  src={variation.thumbnail_path || variation.storage_path}
                                  alt={`Variation of ${image.original_filename}`}
                                  fill
                                  className="object-cover"
                                />
                                {variation.source_model && (
                                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-xs text-center py-0.5 text-slate-300">
                                    {variation.source_model}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          
          {/* Batch Action Bar */}
          {selectedImages.size > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
              <div className="glass-card-strong rounded-2xl px-6 py-4 flex items-center gap-4 shadow-2xl border border-white/20">
                {/* Selection count */}
                <div className="flex items-center gap-2 pr-4 border-r border-white/20">
                  <Layers className="w-5 h-5 text-fuchsia-400" />
                  <span className="text-white font-medium">{selectedImages.size} selected</span>
                </div>
                
                {/* Select All / Clear */}
                <div className="flex items-center gap-2">
                  {selectedImages.size < images.length ? (
                    <button
                      onClick={selectAllImages}
                      className="px-3 py-1.5 rounded-lg text-sm text-slate-300 hover:bg-white/10 transition-colors"
                    >
                      Select All
                    </button>
                  ) : (
                    <button
                      onClick={clearSelection}
                      className="px-3 py-1.5 rounded-lg text-sm text-slate-300 hover:bg-white/10 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
                
                {/* Batch Actions */}
                <div className="flex items-center gap-2 pl-4 border-l border-white/20">
                  {/* Batch Transform */}
                  <button
                    onClick={() => {
                      const selectedArray = Array.from(selectedImages)
                      if (selectedArray.length > 0) {
                        sessionStorage.setItem("batch_transform_ids", JSON.stringify(selectedArray))
                        router.push("/batch-transform")
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-magenta-violet text-white font-medium hover:scale-105 transition-all"
                  >
                    <Sparkles className="w-4 h-4" />
                    Batch Transform
                  </button>
                  
                  {/* Move to Project */}
                  <div className="relative">
                    <button
                      onClick={() => setShowBatchProjectMenu(!showBatchProjectMenu)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 text-white font-medium hover:bg-white/20 transition-colors"
                    >
                      <FolderPlus className="w-4 h-4" />
                      Move to Project
                      <ChevronDown className={`w-4 h-4 transition-transform ${showBatchProjectMenu ? "rotate-180" : ""}`} />
                    </button>
                    
                    {showBatchProjectMenu && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowBatchProjectMenu(false)} />
                        <div className="absolute bottom-full mb-2 right-0 z-20 w-56 glass-card-strong rounded-xl p-1 shadow-xl">
                          {/* Remove from project option */}
                          <button
                            onClick={() => handleBatchMoveToProject(null)}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-amber-400 hover:bg-amber-500/10 transition-colors"
                          >
                            <FolderMinus className="w-4 h-4" />
                            Remove from Project
                          </button>
                          <div className="border-t border-white/10 my-1" />
                          
                          {/* Other projects */}
                          {allProjects
                            .filter(p => p.id !== projectId)
                            .map((proj) => (
                              <button
                                key={proj.id}
                                onClick={() => handleBatchMoveToProject(proj.id)}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-white/5 transition-colors"
                              >
                                <FolderOpen className="w-4 h-4" />
                                <span className="truncate">{proj.name}</span>
                              </button>
                            ))}
                          
                          {allProjects.filter(p => p.id !== projectId).length === 0 && (
                            <p className="px-3 py-2 text-sm text-slate-500">No other projects</p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  
                  {/* Clear Selection */}
                  <button
                    onClick={clearSelection}
                    className="p-2 rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
                    title="Clear selection"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
