'use client'

import { useState, useEffect, use } from 'react'
import { Sidebar } from '@/components/sidebar'
import { Download, CheckSquare, Square } from 'lucide-react'
import type { Job } from '@/lib/types'
import Image from 'next/image'

export default function DownloadPage({ params }: { params: Promise<{ jobId: string }> }) {
  const resolvedParams = use(params)
  const [job, setJob] = useState<Job | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<Set<number>>(new Set())

  useEffect(() => {
    // Fetch job with final images
    const mockJob: Job = {
      id: resolvedParams.jobId,
      created_at: new Date().toISOString(),
      status: 'done',
      style_mode: 'daylight_4000k',
      file_list: [
        {
          name: 'living-room-1.jpg',
          size: 4096000,
          final_url: '/modern-living-room-bright-lighting-professional.jpg',
          approved: true
        },
        {
          name: 'bedroom-1.jpg',
          size: 3712000,
          final_url: '/cozy-bedroom-warm-lighting-professional.jpg',
          approved: true
        },
        {
          name: 'bathroom-1.jpg',
          size: 3584000,
          final_url: '/spa-bathroom-clean-bright-professional.jpg',
          approved: true
        }
      ]
    }
    setJob(mockJob)
    // Select all by default
    setSelectedFiles(new Set(mockJob.file_list.map((_, i) => i)))
  }, [resolvedParams.jobId])

  const toggleFile = (index: number) => {
    const newSelected = new Set(selectedFiles)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setSelectedFiles(newSelected)
  }

  const toggleAll = () => {
    if (!job) return
    if (selectedFiles.size === job.file_list.length) {
      setSelectedFiles(new Set())
    } else {
      setSelectedFiles(new Set(job.file_list.map((_, i) => i)))
    }
  }

  const handleDownload = async (type: 'all' | 'selected') => {
    if (!job) return
    const files = type === 'all' 
      ? job.file_list 
      : job.file_list.filter((_, i) => selectedFiles.has(i))
    
    console.log('[v0] Downloading files:', files.map(f => f.name))
    alert(`Downloading ${files.length} file(s)...`)
  }

  if (!job) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#FF3EDB] border-t-transparent rounded-full" />
      </div>
    )
  }

  const allSelected = selectedFiles.size === job.file_list.length

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      
      <main className="flex-1 ml-20 p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-white mb-3">Download</h1>
            <p className="text-lg text-[#C9CCDA]">
              Your enhanced photos are ready. Files will be stored for 24 hours.
            </p>
          </div>

          {/* Controls */}
          <div className="glass-card rounded-2xl p-6 mb-6 flex items-center justify-between">
            <button
              onClick={toggleAll}
              className="flex items-center gap-3 text-white hover:text-[#FF3EDB] transition-colors"
            >
              {allSelected ? (
                <CheckSquare className="w-5 h-5" />
              ) : (
                <Square className="w-5 h-5" />
              )}
              <span className="font-medium">
                {allSelected ? 'Deselect All' : 'Select All'}
              </span>
            </button>

            <div className="flex items-center gap-4">
              <button
                onClick={() => handleDownload('selected')}
                disabled={selectedFiles.size === 0}
                className="px-6 py-3 rounded-xl gradient-blue-teal text-white font-medium hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download Selected ({selectedFiles.size})
              </button>
              <button
                onClick={() => handleDownload('all')}
                className="px-6 py-3 rounded-xl gradient-magenta-violet text-white font-medium hover:scale-105 transition-all duration-300 glow-magenta flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download All as ZIP
              </button>
            </div>
          </div>

          {/* File Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
            {job.file_list.map((file, index) => (
              <div
                key={index}
                className={`glass-card rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 ${
                  selectedFiles.has(index)
                    ? 'ring-2 ring-[#FF3EDB]'
                    : 'hover:ring-2 hover:ring-white/40'
                }`}
                onClick={() => toggleFile(index)}
              >
                {/* Image */}
                <div className="relative aspect-[3/2] bg-[#2B2A3A]">
                  <Image
                    src={file.final_url || '/placeholder.svg?height=800&width=1200'}
                    alt={file.name}
                    fill
                    className="object-cover"
                  />
                  
                  {/* Checkbox */}
                  <div className="absolute top-3 right-3">
                    <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
                      selectedFiles.has(index)
                        ? 'bg-[#FF3EDB] border-[#FF3EDB]'
                        : 'bg-black/50 border-white/60 backdrop-blur-sm'
                    }`}>
                      {selectedFiles.has(index) && (
                        <CheckSquare className="w-4 h-4 text-white" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div className="p-4">
                  <p className="text-white font-medium truncate">{file.name}</p>
                  <p className="text-sm text-[#C9CCDA]">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Info Note */}
          <div className="mt-8 p-4 rounded-xl bg-[#2F7BFF]/10 border border-[#2F7BFF]/30">
            <p className="text-sm text-[#C9CCDA]">
              <span className="text-[#2F7BFF] font-semibold">Note:</span> Files are stored temporarily for 24 hours. Download them now to save your enhanced photos.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
