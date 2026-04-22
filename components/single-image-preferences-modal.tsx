"use client"

import type React from "react"
import { useState, useEffect } from "react"
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
  Save,
  Settings2,
  Upload,
  ImageIcon,
  Trash2,
  Loader2,
} from "lucide-react"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import type { EnhancementPreferences, PhotoClassification, ZoomPreset, ColorTemperature } from "@/lib/types"
import { DEFAULT_ENHANCEMENT_PREFERENCES } from "@/lib/types"
import { cn } from "@/lib/utils"

const PREFERENCES_STORAGE_KEY = "5star_enhancement_defaults"

interface SingleImagePreferencesModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (preferences: EnhancementPreferences) => void
  classification: PhotoClassification
  imageName: string
  initialPreferences?: EnhancementPreferences
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

export function SingleImagePreferencesModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  classification,
  imageName,
  initialPreferences
}: SingleImagePreferencesModalProps) {
  const [preferences, setPreferences] = useState<EnhancementPreferences>(DEFAULT_ENHANCEMENT_PREFERENCES)
  const [isUploadingRef, setIsUploadingRef] = useState(false)
  const [refImagePreview, setRefImagePreview] = useState<string | null>(null)

  // Load preferences on open: prioritize passed initialPreferences (for preserving custom instructions),
  // then fall back to saved localStorage preferences, then defaults
  useEffect(() => {
    if (!isOpen) return
    
    if (initialPreferences) {
      // Use the passed preferences (preserves additionalInstructions from parent)
      setPreferences({ ...initialPreferences, saveAsDefaults: false })
      console.log("[v0] Modal loaded with initialPreferences, additionalInstructions:", initialPreferences.additionalInstructions || "(none)")
    } else {
      // Fall back to localStorage
      const saved = loadSavedPreferences()
      if (saved) {
        setPreferences({ ...saved, saveAsDefaults: false })
      }
    }
  }, [isOpen, initialPreferences])

  const hasOutdoor = classification === "outdoor" || classification === "unknown"
  const hasIndoor = classification === "indoor" || classification === "unknown"

  const handleConfirm = () => {
    console.log("[v0] Modal confirming with additionalInstructions:", preferences.additionalInstructions || "(none)")
    if (preferences.saveAsDefaults) {
      savePreferences(preferences)
    }
    onConfirm(preferences)
    onClose()
  }

  const updatePreference = <K extends keyof EnhancementPreferences>(key: K, value: EnhancementPreferences[K]) => {
    setPreferences((prev) => ({ ...prev, [key]: value }))
  }

  const handleReferenceImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploadingRef(true)
    
    // Create a preview immediately
    const reader = new FileReader()
    reader.onload = (event) => {
      setRefImagePreview(event.target?.result as string)
    }
    reader.readAsDataURL(file)

    try {
      // Upload to blob storage
      const formData = new FormData()
      formData.append("file", file)
      formData.append("folder", "reference-images")

      const response = await fetch("/api/upload-reference", {
        method: "POST",
        body: formData,
      })

      if (response.ok) {
        const { url } = await response.json()
        updatePreference("referenceImageUrl", url)
      }
    } catch (error) {
      console.error("Failed to upload reference image:", error)
    } finally {
      setIsUploadingRef(false)
    }
  }

  const removeReferenceImage = () => {
    setRefImagePreview(null)
    updatePreference("referenceImageUrl", undefined)
    updatePreference("referenceImageDescription", undefined)
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
                <Settings2 className="h-6 w-6 text-fuchsia-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Enhancement Options</h2>
                <p className="text-sm text-white/60">
                  Customize how {imageName} will be enhanced
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Photo Classification Badge */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
              <div className="flex items-center gap-2 text-sm">
                {classification === "indoor" ? (
                  <>
                    <Home className="h-4 w-4 text-blue-400" />
                    <span className="text-white/80">Indoor Photo</span>
                  </>
                ) : classification === "outdoor" ? (
                  <>
                    <TreePine className="h-4 w-4 text-green-400" />
                    <span className="text-white/80">Outdoor Photo</span>
                  </>
                ) : (
                  <>
                    <span className="text-amber-400">?</span>
                    <span className="text-white/80">Unknown - All options available</span>
                  </>
                )}
              </div>
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

                  {/* Color Temperature Slider */}
                  <div className="space-y-2">
                    <label className="text-sm text-white/70 flex items-center gap-2">
                      <Sun className="h-4 w-4" />
                      Color Temperature
                    </label>
                    <div className="grid grid-cols-5 gap-2">
                      {[
                        { value: 2500 as ColorTemperature, label: "2500K", desc: "Warm" },
                        { value: 3000 as ColorTemperature, label: "3000K", desc: "Soft" },
                        { value: 3500 as ColorTemperature, label: "3500K", desc: "Neutral" },
                        { value: 4000 as ColorTemperature, label: "4000K", desc: "Bright" },
                        { value: 4500 as ColorTemperature, label: "4500K", desc: "Daylight" },
                      ].map((option) => (
                        <button
                          key={option.value}
                          onClick={() => updatePreference("colorTemperature", option.value)}
                          className={cn(
                            "p-2 rounded-lg text-center transition-all",
                            preferences.colorTemperature === option.value
                              ? "bg-gradient-to-br from-fuchsia-500/30 to-violet-500/30 border border-fuchsia-500/50"
                              : "bg-white/5 border border-white/10 hover:bg-white/10",
                          )}
                        >
                          <span
                            className={cn(
                              "block text-sm font-medium",
                              preferences.colorTemperature === option.value ? "text-white" : "text-white/70",
                            )}
                          >
                            {option.label}
                          </span>
                          <span className="block text-xs text-white/50 mt-0.5">{option.desc}</span>
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-white/40">
                      Lower = warmer/softer tones, Higher = cooler/daylight tones
                    </p>
                  </div>
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

            {/* Additional Instructions */}
            <div className="space-y-3 pt-4 border-t border-white/10">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-fuchsia-400" />
                <span className="text-sm font-medium text-white">Additional Instructions</span>
              </div>
              <p className="text-xs text-white/50">
                Provide custom instructions for the AI art director (e.g., &quot;remove people from the photo&quot; or &quot;make the sky more dramatic&quot;)
              </p>
              <textarea
                value={preferences.additionalInstructions || ""}
                onChange={(e) => updatePreference("additionalInstructions", e.target.value)}
                placeholder="Enter any specific enhancement requests..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:border-fuchsia-500/50 focus:ring-1 focus:ring-fuchsia-500/30 focus:outline-none resize-none text-sm"
              />
            </div>

            {/* Reference Image Upload */}
            <div className="space-y-3 pt-4 border-t border-white/10">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-fuchsia-400" />
                <span className="text-sm font-medium text-white">Reference Image (Optional)</span>
              </div>
              <p className="text-xs text-white/50">
                Upload an image to guide the AI. For example, show the style of furniture, decor, or look you want to achieve.
              </p>
              
              {refImagePreview || preferences.referenceImageUrl ? (
                <div className="space-y-3">
                  {/* Preview */}
                  <div className="relative rounded-xl overflow-hidden bg-black/20 border border-white/10">
                    <div className="relative aspect-video">
                      <Image
                        src={refImagePreview || preferences.referenceImageUrl || ""}
                        alt="Reference image"
                        fill
                        className="object-contain"
                      />
                      {isUploadingRef && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                          <Loader2 className="w-6 h-6 text-fuchsia-400 animate-spin" />
                        </div>
                      )}
                    </div>
                    <button
                      onClick={removeReferenceImage}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-red-500/80 transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-white" />
                    </button>
                  </div>
                  
                  {/* Description for the reference image */}
                  <div>
                    <label className="text-xs text-white/60 mb-1 block">
                      Describe what you want from this reference:
                    </label>
                    <input
                      type="text"
                      value={preferences.referenceImageDescription || ""}
                      onChange={(e) => updatePreference("referenceImageDescription", e.target.value)}
                      placeholder="e.g., Use this style of bedframe, Match this color palette..."
                      className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:border-fuchsia-500/50 focus:ring-1 focus:ring-fuchsia-500/30 focus:outline-none text-sm"
                    />
                  </div>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 border-dashed border-white/20 hover:border-fuchsia-500/50 cursor-pointer transition-colors bg-white/5 hover:bg-white/10">
                  <Upload className="h-8 w-8 text-white/40" />
                  <div className="text-center">
                    <span className="text-sm text-white/70">Click to upload a reference image</span>
                    <p className="text-xs text-white/40 mt-1">JPG, PNG up to 10MB</p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleReferenceImageUpload}
                    className="hidden"
                  />
                </label>
              )}
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
                Transform with Options
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
