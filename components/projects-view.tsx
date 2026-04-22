"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { getUserProjects, createProject, deleteProject } from "@/lib/actions/project-actions"
import type { Project } from "@/lib/types"
import {
  Loader2,
  Plus,
  FolderOpen,
  Trash2,
  MoreVertical,
  ImageIcon,
  MapPin,
  X,
} from "lucide-react"

interface ProjectsViewProps {
  onNewProject?: () => void
}

export function ProjectsView({ onNewProject }: ProjectsViewProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [showNewProjectModal, setShowNewProjectModal] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")
  const [newProjectAddress, setNewProjectAddress] = useState("")
  const [newProjectDescription, setNewProjectDescription] = useState("")

  useEffect(() => {
    loadProjects()
  }, [])

  async function loadProjects() {
    setIsLoading(true)
    const { projects: data, error } = await getUserProjects()
    if (!error) {
      setProjects(data)
    }
    setIsLoading(false)
  }

  async function handleCreateProject() {
    if (!newProjectName.trim()) return

    setIsCreating(true)
    const { project, error } = await createProject({
      name: newProjectName.trim(),
      address: newProjectAddress.trim() || undefined,
      description: newProjectDescription.trim() || undefined,
    })

    if (project && !error) {
      setProjects([project, ...projects])
      setShowNewProjectModal(false)
      setNewProjectName("")
      setNewProjectAddress("")
      setNewProjectDescription("")
    }
    setIsCreating(false)
  }

  async function handleDeleteProject(projectId: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    
    if (!confirm("Delete this project? Photos will be moved to your library (not deleted).")) {
      return
    }

    setMenuOpenId(null)
    const { success } = await deleteProject(projectId)
    if (success) {
      setProjects(projects.filter((p) => p.id !== projectId))
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-fuchsia-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* New Project Button */}
      <button
        onClick={() => setShowNewProjectModal(true)}
        className="w-full py-4 rounded-xl border-2 border-dashed border-white/20 hover:border-fuchsia-500/50 bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center gap-2 text-slate-300 hover:text-white"
      >
        <Plus className="w-5 h-5" />
        <span className="font-medium">New Project</span>
      </button>

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <div className="text-center py-12">
          <FolderOpen className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Projects Yet</h3>
          <p className="text-slate-400 max-w-md mx-auto">
            Create your first project to organize photos by property. Projects help you keep your real estate listings organized.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/library/projects/${project.id}`}
              className="group relative rounded-xl overflow-hidden bg-slate-800/50 border border-white/10 hover:border-fuchsia-500/50 transition-all hover:scale-[1.02]"
            >
              {/* Cover Image */}
              <div className="aspect-[4/3] relative bg-slate-700/50">
                {project.cover_image_url ? (
                  <Image
                    src={project.cover_image_url}
                    alt={project.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <FolderOpen className="w-12 h-12 text-slate-500" />
                  </div>
                )}
                
                {/* Overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                {/* Menu Button */}
                <div className="absolute top-2 right-2 z-10">
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setMenuOpenId(menuOpenId === project.id ? null : project.id)
                    }}
                    className="p-1.5 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {menuOpenId === project.id && (
                    <div className="absolute right-0 mt-1 w-36 rounded-lg bg-slate-800 border border-white/10 shadow-xl py-1 z-20">
                      <button
                        onClick={(e) => handleDeleteProject(project.id, e)}
                        className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Project
                      </button>
                    </div>
                  )}
                </div>

                {/* Project Info */}
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <h3 className="font-semibold text-white truncate">{project.name}</h3>
                  {project.address && (
                    <p className="text-xs text-slate-300 truncate flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" />
                      {project.address}
                    </p>
                  )}
                  <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
                    <ImageIcon className="w-3 h-3" />
                    {project.image_count} photo{project.image_count !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* New Project Modal */}
      {showNewProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-2xl border border-white/10 shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">New Project</h2>
              <button
                onClick={() => setShowNewProjectModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Project Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g., 123 Main Street Listing"
                  className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-fuchsia-500/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Address
                </label>
                <input
                  type="text"
                  value={newProjectAddress}
                  onChange={(e) => setNewProjectAddress(e.target.value)}
                  placeholder="e.g., 123 Main St, City, State"
                  className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-fuchsia-500/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Description
                </label>
                <textarea
                  value={newProjectDescription}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                  placeholder="Optional notes about this property..."
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-fuchsia-500/50 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowNewProjectModal(false)}
                className="flex-1 py-2.5 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProject}
                disabled={!newProjectName.trim() || isCreating}
                className="flex-1 py-2.5 rounded-lg gradient-magenta-violet text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreating ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </span>
                ) : (
                  "Create Project"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
