"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useDropzone } from "react-dropzone"
import { getUserImages, deleteImage, deleteImages, updateImageClassification, uploadImage } from "@/lib/actions/image-actions"
import { getUserProjects, assignImagesToProject } from "@/lib/actions/project-actions"
import type { UserImage, PhotoClassification, Project } from "@/lib/types"
import { TOKEN_COSTS } from "@/lib/constants/tokens"
import { v4 as uuidv4 } from "uuid"
import { loadPendingFiles, clearPendingFiles } from "@/lib/pending-files-storage"

// Model to user-friendly label mapping (matches transform page)
const MODEL_LABELS: Record<string, string> = {
  openai_1_5: "V1",
  nano_banana_pro: "V2",
  flux_2_pro: "V3",
  openai_2: "V4",
}

function getModelLabel(sourceModel: string | null | undefined): string {
  if (!sourceModel) return ""
  return MODEL_LABELS[sourceModel] || sourceModel
}
import {
  Loader2,
  Upload,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Trash2,
  Home,
  Mountain,
  HelpCircle,
  MoreVertical,
  ImageIcon,
  X,
  AlertTriangle,
  Check,
  FolderPlus,
  FolderOpen,
  Square,
  CheckSquare,
  Layers,
} from "lucide-react"

interface ImageLibraryProps {
  onSelectImage: (image: UserImage) => void
  onUploadClick: () => void
  tokenBalance?: number
  setTokenBalance?: (balance: number | ((prev: number) => number)) => void
}

interface PendingUpload {
  id: string
  file: File
  preview: string
  classification: PhotoClassification
  status: "pending" | "uploading" | "done" | "error"
  error?: string
}

function classifyFromFilename(filename: string): PhotoClassification {
  const lower = filename.toLowerCase()
  const outdoorKeywords = [
    "exterior",
    "outdoor",
    "outside",
    "front",
    "backyard",
    "yard",
    "garden",
    "pool",
    "patio",
    "deck",
    "aerial",
    "drone",
    "landscape",
  ]
  const indoorKeywords = ["interior", "indoor", "inside", "kitchen", "bedroom", "bathroom", "living", "dining", "room"]
  for (const keyword of outdoorKeywords) {
    if (lower.includes(keyword)) return "outdoor"
  }
  for (const keyword of indoorKeywords) {
    if (lower.includes(keyword)) return "indoor"
  }
  return "unknown"
}

export function ImageLibrary({ onSelectImage, onUploadClick, tokenBalance = 0, setTokenBalance = () => {} }: ImageLibraryProps) {
  const router = useRouter()
  const [images, setImages] = useState<UserImage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedImages, setExpandedImages] = useState<Set<string>>(new Set())
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [showProjectSubmenu, setShowProjectSubmenu] = useState<string | null>(null)
  
  // Batch selection state
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set())
  const [showBatchProjectMenu, setShowBatchProjectMenu] = useState(false)
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [checkedPendingFiles, setCheckedPendingFiles] = useState(false)
  const [imageLoadErrors, setImageLoadErrors] = useState<Set<string>>(new Set())
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    loadImages()
    loadProjects()
  }, [])
  
  async function loadProjects() {
    const { projects: data } = await getUserProjects()
    setProjects(data || [])
  }
  
  async function handleAssignToProject(imageId: string, projectId: string | null) {
    const { success } = await assignImagesToProject([imageId], projectId)
    if (success) {
      // Update local state to reflect the change
      setImages(images.map(img => 
        img.id === imageId ? { ...img, project_id: projectId } : img
      ))
    }
    setMenuOpenId(null)
    setShowProjectSubmenu(null)
  }

  useEffect(() => {
    async function checkPendingFiles() {
      if (checkedPendingFiles) return

      try {
        const pendingFiles = await loadPendingFiles()

        if (pendingFiles.length > 0) {
          const newUploads: PendingUpload[] = pendingFiles.map((file) => ({
            id: uuidv4(),
            file,
            preview: URL.createObjectURL(file),
            classification: classifyFromFilename(file.name),
            status: "pending",
          }))

          setPendingUploads(newUploads)

          await clearPendingFiles()
          sessionStorage.removeItem("5star_pending_enhance")
        }
      } catch (error) {
        console.error("Error loading pending files:", error)
      }

      setCheckedPendingFiles(true)
    }

    checkPendingFiles()
  }, [checkedPendingFiles])

  async function loadImages() {
    setIsLoading(true)
    setLoadError(null)
    try {
      const { images: fetchedImages, error } = await getUserImages()
      if (error) {
        console.error("[v0] Load images error:", error)
        setLoadError(error)
      }
      setImages(fetchedImages)
    } catch (err) {
      console.error("[v0] Load images exception:", err)
      setLoadError(err instanceof Error ? err.message : "Failed to load images")
    }
    setIsLoading(false)
  }

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newUploads: PendingUpload[] = acceptedFiles.map((file) => ({
      id: uuidv4(),
      file,
      preview: URL.createObjectURL(file),
      classification: classifyFromFilename(file.name),
      status: "pending",
    }))
    setPendingUploads((prev) => [...prev, ...newUploads])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp", ".heic"] },
    maxSize: 50 * 1024 * 1024,
  })

  function removeUpload(id: string) {
    setPendingUploads((prev) => {
      const upload = prev.find((u) => u.id === id)
      if (upload) URL.revokeObjectURL(upload.preview)
      return prev.filter((u) => u.id !== id)
    })
  }

  function updateClassification(id: string, classification: PhotoClassification) {
    setPendingUploads((prev) => prev.map((u) => (u.id === id ? { ...u, classification } : u)))
  }

  // Compress image to reduce file size for large uploads (Vercel has ~4.5MB limit)
  async function compressImage(file: File, maxSizeMB: number = 2.5): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new window.Image()
      img.crossOrigin = "anonymous"
      
      img.onload = () => {
        const fileSizeMB = file.size / (1024 * 1024)
        let scale = 1
        
        // More aggressive scaling for larger files
        if (fileSizeMB > maxSizeMB) {
          scale = Math.sqrt(maxSizeMB / fileSizeMB) * 0.9 // Extra 10% reduction
        }
        
        // Limit max dimensions to 3000px
        const maxDim = 3000
        if (img.width > maxDim || img.height > maxDim) {
          const dimScale = maxDim / Math.max(img.width, img.height)
          scale = Math.min(scale, dimScale)
        }
        
        const canvas = document.createElement("canvas")
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          reject(new Error("Failed to get canvas context"))
          return
        }
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        
        // More aggressive quality for very large files
        const quality = fileSizeMB > 8 ? 0.7 : fileSizeMB > 5 ? 0.75 : 0.8
        const dataUrl = canvas.toDataURL("image/jpeg", quality)
        
        console.log(`[v0] Compressed: ${img.width}x${img.height} -> ${canvas.width}x${canvas.height}, quality: ${quality}, ~${(dataUrl.length * 0.75 / 1024 / 1024).toFixed(2)}MB`)
        resolve(dataUrl)
      }
      
      img.onerror = () => reject(new Error("Failed to load image for compression"))
      img.src = URL.createObjectURL(file)
    })
  }

  async function handleUploadAll() {
    const pendingCount = pendingUploads.filter((u) => u.status === "pending").length
    // const cost = pendingCount * TOKEN_COSTS.upload
    // TEMPORARILY DISABLED: Token check bypassed for development
    // if (cost > tokenBalance) {
    //   return // Button should be disabled, but just in case
    // }

    setIsUploading(true)

    for (const upload of pendingUploads) {
      if (upload.status !== "pending") continue

      setPendingUploads((prev) => prev.map((u) => (u.id === upload.id ? { ...u, status: "uploading" } : u)))

      try {
        // Compress large images before upload (Vercel serverless limit is ~4.5MB)
        let base64: string
        const fileSizeMB = upload.file.size / (1024 * 1024)
        
        if (fileSizeMB > 2.5) {
          console.log(`[v0] Large file detected (${fileSizeMB.toFixed(2)}MB), compressing...`)
          base64 = await compressImage(upload.file, 2.5)
        } else {
          base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(upload.file)
          })
        }

        const { error } = await uploadImage(base64, upload.file.name, "image/jpeg", upload.classification)

        if (error) {
          setPendingUploads((prev) => prev.map((u) => (u.id === upload.id ? { ...u, status: "error", error } : u)))
        } else {
          setPendingUploads((prev) => prev.map((u) => (u.id === upload.id ? { ...u, status: "done" } : u)))
          setTokenBalance((prev) => Math.max(0, prev - 1))
        }
      } catch (err) {
        setPendingUploads((prev) =>
          prev.map((u) => (u.id === upload.id ? { ...u, status: "error", error: "Upload failed" } : u)),
        )
      }
    }

    setIsUploading(false)
    setTimeout(() => {
      setPendingUploads([])
      loadImages()
    }, 1000)
  }

  function toggleExpanded(imageId: string) {
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
  
  async function handleBatchAssignToProject(projectId: string | null) {
    const imageIds = Array.from(selectedImages)
    const { success } = await assignImagesToProject(imageIds, projectId)
    if (success) {
      setImages(images.map(img =>
        selectedImages.has(img.id) ? { ...img, project_id: projectId } : img
      ))
      clearSelection()
    }
    setShowBatchProjectMenu(false)
  }
  
  async function handleBatchDelete() {
    const imageIds = Array.from(selectedImages)
    setIsDeleting(true)
    const { success, deletedCount } = await deleteImages(imageIds)
    if (success) {
      setImages(images.filter(img => !selectedImages.has(img.id)))
      clearSelection()
    }
    setIsDeleting(false)
    setShowBatchDeleteConfirm(false)
  }

  async function handleDelete(imageId: string) {
    if (!confirm("Delete this image and all its variations?")) return
    await deleteImage(imageId)
    await loadImages()
    setMenuOpenId(null)
  }

  async function handleClassificationChange(imageId: string, classification: PhotoClassification) {
    await updateImageClassification(imageId, classification)
    await loadImages()
  }

  const getClassificationIcon = (classification: PhotoClassification) => {
    switch (classification) {
      case "indoor":
        return <Home className="w-3.5 h-3.5" />
      case "outdoor":
        return <Mountain className="w-3.5 h-3.5" />
      default:
        return <HelpCircle className="w-3.5 h-3.5" />
    }
  }

  const getClassificationColor = (classification: PhotoClassification) => {
    switch (classification) {
      case "indoor":
        return "bg-blue-500/20 text-blue-400"
      case "outdoor":
        return "bg-green-500/20 text-green-400"
      default:
        return "bg-slate-500/20 text-slate-400"
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-[#FF3EDB] animate-spin" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="bg-red-500/10 rounded-2xl border border-red-500/30 p-8 text-center">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h3 className="text-white font-semibold text-lg mb-2">Failed to Load Images</h3>
        <p className="text-slate-400 mb-4">{loadError}</p>
        <button
          onClick={() => loadImages()}
          className="px-6 py-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
        >
          Try Again
        </button>
      </div>
    )
  }

  if (images.length === 0) {
    const pendingCount = pendingUploads.filter((u) => u.status === "pending").length
    const uploadCost = pendingCount * TOKEN_COSTS.upload
    // TEMPORARILY DISABLED: Token limits bypassed for development
    const hasInsufficientTokens = false // was: uploadCost > tokenBalance

    return (
      <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
            isDragActive
              ? "border-[#FF3EDB] bg-[#FF3EDB]/10"
              : "border-slate-600 hover:border-slate-500 hover:bg-white/5"
          }`}
        >
          <input {...getInputProps()} />
          <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragActive ? "text-[#FF3EDB]" : "text-slate-500"}`} />
          <p className="text-white font-medium mb-2">{isDragActive ? "Drop photos here" : "Drag & drop photos here"}</p>
          <p className="text-slate-400 text-sm mb-2">or click to browse (JPG, PNG, WebP, HEIC up to 50MB each)</p>
          <p className="text-green-400 text-sm">Unlimited uploads - development mode</p>
        </div>

        {pendingUploads.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-slate-300">{pendingUploads.length} photos selected</span>
              {hasInsufficientTokens && (
                <span className="text-red-400 text-sm">Cost: {uploadCost} tokens (insufficient balance)</span>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
              {pendingUploads.map((upload) => (
                <div key={upload.id} className="relative group">
                  <div className="aspect-[4/3] relative rounded-xl overflow-hidden bg-[#2B2A3A]">
                    <Image
                      src={upload.preview || "/placeholder.svg"}
                      alt={upload.file.name}
                      fill
                      className="object-cover"
                    />
                    {upload.status === "uploading" && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                      </div>
                    )}
                    {upload.status === "done" && (
                      <div className="absolute inset-0 bg-green-500/30 flex items-center justify-center">
                        <Check className="w-8 h-8 text-green-400" />
                      </div>
                    )}
                    {upload.status === "error" && (
                      <div className="absolute inset-0 bg-red-500/30 flex items-center justify-center">
                        <AlertTriangle className="w-8 h-8 text-red-400" />
                      </div>
                    )}
                    {upload.status === "pending" && (
                      <button
                        onClick={() => removeUpload(upload.id)}
                        className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {upload.status === "pending" && (
                    <div className="flex mt-2 rounded-lg overflow-hidden border border-white/10">
                      {(["indoor", "outdoor", "unknown"] as PhotoClassification[]).map((cls) => (
                        <button
                          key={cls}
                          onClick={() => updateClassification(upload.id, cls)}
                          className={`flex-1 py-1.5 text-xs flex items-center justify-center gap-1 transition-colors ${
                            upload.classification === cls
                              ? cls === "indoor"
                                ? "bg-blue-500/30 text-blue-400"
                                : cls === "outdoor"
                                  ? "bg-green-500/30 text-green-400"
                                  : "bg-slate-500/30 text-slate-300"
                              : "bg-white/5 text-slate-500 hover:bg-white/10"
                          }`}
                        >
                          {cls === "indoor" ? (
                            <Home className="w-3 h-3" />
                          ) : cls === "outdoor" ? (
                            <Mountain className="w-3 h-3" />
                          ) : (
                            <HelpCircle className="w-3 h-3" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {hasInsufficientTokens ? (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-center">
                <AlertTriangle className="w-6 h-6 text-red-400 mx-auto mb-2" />
                <p className="text-white font-medium mb-1">Insufficient Tokens</p>
                <p className="text-slate-400 text-sm mb-3">
                  You need {uploadCost} tokens but only have {tokenBalance}. Remove {pendingCount - tokenBalance}{" "}
                  photo(s) or buy more tokens.
                </p>
                <a
                  href="mailto:support@5star.photos?subject=Purchase%20Tokens"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors text-sm font-medium"
                >
                  Contact to Buy Tokens
                </a>
              </div>
            ) : (
              <button
                onClick={handleUploadAll}
                disabled={isUploading || pendingCount === 0}
                className="w-full py-4 rounded-xl gradient-magenta-violet text-white font-semibold hover:scale-[1.02] transition-all disabled:opacity-50 disabled:hover:scale-100"
              >
                {isUploading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Uploading...
                  </span>
                ) : (
                  `Upload ${pendingCount} Photo${pendingCount !== 1 ? "s" : ""} (${uploadCost} token${uploadCost !== 1 ? "s" : ""})`
                )}
              </button>
            )}
          </div>
        )}

        {pendingUploads.length === 0 && (
          <div className="text-center mt-6">
            <ImageIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">Your library is empty. Drop photos above to get started.</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {images.map((image) => {
        const isExpanded = expandedImages.has(image.id)
        const variationCount = image.variations?.length || 0
        const hasVariations = variationCount > 0

        return (
          <div key={image.id} className={`glass-card rounded-2xl overflow-hidden transition-all ${
            selectedImages.has(image.id) ? "ring-2 ring-fuchsia-500" : ""
          }`}>
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
              
              <button
                onClick={() => hasVariations && toggleExpanded(image.id)}
                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                  hasVariations ? "hover:bg-white/10 cursor-pointer" : "opacity-30 cursor-default"
                }`}
                disabled={!hasVariations}
              >
                {hasVariations &&
                  (isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  ))}
              </button>

              <div
                className="relative w-20 h-20 rounded-xl overflow-hidden bg-[#2B2A3A] flex-shrink-0 cursor-pointer group"
                onClick={() => onSelectImage(image)}
              >
                {image.storage_path ? (
                  <Image
                    src={image.thumbnail_path || image.storage_path}
                    alt={image.original_filename}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform"
                    onError={(e) => {
                      console.error("[v0] Image load error for:", image.original_filename, image.storage_path)
                      // Hide broken image
                      e.currentTarget.style.display = "none"
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-slate-500" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{image.original_filename}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getClassificationColor(image.classification)}`}
                  >
                    {getClassificationIcon(image.classification)}
                    {image.classification}
                  </span>

                  {hasVariations && (
                    <span className="text-xs text-slate-400">
                      {variationCount} saved variation{variationCount !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">{new Date(image.created_at).toLocaleDateString()}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onSelectImage(image)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FF3EDB]/20 text-[#FF3EDB] hover:bg-[#FF3EDB]/30 transition-colors font-medium text-sm"
                >
                  <Sparkles className="w-4 h-4" />
                  Transform
                </button>

                <div className="relative">
                  <button
                    onClick={() => setMenuOpenId(menuOpenId === image.id ? null : image.id)}
                    className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <MoreVertical className="w-4 h-4 text-slate-400" />
                  </button>

                  {menuOpenId === image.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setMenuOpenId(null)} />
                      <div className="absolute right-0 top-full mt-1 z-20 w-48 glass-card-strong rounded-xl p-1 shadow-xl">
                        <p className="px-3 py-2 text-xs text-slate-500 font-medium">Classification</p>
                        {(["indoor", "outdoor", "unknown"] as PhotoClassification[]).map((cls) => (
                          <button
                            key={cls}
                            onClick={() => {
                              handleClassificationChange(image.id, cls)
                              setMenuOpenId(null)
                            }}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                              image.classification === cls
                                ? "bg-white/10 text-white"
                                : "text-slate-300 hover:bg-white/5"
                            }`}
                          >
                            {getClassificationIcon(cls)}
                            <span className="capitalize">{cls}</span>
                          </button>
                        ))}

                        <div className="border-t border-white/10 my-1" />

                        {/* Add to Project */}
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setShowProjectSubmenu(showProjectSubmenu === image.id ? null : image.id)
                            }}
                            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-white/5 transition-colors"
                          >
                            <span className="flex items-center gap-2">
                              <FolderPlus className="w-4 h-4" />
                              Add to Project
                            </span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                          
                          {showProjectSubmenu === image.id && (
                            <div className="absolute left-full top-0 ml-1 w-48 glass-card-strong rounded-xl p-1 shadow-xl">
                              {projects.length === 0 ? (
                                <p className="px-3 py-2 text-xs text-slate-500">No projects yet</p>
                              ) : (
                                <>
                                  {image.project_id && (
                                    <>
                                      <button
                                        onClick={() => handleAssignToProject(image.id, null)}
                                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-amber-400 hover:bg-amber-500/10 transition-colors"
                                      >
                                        <X className="w-4 h-4" />
                                        Remove from Project
                                      </button>
                                      <div className="border-t border-white/10 my-1" />
                                    </>
                                  )}
                                  {projects.map((project) => (
                                    <button
                                      key={project.id}
                                      onClick={() => handleAssignToProject(image.id, project.id)}
                                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                                        image.project_id === project.id
                                          ? "bg-fuchsia-500/20 text-fuchsia-400"
                                          : "text-slate-300 hover:bg-white/5"
                                      }`}
                                    >
                                      <FolderOpen className="w-4 h-4" />
                                      <span className="truncate">{project.name}</span>
                                    </button>
                                  ))}
                                </>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="border-t border-white/10 my-1" />

                        <button
                          onClick={() => handleDelete(image.id)}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {isExpanded && hasVariations && (
              <div className="border-t border-white/10 bg-white/5 p-4 pl-16">
                <p className="text-xs text-slate-500 font-medium mb-3">SAVED VARIATIONS</p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {image.variations?.map((variation) => (
                    <div
                      key={variation.id}
                      className="relative group cursor-pointer rounded-xl overflow-hidden bg-[#2B2A3A]"
                      onClick={() => onSelectImage(variation)}
                    >
                      <div className="aspect-[4/3] relative">
                        <Image
                          src={variation.thumbnail_path || variation.storage_path}
                          alt={`Variation of ${image.original_filename}`}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />

                        {variation.source_model && (
                          <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/60 text-white text-xs">
                            {getModelLabel(variation.source_model)}
                          </div>
                        )}
                      </div>
                      <div className="p-2">
                        <p className="text-xs text-slate-400 truncate">
                          {new Date(variation.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
      
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
                  // Store selected IDs and navigate to batch transform page
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
              
              {/* Batch Add to Project */}
              <div className="relative">
                <button
                  onClick={() => setShowBatchProjectMenu(!showBatchProjectMenu)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 text-white font-medium hover:bg-white/20 transition-colors"
                >
                  <FolderPlus className="w-4 h-4" />
                  Add to Project
                  <ChevronDown className={`w-4 h-4 transition-transform ${showBatchProjectMenu ? "rotate-180" : ""}`} />
                </button>
                
                {showBatchProjectMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowBatchProjectMenu(false)} />
                    <div className="absolute bottom-full mb-2 right-0 z-20 w-56 glass-card-strong rounded-xl p-1 shadow-xl">
                      {projects.length === 0 ? (
                        <p className="px-3 py-2 text-sm text-slate-400">No projects yet</p>
                      ) : (
                        <>
                          <button
                            onClick={() => handleBatchAssignToProject(null)}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-amber-400 hover:bg-amber-500/10 transition-colors"
                          >
                            <X className="w-4 h-4" />
                            Remove from Projects
                          </button>
                          <div className="border-t border-white/10 my-1" />
                          {projects.map((project) => (
                            <button
                              key={project.id}
                              onClick={() => handleBatchAssignToProject(project.id)}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-white/5 transition-colors"
                            >
                              <FolderOpen className="w-4 h-4" />
                              <span className="truncate">{project.name}</span>
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
              
              {/* Batch Delete */}
              <button
                onClick={() => setShowBatchDeleteConfirm(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/20 text-red-400 font-medium hover:bg-red-500/30 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
              
              {/* Clear Selection */}
              <button
                onClick={clearSelection}
                className="p-2 rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
                title="Clear selection"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Batch Delete Confirmation Modal */}
            {showBatchDeleteConfirm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowBatchDeleteConfirm(false)}>
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
                <div 
                  className="relative glass-card-strong rounded-2xl p-6 max-w-md border border-white/20 shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-xl bg-red-500/20">
                      <AlertTriangle className="w-6 h-6 text-red-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">Delete {selectedImages.size} Images?</h3>
                  </div>
                  <p className="text-slate-300 mb-6">
                    This will permanently delete the selected images and all their transformations. This action cannot be undone.
                  </p>
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setShowBatchDeleteConfirm(false)}
                      className="px-4 py-2 rounded-xl text-slate-300 hover:bg-white/10 transition-colors"
                      disabled={isDeleting}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleBatchDelete}
                      disabled={isDeleting}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                    >
                      {isDeleting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                          Delete {selectedImages.size} Images
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
