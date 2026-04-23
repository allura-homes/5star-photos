"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import {
  X,
  Sun,
  Moon,
  Home,
  TreePine,
  Sparkles,
  Move,
  Eraser,
  Square,
  Loader2,
  ChevronDown,
  ChevronUp,
  Save,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import type { EnhancementPreferences, ClassifiedPhoto, PhotoClassification, ZoomPreset } from "@/lib/types"
import { DEFAULT_ENHANCEMENT_PREFERENCES } from "@/lib/types"
import { cn } from "@/lib/utils"

const PREFERENCES_STORAGE_KEY = "5star_enhancement_defaults"

interface EnhancementPreferencesModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (preferences: EnhancementPreferences, classifiedPhotos: ClassifiedPhoto[]) => void
  files: File[]
}

// Classify photos based on filename patterns and common naming conventions
function classifyPhoto(file: File): PhotoClassification {
  const name = file.name.toLowerCase()

  // Common outdoor indicators
  const outdoorPatterns = [
    "exterior",
    "front",
    "back",
    "yard",
    "garden",
    "pool",
    "patio",
    "deck",
    "driveway",
    "garage",
    "outdoor",
    "outside",
    "lawn",
    "facade",
    "curb",
    "street",
    "aerial",
    "drone",
    "ext",
    "view",
    "landscape",
  ]

  // Common indoor indicators - expanded to include common real estate photo naming
  const indoorPatterns = [
    "interior",
    "kitchen",
    "bedroom",
    "bathroom",
    "living",
    "dining",
    "office",
    "basement",
    "attic",
    "closet",
    "laundry",
    "indoor",
    "inside",
    "room",
    "foyer",
    "entry",
    "hallway",
    "master",
    "int",
    "bed",
    "bath",
    "kit",
    "lr", // living room
    "dr", // dining room
    "br", // bedroom
    "mb", // master bedroom
    "mba", // master bath
    "fam", // family room
    "den",
    "study",
    "bonus",
    "loft",
    "stair",
    "ceiling",
    "floor",
    "wall",
    "window",
    "fireplace",
  ]

  for (const pattern of outdoorPatterns) {
    if (name.includes(pattern)) return "outdoor"
  }

  for (const pattern of indoorPatterns) {
    if (name.includes(pattern)) return "indoor"
  }

  // Generic camera filenames (IMG_, DSC_, etc.) could be either indoor or outdoor
  // Let users manually classify them rather than assuming indoor
  return "unknown"
}

// Load saved preferences from localStorage
function loadSavedPreferences(): EnhancementPreferences | null {
  if (typeof window === "undefined") return null
  try {
    const saved = localStorage.getItem(PREFERENCES_STORAGE_KEY)
    if (saved) {
      return JSON.parse(saved)
    }
  } catch (e) {
    console.error("Failed to load saved preferences:", e)
  }
  return null
}

// Save preferences to localStorage
function savePreferences(preferences: EnhancementPreferences) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences))
  } catch (e) {
    console.error("Failed to save preferences:", e)
  }
}

export function EnhancementPreferencesModal({ isOpen, onClose, onConfirm, files }: EnhancementPreferencesModalProps) {
  const [preferences, setPreferences] = useState<EnhancementPreferences>(DEFAULT_ENHANCEMENT_PREFERENCES)
  const [classifiedPhotos, setClassifiedPhotos] = useState<ClassifiedPhoto[]>([])
  const [thumbnailsLoading, setThumbnailsLoading] = useState(true)
  const [showPhotoList, setShowPhotoList] = useState(false)

  // Classify photos and generate thumbnails on mount
  useEffect(() => {
    if (!isOpen || files.length === 0) return

    // Load saved preferences
    const saved = loadSavedPreferences()
    if (saved) {
      setPreferences({ ...saved, saveAsDefaults: false })
    }

    setThumbnailsLoading(true)

    const classified: ClassifiedPhoto[] = []
    let completed = 0

    files.forEach((file) => {
      const classification = classifyPhoto(file)
      const reader = new FileReader()

      reader.onload = () => {
        classified.push({
          file,
          classification,
          thumbnailUrl: reader.result as string,
        })

        completed++
        if (completed === files.length) {
          setClassifiedPhotos(classified)
          setThumbnailsLoading(false)
        }
      }

      reader.onerror = () => {
        classified.push({
          file,
          classification,
          thumbnailUrl: "",
        })

        completed++
        if (completed === files.length) {
          setClassifiedPhotos(classified)
          setThumbnailsLoading(false)
        }
      }

      reader.readAsDataURL(file)
    })
  }, [isOpen, files])

  // Count photos by classification
  const { indoorCount, outdoorCount, unknownCount } = useMemo(() => {
    let indoor = 0,
      outdoor = 0,
      unknown = 0
    classifiedPhotos.forEach((p) => {
      const cls = p.userOverride || p.classification
      if (cls === "indoor") indoor++
      else if (cls === "outdoor") outdoor++
      else unknown++
    })
    return { indoorCount: indoor, outdoorCount: outdoor, unknownCount: unknown }
  }, [classifiedPhotos])

  const hasOutdoor = outdoorCount > 0 || unknownCount > 0
  const hasIndoor = indoorCount > 0 || unknownCount > 0

  // Toggle classification override for a photo
  const toggleClassification = (index: number) => {
    setClassifiedPhotos((prev) => {
      const updated = [...prev]
      const current = updated[index].userOverride || updated[index].classification
      const next: PhotoClassification = current === "indoor" ? "outdoor" : current === "outdoor" ? "unknown" : "indoor"
      updated[index] = { ...updated[index], userOverride: next }
      return updated
    })
  }

  const handleConfirm = () => {
    if (preferences.saveAsDefaults) {
      savePreferences(preferences)
    }
    onConfirm(preferences, classifiedPhotos)
  }

  const updatePreference = <K extends keyof EnhancementPreferences>(key: K, value: EnhancementPreferences[K]) => {
    setPreferences((prev) => ({ ...prev, [key]: value }))
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: "spring", duration: 0.3 }}
          className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#1a1a2e] border border-white/10 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 bg-[#1a1a2e] border-b border-white/10 p-6 pb-4">
            <button
              onClick={onClose}
              className="absolute right-4 top-4 p-2 rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="h-5 w-5 text-white/60" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-fuchsia-500/20 to-violet-500/20">
                <Sparkles className="h-6 w-6 text-fuchsia-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Enhancement Preferences</h2>
                <p className="text-sm text-white/60">
                  Configure how your {files.length} photo{files.length !== 1 ? "s" : ""} will be enhanced
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Photo Classification Summary */}
            <div className="space-y-3">
              <button
                onClick={() => setShowPhotoList(!showPhotoList)}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Home className="h-4 w-4 text-blue-400" />
                    <span className="text-white/80">{indoorCount} Indoor</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <TreePine className="h-4 w-4 text-green-400" />
                    <span className="text-white/80">{outdoorCount} Outdoor</span>
                  </div>
                  {unknownCount > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-amber-400">?</span>
                      <span className="text-white/80">{unknownCount} Unknown</span>
                    </div>
                  )}
                </div>
                {showPhotoList ? (
                  <ChevronUp className="h-4 w-4 text-white/60" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-white/60" />
                )}
              </button>

              {/* Photo Thumbnails with Classification */}
              <AnimatePresence>
                {showPhotoList && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 p-3 rounded-xl bg-white/5">
                      {thumbnailsLoading ? (
                        <div className="col-span-full flex items-center justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin text-white/60" />
                        </div>
                      ) : (
                        classifiedPhotos.map((photo, index) => {
                          const cls = photo.userOverride || photo.classification
                          return (
                            <button
                              key={index}
                              onClick={() => toggleClassification(index)}
                              className="relative aspect-square rounded-lg overflow-hidden group"
                              title={`${photo.file.name} - Click to change classification`}
                            >
                              {photo.thumbnailUrl ? (
                                <img
                                  src={photo.thumbnailUrl || "/placeholder.svg"}
                                  alt={photo.file.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-white/10" />
                              )}
                              <div
                                className={cn(
                                  "absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity",
                                )}
                              />
                              <div
                                className={cn(
                                  "absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
                                  cls === "indoor" && "bg-blue-500/90 text-white",
                                  cls === "outdoor" && "bg-green-500/90 text-white",
                                  cls === "unknown" && "bg-amber-500/90 text-white",
                                )}
                              >
                                {cls === "indoor" ? "IN" : cls === "outdoor" ? "OUT" : "?"}
                              </div>
                            </button>
                          )
                        })
                      )}
                    </div>
                    <p className="text-xs text-white/40 mt-2 text-center">
                      Click thumbnails to change indoor/outdoor classification
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Outdoor Options */}
            {hasOutdoor && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <TreePine className="h-4 w-4 text-green-400" />
                  <h3 className="text-sm font-medium text-white/90">Outdoor Enhancements</h3>
                </div>

                <div className="grid gap-3">
                  {/* Sky Replacement */}
                  <div className="space-y-2">
                    <label className="text-sm text-white/70">Sky Replacement</label>
                    <div className="grid grid-cols-5 gap-2">
                      {[
                        { value: "none", label: "None", icon: null },
                        { value: "clear_blue", label: "Clear Blue", icon: "☀️" },
                        { value: "dramatic_clouds", label: "Dramatic", icon: "⛅" },
                        { value: "golden_hour", label: "Golden", icon: "🌅" },
                        { value: "twilight", label: "Twilight", icon: "🌆" },
                      ].map((option) => (
                        <button
                          key={option.value}
                          onClick={() => updatePreference("skyReplacement", option.value as any)}
                          className={cn(
                            "p-2 rounded-lg text-xs text-center transition-all",
                            preferences.skyReplacement === option.value
                              ? "bg-gradient-to-br from-fuchsia-500/30 to-violet-500/30 border border-fuchsia-500/50 text-white"
                              : "bg-white/5 border border-white/10 text-white/70 hover:bg-white/10",
                          )}
                        >
                          {option.icon && <span className="block text-lg mb-1">{option.icon}</span>}
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Virtual Twilight Toggle */}
                  <ToggleOption
                    label="Virtual Twilight"
                    description="Transform daytime to dramatic dusk"
                    icon={<Moon className="h-4 w-4" />}
                    checked={preferences.virtualTwilight}
                    onChange={(v) => updatePreference("virtualTwilight", v)}
                  />

                  {/* Enhance Lawn Toggle */}
                  <ToggleOption
                    label="Enhance Lawn & Garden"
                    description="Make grass greener and plants fuller"
                    icon={<TreePine className="h-4 w-4" />}
                    checked={preferences.enhanceLawn}
                    onChange={(v) => updatePreference("enhanceLawn", v)}
                  />
                </div>
              </div>
            )}

            {/* Indoor Options */}
            {hasIndoor && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Home className="h-4 w-4 text-blue-400" />
                  <h3 className="text-sm font-medium text-white/90">Indoor Enhancements</h3>
                </div>

                <div className="grid gap-3">
                  {/* Window Balance Toggle */}
                  <ToggleOption
                    label="Window Balance"
                    description="Fix blown-out windows and balance lighting"
                    icon={<Sun className="h-4 w-4" />}
                    checked={preferences.windowBalance}
                    onChange={(v) => updatePreference("windowBalance", v)}
                  />

                  {/* Declutter Toggle */}
                  <ToggleOption
                    label="Declutter"
                    description="Remove minor distractions and clutter"
                    icon={<Eraser className="h-4 w-4" />}
                    checked={preferences.declutter}
                    onChange={(v) => updatePreference("declutter", v)}
                  />
                </div>
              </div>
            )}

            {/* Universal Options */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-fuchsia-400" />
                <h3 className="text-sm font-medium text-white/90">Universal Enhancements</h3>
              </div>

              <div className="grid gap-3">
                {/* Straighten Verticals Toggle */}
                <ToggleOption
                  label="Straighten Verticals"
                  description="Auto-correct tilted walls and doorframes"
                  icon={<Square className="h-4 w-4" />}
                  checked={preferences.straightenVerticals}
                  onChange={(v) => updatePreference("straightenVerticals", v)}
                />

                {/* Zoom Out Presets */}
                <div className="space-y-2">
                  <label className="text-sm text-white/70 flex items-center gap-2">
                    <Move className="h-4 w-4" />
                    Zoom Out / Expand View
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { value: "none", label: "None", desc: "Keep as-is" },
                      { value: "slight", label: "Slight", desc: "5-10%" },
                      { value: "moderate", label: "Moderate", desc: "15-25%" },
                      { value: "significant", label: "Significant", desc: "30%+" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => updatePreference("zoomOut", option.value as ZoomPreset)}
                        className={cn(
                          "p-3 rounded-lg text-center transition-all",
                          preferences.zoomOut === option.value
                            ? "bg-gradient-to-br from-fuchsia-500/30 to-violet-500/30 border border-fuchsia-500/50"
                            : "bg-white/5 border border-white/10 hover:bg-white/10",
                        )}
                      >
                        <span
                          className={cn(
                            "block text-sm font-medium",
                            preferences.zoomOut === option.value ? "text-white" : "text-white/70",
                          )}
                        >
                          {option.label}
                        </span>
                        <span className="block text-xs text-white/50 mt-0.5">{option.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Save as Defaults */}
            <div className="pt-4 border-t border-white/10">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.saveAsDefaults}
                  onChange={(e) => updatePreference("saveAsDefaults", e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 text-fuchsia-500 focus:ring-fuchsia-500/50"
                />
                <div className="flex items-center gap-2">
                  <Save className="h-4 w-4 text-white/60" />
                  <span className="text-sm text-white/70">Save as my default preferences</span>
                </div>
              </label>
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-[#1a1a2e] border-t border-white/10 p-6 pt-4">
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 rounded-xl border border-white/20 text-white/80 hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-500 text-white font-medium hover:from-fuchsia-600 hover:to-violet-600 transition-all flex items-center justify-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Enhance {files.length} Photo{files.length !== 1 ? "s" : ""}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// Toggle Option Component
interface ToggleOptionProps {
  label: string
  description: string
  icon: React.ReactNode
  checked: boolean
  onChange: (checked: boolean) => void
}

function ToggleOption({ label, description, icon, checked, onChange }: ToggleOptionProps) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        "w-full flex items-center gap-4 p-3 rounded-xl transition-all text-left",
        checked
          ? "bg-gradient-to-br from-fuchsia-500/20 to-violet-500/20 border border-fuchsia-500/30"
          : "bg-white/5 border border-white/10 hover:bg-white/10",
      )}
    >
      <div
        className={cn("p-2 rounded-lg", checked ? "bg-fuchsia-500/30 text-fuchsia-300" : "bg-white/10 text-white/60")}
      >
        {icon}
      </div>
      <div className="flex-1">
        <span className={cn("block text-sm font-medium", checked ? "text-white" : "text-white/80")}>{label}</span>
        <span className="block text-xs text-white/50">{description}</span>
      </div>
      <div
        className={cn(
          "w-10 h-6 rounded-full transition-all relative",
          checked ? "bg-gradient-to-r from-fuchsia-500 to-violet-500" : "bg-white/20",
        )}
      >
        <div
          className={cn("absolute top-1 w-4 h-4 rounded-full bg-white transition-all", checked ? "left-5" : "left-1")}
        />
      </div>
    </button>
  )
}
