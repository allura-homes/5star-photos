"use client"

import type React from "react"

import { useState } from "react"
import { Sidebar } from "./sidebar"
import { Camera, Upload, Sparkles, Palette, Crop, Eraser } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ProcessingStatus = "idle" | "processing" | "complete"

export function QuickEnhance() {
  const [files, setFiles] = useState<File[]>([])
  const [status, setStatus] = useState<ProcessingStatus>("idle")

  const tasks = [
    { id: "lighting", icon: Sparkles, label: "Lighting & Color", status: "Ready" },
    { id: "composition", icon: Crop, label: "Composition", status: "Ready" },
    { id: "sky", icon: Palette, label: "Sky & Grounds", status: "Ready" },
    { id: "cleanup", icon: Eraser, label: "Cleanup", status: "Ready" },
  ]

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    setFiles(selectedFiles.slice(0, 10))
  }

  const handleStartEnhance = () => {
    setStatus("processing")
    // Simulate processing
    setTimeout(() => {
      setStatus("complete")
    }, 3000)
  }

  return (
    <div className="relative min-h-screen gradient-purple-teal overflow-hidden">
      <Sidebar currentPage="quick-enhance" />

      {/* Main Content */}
      <div className="ml-20 min-h-screen p-8 flex flex-col items-center justify-center">
        {/* Header */}
        <div className="text-center mb-12 space-y-3">
          <h1 className="text-5xl font-bold text-balance">Welcome to 5star.photos</h1>
          <p className="text-xl text-foreground/80 text-pretty max-w-2xl mx-auto">
            Give your STR photos a 5-star makeover in one click.
          </p>
        </div>

        {/* Hero Card */}
        <div className="glass-card-strong rounded-[2rem] p-12 max-w-4xl w-full shadow-2xl mb-8">
          {/* Icon */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary to-secondary rounded-full blur-3xl opacity-50"></div>
              <div className="relative w-48 h-48 bg-gradient-to-br from-primary via-accent to-secondary rounded-full flex items-center justify-center shadow-2xl">
                <Camera className="w-24 h-24 text-white" strokeWidth={1.5} />
              </div>
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-8">
            <h2 className="text-4xl font-bold mb-3">Quick Enhance</h2>
            <p className="text-lg text-foreground/70 text-pretty max-w-xl mx-auto">
              Upload your photos and let 5star.photos fix lighting, color, and composition automatically.
            </p>
          </div>

          {/* Upload Area */}
          <div className="glass-card rounded-3xl p-8 mb-6">
            <h3 className="text-xl font-semibold mb-4">Add photos</h3>
            <label className="block">
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/heic"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="border-2 border-dashed border-white/20 rounded-2xl p-12 text-center cursor-pointer hover:border-white/40 hover:bg-white/5 transition-all duration-200">
                <Upload className="w-12 h-12 mx-auto mb-4 text-foreground/50" />
                <p className="text-lg mb-2">Drop up to 10 photos here, or click to browse.</p>
                <p className="text-sm text-foreground/50">JPG, PNG, HEIC · Max 10MB each</p>
              </div>
            </label>

            {files.length > 0 && (
              <div className="mt-4 text-sm text-foreground/70">
                {files.length} file{files.length > 1 ? "s" : ""} selected
              </div>
            )}
          </div>

          {/* Task Cards */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            {tasks.map((task) => {
              const Icon = task.icon
              return (
                <div key={task.id} className="glass-card rounded-2xl p-4 text-center">
                  <Icon className="w-8 h-8 mx-auto mb-2 text-primary" />
                  <p className="text-sm font-medium mb-1">{task.label}</p>
                  <p className="text-xs text-foreground/50">{task.status}</p>
                </div>
              )
            })}
          </div>

          {/* CTA Button */}
          <div className="flex justify-center">
            <Button
              onClick={handleStartEnhance}
              disabled={files.length === 0 || status === "processing"}
              size="lg"
              className={cn(
                "h-20 w-20 rounded-full text-lg font-semibold shadow-2xl transition-all duration-300",
                files.length > 0 && status === "idle"
                  ? "bg-gradient-to-br from-[#ff3edb] to-[#b44aff] hover:scale-105 glow-button"
                  : "bg-muted text-muted-foreground cursor-not-allowed",
              )}
            >
              {status === "processing" ? <div className="animate-spin">⚡</div> : "Start"}
            </Button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-sm text-foreground/50 text-center">
          Made for Airbnb and STR hosts. No login required for this preview version.
        </p>
      </div>
    </div>
  )
}
