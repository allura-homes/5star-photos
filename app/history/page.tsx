"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { useAuthContext } from "@/lib/contexts/auth-context"
import { getUserJobs } from "@/lib/actions/job-actions"
import { getTokenHistory } from "@/lib/actions/token-actions"
import type { Job } from "@/lib/types"
import { Loader2, ImageIcon, Clock, CheckCircle, XCircle, ArrowRight, Coins, Plus, Minus } from "lucide-react"

type TokenTransaction = {
  id: string
  type: string
  amount: number
  balance_after: number
  description: string
  created_at: string
}

export default function HistoryPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading } = useAuthContext()
  const [jobs, setJobs] = useState<Job[]>([])
  const [transactions, setTransactions] = useState<TokenTransaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"jobs" | "tokens">("jobs")

  useEffect(() => {
    if (authLoading) return

    if (!isAuthenticated) {
      router.push("/auth/login?redirect=/history")
      return
    }

    async function loadData() {
      setIsLoading(true)
      const [jobsResult, tokensResult] = await Promise.all([getUserJobs(), getTokenHistory(50)])

      if (jobsResult.jobs) {
        setJobs(jobsResult.jobs)
      }
      if (tokensResult.transactions) {
        setTransactions(tokensResult.transactions)
      }
      setIsLoading(false)
    }

    loadData()
  }, [isAuthenticated, authLoading, router])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "done":
        return <CheckCircle className="w-5 h-5 text-green-400" />
      case "error":
        return <XCircle className="w-5 h-5 text-red-400" />
      case "processing_preview":
      case "processing_final":
        return <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
      default:
        return <Clock className="w-5 h-5 text-slate-400" />
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "done":
        return "Complete"
      case "error":
        return "Failed"
      case "processing_preview":
        return "Processing"
      case "processing_final":
        return "Finalizing"
      case "preview_ready":
        return "Ready for Review"
      default:
        return status
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  }

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 to-slate-950">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <div className="flex flex-1 pt-20">
        <Sidebar />

        <main className="flex-1 ml-20 p-8">
          <div className="max-w-5xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-white mb-2">History</h1>
              <p className="text-slate-400">View your past enhancement jobs and token transactions</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 mb-8">
              <button
                onClick={() => setActiveTab("jobs")}
                className={`px-6 py-3 rounded-xl font-medium transition-all ${
                  activeTab === "jobs"
                    ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                    : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  Enhancement Jobs
                </span>
              </button>
              <button
                onClick={() => setActiveTab("tokens")}
                className={`px-6 py-3 rounded-xl font-medium transition-all ${
                  activeTab === "tokens"
                    ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                    : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Coins className="w-4 h-4" />
                  Token History
                </span>
              </button>
            </div>

            {activeTab === "jobs" ? (
              /* Jobs List */
              <div className="space-y-4">
                {jobs.length === 0 ? (
                  <div className="text-center py-16 bg-white/5 rounded-2xl border border-white/10">
                    <ImageIcon className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">No jobs yet</h3>
                    <p className="text-slate-400 mb-6">Start enhancing your photos to see them here</p>
                    <Link
                      href="/enhance"
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold hover:from-purple-600 hover:to-pink-600 transition-all"
                    >
                      Enhance Photos
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                ) : (
                  jobs.map((job) => (
                    <Link
                      key={job.id}
                      href={job.status === "done" ? `/download/${job.id}` : `/preview/${job.id}`}
                      className="block p-6 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          {/* Thumbnail preview */}
                          <div className="w-16 h-16 rounded-xl bg-white/10 flex items-center justify-center overflow-hidden">
                            {job.file_list?.[0]?.original_url ? (
                              <img
                                src={job.file_list[0].original_url || "/placeholder.svg"}
                                alt="Preview"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <ImageIcon className="w-8 h-8 text-slate-500" />
                            )}
                          </div>

                          <div>
                            <div className="flex items-center gap-3 mb-1">
                              {getStatusIcon(job.status)}
                              <span className="text-white font-medium">
                                {job.file_list?.length || 0} photo{(job.file_list?.length || 0) !== 1 ? "s" : ""}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  job.status === "done"
                                    ? "bg-green-500/20 text-green-400"
                                    : job.status === "error"
                                      ? "bg-red-500/20 text-red-400"
                                      : "bg-amber-500/20 text-amber-400"
                                }`}
                              >
                                {getStatusLabel(job.status)}
                              </span>
                            </div>
                            <p className="text-sm text-slate-400">{formatDate(job.created_at)}</p>
                          </div>
                        </div>

                        <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-white group-hover:translate-x-1 transition-all" />
                      </div>
                    </Link>
                  ))
                )}
              </div>
            ) : (
              /* Token Transactions */
              <div className="space-y-3">
                {transactions.length === 0 ? (
                  <div className="text-center py-16 bg-white/5 rounded-2xl border border-white/10">
                    <Coins className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">No transactions yet</h3>
                    <p className="text-slate-400">Your token history will appear here</p>
                  </div>
                ) : (
                  transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            tx.amount > 0 ? "bg-green-500/20" : "bg-red-500/20"
                          }`}
                        >
                          {tx.amount > 0 ? (
                            <Plus className="w-5 h-5 text-green-400" />
                          ) : (
                            <Minus className="w-5 h-5 text-red-400" />
                          )}
                        </div>
                        <div>
                          <p className="text-white font-medium">{tx.description}</p>
                          <p className="text-sm text-slate-400">{formatDate(tx.created_at)}</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className={`font-semibold ${tx.amount > 0 ? "text-green-400" : "text-red-400"}`}>
                          {tx.amount > 0 ? "+" : ""}
                          {tx.amount} tokens
                        </p>
                        <p className="text-sm text-slate-400">Balance: {tx.balance_after}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
