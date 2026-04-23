"use client"

import { useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { Upload, FileImage, X, Sparkles } from "lucide-react"

interface UploadCardProps {
  files: File[]
  setFiles: (files: File[]) => void
  googleDriveLink: string
  setGoogleDriveLink: (link: string) => void
  onEnhance: () => void
  isProcessing: boolean
  processingStage: string
}

export function UploadCard({
  files,
  setFiles,
  googleDriveLink,
  setGoogleDriveLink,
  onEnhance,
  isProcessing,
  processingStage,
}: UploadCardProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const validFiles = acceptedFiles.filter((file) => {
        const isValidType = ["image/jpeg", "image/png", "image/heic"].includes(file.type)
        const isValidSize = file.size <= 10 * 1024 * 1024 // 10MB
        return isValidType && isValidSize
      })

      setFiles([...files, ...validFiles].slice(0, 10))
    },
    [files, setFiles],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/heic": [".heic"],
    },
    maxFiles: 10,
    disabled: isProcessing,
  })

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index))
  }

  return (
    <div className="glass-card rounded-3xl p-8 mb-6">
      <h2 className="text-2xl font-semibold text-white mb-6">Add photos</h2>

      {/* Drag and drop zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 cursor-pointer ${
          isDragActive ? "border-[#FF3EDB] bg-[#FF3EDB]/10" : "border-white/20 hover:border-white/40 hover:bg-white/5"
        } ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <input {...getInputProps()} />
        <Upload className="w-12 h-12 mx-auto mb-4 text-[#C9CCDA]" />
        <p className="text-lg text-white mb-2">{isDragActive ? "Drop photos here..." : "Drag & drop photos here"}</p>
        <p className="text-sm text-[#C9CCDA]">or click to browse • Up to 10 photos • JPG, PNG, HEIC • Max 10MB each</p>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="mt-6">
          <p className="text-sm text-[#C9CCDA] mb-3">
            {files.length} photo{files.length > 1 ? "s" : ""} selected
          </p>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
            {files.map((file, index) => (
              <div key={index} className="flex items-center gap-3 glass-card rounded-xl p-3">
                <FileImage className="w-5 h-5 text-[#16B2A5]" />
                <span className="flex-1 text-white text-sm truncate">{file.name}</span>
                <span className="text-xs text-[#C9CCDA]">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                <button
                  onClick={() => removeFile(index)}
                  className="text-[#C9CCDA] hover:text-[#FF4B6B] transition-colors"
                  disabled={isProcessing}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-center">
            <button
              onClick={onEnhance}
              disabled={isProcessing}
              className="group relative w-20 h-20 rounded-full gradient-magenta-violet glow-magenta hover:scale-110 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isProcessing ? (
                <div className="flex flex-col items-center justify-center">
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span className="text-[10px] text-white mt-1">{processingStage}</span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center">
                  <Sparkles className="w-8 h-8 text-white" />
                  <span className="text-xs text-white font-medium mt-1">Enhance</span>
                </div>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Google Drive import */}
      <div className="mt-8 pt-8 border-t border-white/10">
        <label className="block text-sm text-[#C9CCDA] mb-3">Or import from Google Drive</label>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Paste a public Drive folder link..."
            value={googleDriveLink}
            onChange={(e) => setGoogleDriveLink(e.target.value)}
            disabled={isProcessing}
            className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-[#C9CCDA]/50 focus:outline-none focus:border-[#FF3EDB] transition-colors disabled:opacity-50"
          />
          <button
            disabled={!googleDriveLink || isProcessing}
            className="px-6 py-3 rounded-xl gradient-blue-teal text-white font-medium hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
            onClick={onEnhance}
          >
            Import
          </button>
        </div>
      </div>
    </div>
  )
}
