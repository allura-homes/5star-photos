import { Sidebar } from '@/components/sidebar'
import { getAllJobs } from '@/lib/actions/job-actions'
import { Clock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default async function BatchJobsPage() {
  const { jobs, error } = await getAllJobs()

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'done':
        return <CheckCircle2 className="w-5 h-5 text-[#16B2A5]" />
      case 'error':
        return <AlertCircle className="w-5 h-5 text-[#FF4B6B]" />
      case 'processing_preview':
      case 'processing_final':
        return <Loader2 className="w-5 h-5 text-[#2F7BFF] animate-spin" />
      default:
        return <Clock className="w-5 h-5 text-[#C9CCDA]" />
    }
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      uploaded: 'Uploaded',
      processing_preview: 'Processing Preview',
      preview_ready: 'Preview Ready',
      processing_final: 'Generating Final',
      done: 'Complete',
      error: 'Error',
    }
    return labels[status] || status
  }

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      
      <main className="flex-1 ml-20 p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          {/* Hero Card */}
          <div className="glass-card-strong rounded-[32px] p-12 mb-8 flex flex-col items-center text-center">
            <div className="relative mb-6">
              <div className="w-32 h-32 rounded-full gradient-blue-teal flex items-center justify-center glow-blue">
                <div className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-xl flex items-center justify-center">
                  <Clock className="w-12 h-12 text-white" strokeWidth={1.5} />
                </div>
              </div>
            </div>

            <h1 className="text-4xl font-bold text-white mb-3">Batch Jobs</h1>
            <p className="text-lg text-[#C9CCDA] max-w-2xl text-balance">
              View your photo enhancement history and manage ongoing jobs.
            </p>
          </div>

          {/* Jobs List */}
          <div className="glass-card rounded-3xl p-8">
            {error ? (
              <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 text-[#FF4B6B] mx-auto mb-4" />
                <p className="text-[#C9CCDA]">{error}</p>
              </div>
            ) : !jobs || jobs.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="w-12 h-12 text-[#C9CCDA] mx-auto mb-4" />
                <p className="text-[#C9CCDA]">No jobs yet. Start by uploading photos!</p>
                <Link
                  href="/enhance"
                  className="inline-block mt-6 px-6 py-3 rounded-xl gradient-magenta-violet text-white font-medium hover:scale-105 transition-all duration-300"
                >
                  Upload Photos
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {jobs.map((job: any) => (
                  <Link
                    key={job.id}
                    href={
                      job.status === 'done'
                        ? `/download/${job.id}`
                        : job.status === 'preview_ready'
                        ? `/preview/${job.id}`
                        : `/batch-jobs`
                    }
                    className="block glass-card rounded-2xl p-6 hover:bg-white/10 transition-all duration-300"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0">
                        {getStatusIcon(job.status)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-lg font-semibold text-white">
                            Job {job.id.slice(0, 8)}
                          </h3>
                          <span className="px-3 py-1 rounded-full bg-white/10 text-xs text-[#C9CCDA]">
                            {job.style_mode.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-sm text-[#C9CCDA]">
                          {job.file_list?.length || 0} photos • {getStatusLabel(job.status)}
                        </p>
                      </div>
                      
                      <div className="text-right">
                        <p className="text-sm text-[#C9CCDA]">
                          {new Date(job.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                        <p className="text-xs text-[#C9CCDA]/60">
                          {new Date(job.created_at).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
