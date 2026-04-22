"use client"

import { useState, useCallback, useEffect } from "react"
import { useDropzone } from "react-dropzone"
import Image from "next/image"
import { uploadImage } from "@/lib/actions/image-actions"
import { getUserProjects, createProject } from "@/lib/actions/project-actions"
import type { PhotoClassification, Project } from "@/lib/types"
import { Upload, X, Loader2, Home, Mountain, HelpCircle, Check, AlertCircle, AlertTriangle, FolderOpen, Plus, ChevronDown } from "lucide-react"
import { v4 as uuidv4 } from "uuid"
import { TOKEN_COSTS } from "@/lib/constants/tokens"

interface ImageUploaderProps {
  onComplete: () => void
  onCancel: () => void
  tokenBalance: number
  preselectedProjectId?: string | null
}

interface PendingUpload {
  id: string
  file: File
  preview: string
  classification: PhotoClassification
  status: "pending" | "uploading" | "done" | "error"
  error?: string
}

// Simple classification based on filename
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

export function ImageUploader({ onComplete, onCancel, tokenBalance, preselectedProjectId }: ImageUploaderProps) {
  const [uploads, setUploads] = useState<PendingUpload[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [showInsufficientTokensWarning, setShowInsufficientTokensWarning] = useState(false)
  
  // Project selection state
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(preselectedProjectId || null)
  const [showProjectDropdown, setShowProjectDropdown] = useState(false)
  const [showNewProjectForm, setShowNewProjectForm] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")
  const [newProjectAddress, setNewProjectAddress] = useState("")
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  
  useEffect(() => {
    loadProjects()
  }, [])
  
  useEffect(() => {
    if (preselectedProjectId) {
      setSelectedProjectId(preselectedProjectId)
    }
  }, [preselectedProjectId])
  
  async function loadProjects() {
    const { projects: data } = await getUserProjects()
    setProjects(data || [])
  }
  
  async function handleCreateProject() {
    if (!newProjectName.trim()) return
    setIsCreatingProject(true)
    const { project } = await createProject(newProjectName.trim(), null, newProjectAddress.trim() || null)
    if (project) {
      setProjects([...projects, project])
      setSelectedProjectId(project.id)
      setNewProjectName("")
      setNewProjectAddress("")
      setShowNewProjectForm(false)
    }
    setIsCreatingProject(false)
  }
  
  const selectedProject = projects.find(p => p.id === selectedProjectId)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newUploads: PendingUpload[] = acceptedFiles.map((file) => ({
      id: uuidv4(),
      file,
      preview: URL.createObjectURL(file),
      classification: classifyFromFilename(file.name),
      status: "pending",
    }))
    setUploads((prev) => [...prev, ...newUploads])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".jpg", ".jpeg", ".png", ".webp", ".heic"],
    },
    maxSize: 50 * 1024 * 1024, // 50MB
  })

  function updateClassification(id: string, classification: PhotoClassification) {
    setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, classification } : u)))
  }

  function removeUpload(id: string) {
    setUploads((prev) => {
      const upload = prev.find((u) => u.id === id)
      if (upload) URL.revokeObjectURL(upload.preview)
      return prev.filter((u) => u.id !== id)
    })
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

  async function handleUpload() {
    if (uploads.length === 0) return

    // TEMPORARILY DISABLED: Token checks bypassed for development
    // const pendingUploads = uploads.filter((u) => u.status === "pending")
    // const requiredTokens = pendingUploads.length * TOKEN_COSTS.upload
    // if (requiredTokens > tokenBalance) {
    //   setShowInsufficientTokensWarning(true)
    //   return
    // }

    setIsUploading(true)

    for (const upload of uploads) {
      if (upload.status !== "pending") continue

      setUploads((prev) => prev.map((u) => (u.id === upload.id ? { ...u, status: "uploading" } : u)))

      try {
        // Compress large images before upload (Vercel serverless limit is ~4.5MB)
        const fileSizeMB = upload.file.size / (1024 * 1024)
        let base64: string
        
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

        // Determine proper content type
        let contentType = upload.file.type
        if (!contentType || contentType === "application/octet-stream") {
          const fileExt = upload.file.name.split(".").pop()?.toLowerCase() || "jpg"
          const mimeTypes: Record<string, string> = {
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            png: "image/png",
            webp: "image/webp",
            heic: "image/heic",
          }
          contentType = mimeTypes[fileExt] || "image/jpeg"
        }

        // Create database record via server action (it handles storage upload)
        const { error: dbError } = await uploadImage(
          base64,
          upload.file.name,
          contentType,
          upload.classification,
          selectedProjectId,
        )

        if (dbError) throw new Error(dbError)

        setUploads((prev) => prev.map((u) => (u.id === upload.id ? { ...u, status: "done" } : u)))
      } catch (err) {
        console.error("[v0] Upload error:", err)
        setUploads((prev) =>
          prev.map((u) =>
            u.id === upload.id
              ? {
                  ...u,
                  status: "error",
                  error: err instanceof Error ? err.message : "Upload failed",
                }
              : u,
          ),
        )
      }
    }

    setIsUploading(false)

    // Check if all uploads completed successfully
    const allDone = uploads.every((u) => u.status === "done")
    if (allDone) {
      setTimeout(onComplete, 500)
    }
  }

  const pendingCount = uploads.filter((u) => u.status === "pending").length
  const doneCount = uploads.filter((u) => u.status === "done").length
  const errorCount = uploads.filter((u) => u.status === "error").length
  // TEMPORARILY DISABLED: Token limits bypassed for development
  const requiredTokens = 0 // was: pendingCount * TOKEN_COSTS.upload
  const hasInsufficientTokens = false // was: requiredTokens > tokenBalance

  return (
    <>
      {showInsufficientTokensWarning && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card rounded-2xl p-8 max-w-md w-full">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-white mb-2">Insufficient Tokens</h3>
                <p className="text-slate-300 mb-4">
                  You're trying to upload {pendingCount} photo{pendingCount !== 1 ? "s" : ""} ({requiredTokens} token
                  {requiredTokens !== 1 ? "s" : ""}), but you only have {tokenBalance} token
                  {tokenBalance !== 1 ? "s" : ""} available.
                </p>
                <p className="text-slate-400 text-sm">
                  Please reduce the number of photos or purchase more tokens to continue.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowInsufficientTokensWarning(false)}
                className="flex-1 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium transition-colors"
              >
                Reduce Photos
              </button>
              <button
                onClick={() => {
                  window.open("mailto:support@5starphotos.com?subject=Token Purchase Request", "_blank")
                  setShowInsufficientTokensWarning(false)
                }}
                className="flex-1 px-4 py-3 rounded-xl gradient-magenta-violet text-white font-semibold hover:scale-105 transition-all"
              >
                Buy Tokens
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="glass-card rounded-2xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Upload Photos</h2>
          <button onClick={onCancel} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Project Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Upload to Project (optional)
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowProjectDropdown(!showProjectDropdown)}
              className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-left hover:bg-white/10 transition-colors"
            >
              <span className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-slate-400" />
                <span className={selectedProject ? "text-white" : "text-slate-400"}>
                  {selectedProject ? selectedProject.name : "No project (upload to library)"}
                </span>
              </span>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showProjectDropdown ? "rotate-180" : ""}`} />
            </button>
            
            {showProjectDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 rounded-xl bg-slate-800 border border-white/10 shadow-xl z-20 overflow-hidden">
                <div className="max-h-60 overflow-y-auto">
                  {/* No project option */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProjectId(null)
                      setShowProjectDropdown(false)
                    }}
                    className={`w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-white/5 transition-colors ${
                      !selectedProjectId ? "bg-fuchsia-500/10 text-fuchsia-400" : "text-slate-300"
                    }`}
                  >
                    <FolderOpen className="w-4 h-4" />
                    No project (upload to library)
                  </button>
                  
                  {/* Existing projects */}
                  {projects.map((project) => (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => {
                        setSelectedProjectId(project.id)
                        setShowProjectDropdown(false)
                      }}
                      className={`w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-white/5 transition-colors ${
                        selectedProjectId === project.id ? "bg-fuchsia-500/10 text-fuchsia-400" : "text-slate-300"
                      }`}
                    >
                      <FolderOpen className="w-4 h-4" />
                      <div className="flex-1 min-w-0">
                        <span className="block truncate">{project.name}</span>
                        {project.address && (
                          <span className="block text-xs text-slate-500 truncate">{project.address}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
                
                {/* Create new project */}
                <div className="border-t border-white/10">
                  {showNewProjectForm ? (
                    <div className="p-4 space-y-3">
                      <input
                        type="text"
                        placeholder="Project name"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-fuchsia-500"
                        autoFocus
                      />
                      <input
                        type="text"
                        placeholder="Address (optional)"
                        value={newProjectAddress}
                        onChange={(e) => setNewProjectAddress(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-fuchsia-500"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowNewProjectForm(false)
                            setNewProjectName("")
                            setNewProjectAddress("")
                          }}
                          className="flex-1 px-3 py-2 rounded-lg bg-white/5 text-slate-300 hover:bg-white/10 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleCreateProject}
                          disabled={!newProjectName.trim() || isCreatingProject}
                          className="flex-1 px-3 py-2 rounded-lg bg-fuchsia-500/20 text-fuchsia-400 hover:bg-fuchsia-500/30 transition-colors disabled:opacity-50"
                        >
                          {isCreatingProject ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Create"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowNewProjectForm(true)}
                      className="w-full flex items-center gap-2 px-4 py-3 text-fuchsia-400 hover:bg-fuchsia-500/10 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Create new project
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Dropzone */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            isDragActive ? "border-[#FF3EDB] bg-[#FF3EDB]/10" : "border-white/20 hover:border-white/40"
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <p className="text-white font-medium mb-2">{isDragActive ? "Drop photos here" : "Drag & drop photos here"}</p>
          <p className="text-slate-400 text-sm">or click to browse (JPG, PNG, WebP, HEIC up to 50MB each)</p>
          <p className="text-green-400 text-sm mt-2">Unlimited uploads - development mode</p>
        </div>

        {/* Upload queue */}
        {uploads.length > 0 && (
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-400">
                {uploads.length} photo{uploads.length !== 1 ? "s" : ""} selected
                {doneCount > 0 && ` (${doneCount} uploaded)`}
                {errorCount > 0 && ` (${errorCount} failed)`}
              </p>
              {!isUploading && pendingCount > 0 && (
                <p className="text-sm font-medium text-green-400">
                  Free (development mode)
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {uploads.map((upload) => (
                <div key={upload.id} className="relative bg-white/5 rounded-xl overflow-hidden">
                  {/* Preview image */}
                  <div className="aspect-[4/3] relative">
                    <Image
                      src={upload.preview || "/placeholder.svg"}
                      alt={upload.file.name}
                      fill
                      className="object-cover"
                    />

                    {/* Status overlay */}
                    {upload.status === "uploading" && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-[#FF3EDB] animate-spin" />
                      </div>
                    )}
                    {upload.status === "done" && (
                      <div className="absolute inset-0 bg-green-500/30 flex items-center justify-center">
                        <Check className="w-8 h-8 text-green-400" />
                      </div>
                    )}
                    {upload.status === "error" && (
                      <div className="absolute inset-0 bg-red-500/30 flex items-center justify-center">
                        <AlertCircle className="w-8 h-8 text-red-400" />
                      </div>
                    )}

                    {/* Remove button */}
                    {upload.status === "pending" && (
                      <button
                        onClick={() => removeUpload(upload.id)}
                        className="absolute top-2 right-2 p-1 rounded-full bg-black/60 hover:bg-black/80 transition-colors"
                      >
                        <X className="w-4 h-4 text-white" />
                      </button>
                    )}
                  </div>

                  {/* Classification selector */}
                  {upload.status === "pending" && (
                    <div className="p-2">
                      <div className="flex gap-1">
                        {(
                          [
                            { value: "indoor", icon: Home },
                            { value: "outdoor", icon: Mountain },
                            { value: "unknown", icon: HelpCircle },
                          ] as const
                        ).map(({ value, icon: Icon }) => (
                          <button
                            key={value}
                            onClick={() => updateClassification(upload.id, value)}
                            className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-xs font-medium transition-colors ${
                              upload.classification === value
                                ? value === "indoor"
                                  ? "bg-blue-500/30 text-blue-400"
                                  : value === "outdoor"
                                    ? "bg-green-500/30 text-green-400"
                                    : "bg-slate-500/30 text-slate-400"
                                : "bg-white/5 text-slate-400 hover:bg-white/10"
                            }`}
                          >
                            <Icon className="w-3 h-3" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Error message */}
                  {upload.status === "error" && (
                    <div className="p-2">
                      <p className="text-xs text-red-400 truncate">{upload.error}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Upload button */}
            {pendingCount > 0 && (
              <button
                onClick={handleUpload}
                disabled={isUploading}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all ${
                  hasInsufficientTokens
                    ? "bg-red-500/20 text-red-400 border-2 border-red-500/40 hover:bg-red-500/30"
                    : "gradient-magenta-violet hover:scale-[1.02]"
                }`}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Upload {pendingCount} Photo{pendingCount !== 1 ? "s" : ""} (Free)
                  </>
                )}
              </button>
            )}

            {/* Done button */}
            {pendingCount === 0 && doneCount > 0 && (
              <button
                onClick={onComplete}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-green-500/20 text-green-400 font-semibold hover:bg-green-500/30 transition-colors"
              >
                <Check className="w-4 h-4" />
                Done
              </button>
            )}
          </div>
        )}
      </div>
    </>
  )
}
