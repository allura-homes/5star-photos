"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { 
  X, 
  Link as LinkIcon, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  ImageIcon,
  FolderPlus,
  Home
} from "lucide-react"
import { getUserProjects, createProject } from "@/lib/actions/project-actions"
import type { Project } from "@/lib/types"

interface AirbnbImportModalProps {
  isOpen: boolean
  onClose: () => void
  onImportComplete: () => void
}

type ImportStatus = "idle" | "loading" | "success" | "error"

interface ImportedImage {
  id: string
  url: string
  filename: string
}

export function AirbnbImportModal({ isOpen, onClose, onImportComplete }: AirbnbImportModalProps) {
  const [url, setUrl] = useState("")
  const [status, setStatus] = useState<ImportStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const [importedImages, setImportedImages] = useState<ImportedImage[]>([])
  const [listingTitle, setListingTitle] = useState<string>("")
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [progress, setProgress] = useState<string>("")
  const [showNewProjectInput, setShowNewProjectInput] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")

  useEffect(() => {
    if (isOpen) {
      loadProjects()
    }
  }, [isOpen])

  async function loadProjects() {
    const { projects: loadedProjects } = await getUserProjects()
    setProjects(loadedProjects || [])
  }

  function resetModal() {
    setUrl("")
    setStatus("idle")
    setError(null)
    setImportedImages([])
    setListingTitle("")
    setProgress("")
    setShowNewProjectInput(false)
    setNewProjectName("")
  }
  
  async function handleCreateNewProject() {
    if (!newProjectName.trim()) return
    
    const result = await createProject({ name: newProjectName.trim() })
    if (result.project) {
      setProjects([...projects, result.project])
      setSelectedProjectId(result.project.id)
      setShowNewProjectInput(false)
      setNewProjectName("")
    }
  }

  function handleClose() {
    if (status === "success") {
      onImportComplete()
    }
    resetModal()
    onClose()
  }

  async function handleImport() {
    if (!url.trim()) {
      setError("Please enter an Airbnb URL")
      return
    }

    if (!url.includes("airbnb.com/rooms/")) {
      setError("Please enter a valid Airbnb listing URL (e.g., airbnb.com/rooms/123456)")
      return
    }

    setStatus("loading")
    setError(null)
    setProgress("Connecting to Airbnb...")

    try {
      setProgress("Loading listing page...")
      
      const response = await fetch("/api/import-airbnb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          airbnbUrl: url.trim(),
          projectId: selectedProjectId 
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Import failed")
      }

      setImportedImages(result.images)
      setListingTitle(result.listingTitle || "Airbnb Import")
      setStatus("success")
      setProgress("")

    } catch (err) {
      console.error("Import error:", err)
      setError(err instanceof Error ? err.message : "Failed to import images")
      setStatus("error")
      setProgress("")
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl glass-card-strong border border-white/20 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500">
              <Home className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Import from Airbnb</h2>
              <p className="text-sm text-slate-400">Paste an Airbnb listing URL to import photos</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {status === "idle" || status === "error" ? (
            <div className="space-y-6">
              {/* URL Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-white">Airbnb Listing URL</label>
                <div className="relative">
                  <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => {
                      setUrl(e.target.value)
                      setError(null)
                    }}
                    placeholder="https://www.airbnb.com/rooms/1234567890"
                    className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:border-fuchsia-500/50 focus:ring-1 focus:ring-fuchsia-500/30 focus:outline-none"
                  />
                </div>
                {error && (
                  <div className="flex items-center gap-2 text-sm text-red-400">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </div>
                )}
              </div>

              {/* Project Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-white">Add to Project (Optional)</label>
                {!showNewProjectInput ? (
                  <>
                    <div className="relative">
                      <FolderPlus className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <select
                        value={selectedProjectId || ""}
                        onChange={(e) => {
                          if (e.target.value === "NEW") {
                            setShowNewProjectInput(true)
                          } else {
                            setSelectedProjectId(e.target.value || null)
                          }
                        }}
                        className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:border-fuchsia-500/50 focus:ring-1 focus:ring-fuchsia-500/30 focus:outline-none appearance-none cursor-pointer"
                      >
                        <option value="" className="bg-slate-800">No project</option>
                        <option value="NEW" className="bg-slate-800 text-fuchsia-400">+ Create New Project</option>
                        {projects.map((project) => (
                          <option key={project.id} value={project.id} className="bg-slate-800">
                            {project.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="text-xs text-slate-500">
                      Imported images will be added to the selected project
                    </p>
                  </>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        placeholder="Enter project name..."
                        className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:border-fuchsia-500/50 focus:ring-1 focus:ring-fuchsia-500/30 focus:outline-none"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleCreateNewProject()
                          if (e.key === "Escape") setShowNewProjectInput(false)
                        }}
                      />
                      <button
                        onClick={handleCreateNewProject}
                        disabled={!newProjectName.trim()}
                        className="px-4 py-2 rounded-xl gradient-magenta-violet text-white font-medium disabled:opacity-50"
                      >
                        Create
                      </button>
                      <button
                        onClick={() => {
                          setShowNewProjectInput(false)
                          setNewProjectName("")
                        }}
                        className="px-3 py-2 rounded-xl bg-white/10 text-slate-300 hover:bg-white/20"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <p className="text-xs text-slate-500">
                      Press Enter to create, Escape to cancel
                    </p>
                  </div>
                )}
              </div>

              {/* Info Box */}
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <h4 className="text-sm font-medium text-blue-400 mb-2">How it works</h4>
                <ul className="text-sm text-blue-300/80 space-y-1">
                  <li>1. Paste any Airbnb listing URL</li>
                  <li>2. We&apos;ll extract all listing photos automatically</li>
                  <li>3. Images are saved to your library for transformation</li>
                </ul>
              </div>
            </div>
          ) : status === "loading" ? (
            <div className="py-12 text-center">
              <Loader2 className="w-12 h-12 text-fuchsia-500 animate-spin mx-auto mb-4" />
              <p className="text-white font-medium mb-2">Importing photos...</p>
              <p className="text-sm text-slate-400">{progress}</p>
              <p className="text-xs text-slate-500 mt-4">This may take 15-30 seconds</p>
            </div>
          ) : status === "success" ? (
            <div className="space-y-6">
              {/* Success Header */}
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-1">Import Complete!</h3>
                <p className="text-sm text-slate-400">
                  {importedImages.length} photos imported from &quot;{listingTitle}&quot;
                </p>
              </div>

              {/* Image Grid Preview */}
              {importedImages.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-white flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-fuchsia-400" />
                    Imported Photos
                  </h4>
                  <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">
                    {importedImages.map((image, index) => (
                      <div
                        key={image.id}
                        className="relative aspect-square rounded-lg overflow-hidden bg-white/5"
                      >
                        <Image
                          src={image.url}
                          alt={`Imported image ${index + 1}`}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-white/10">
          {status === "idle" || status === "error" ? (
            <>
              <button
                onClick={handleClose}
                className="px-4 py-2 rounded-xl text-slate-300 hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={!url.trim()}
                className="px-6 py-2 rounded-xl gradient-magenta-violet text-white font-medium hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100"
              >
                Import Photos
              </button>
            </>
          ) : status === "loading" ? (
            <button
              disabled
              className="px-6 py-2 rounded-xl bg-white/10 text-slate-400 cursor-not-allowed"
            >
              Importing...
            </button>
          ) : (
            <>
              <button
                onClick={resetModal}
                className="px-4 py-2 rounded-xl text-slate-300 hover:bg-white/10 transition-colors"
              >
                Import Another
              </button>
              <button
                onClick={handleClose}
                className="px-6 py-2 rounded-xl gradient-magenta-violet text-white font-medium hover:scale-105 transition-all"
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
