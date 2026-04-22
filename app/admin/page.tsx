"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { useAuthContext } from "@/lib/contexts/auth-context"
import { getAllJobs } from "@/lib/actions/job-actions"
import { createClient } from "@/lib/supabase/client"
import type { Job } from "@/lib/types"
import { Loader2, Users, ImageIcon, Coins, TrendingUp, Shield, Search, MoreVertical } from "lucide-react"

type UserProfile = {
  id: string
  email: string
  display_name: string
  role: string
  tokens: number
  free_previews_used: number
  created_at: string
}

type Stats = {
  totalUsers: number
  totalJobs: number
  totalTokensUsed: number
  activeJobs: number
}

export default function AdminPage() {
  const router = useRouter()
  const { isAuthenticated, isAdmin, isLoading: authLoading } = useAuthContext()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, totalJobs: 0, totalTokensUsed: 0, activeJobs: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "jobs">("overview")
  const [searchQuery, setSearchQuery] = useState("")

  const supabase = createClient()

  useEffect(() => {
    if (authLoading) return

    if (!isAuthenticated || !isAdmin) {
      router.push("/")
      return
    }

    async function loadData() {
      setIsLoading(true)

      // Fetch users
      const { data: usersData } = await supabase.from("profiles").select("*").order("created_at", { ascending: false })

      if (usersData) {
        setUsers(usersData)
      }

      // Fetch jobs
      const jobsResult = await getAllJobs()
      if (jobsResult.jobs) {
        setJobs(jobsResult.jobs)
      }

      // Calculate stats
      const totalTokensUsed = usersData?.reduce((sum, u) => sum + (u.tokens || 0), 0) || 0
      const activeJobs =
        jobsResult.jobs?.filter((j) => j.status === "processing_preview" || j.status === "processing_final").length || 0

      setStats({
        totalUsers: usersData?.length || 0,
        totalJobs: jobsResult.jobs?.length || 0,
        totalTokensUsed,
        activeJobs,
      })

      setIsLoading(false)
    }

    loadData()
  }, [isAuthenticated, isAdmin, authLoading, router, supabase])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const filteredUsers = users.filter(
    (user) =>
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.display_name?.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 to-slate-950">
        <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <div className="flex flex-1 pt-20">
        <Sidebar />

        <main className="flex-1 ml-20 p-8">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
                <Shield className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
                <p className="text-slate-400">Manage users, jobs, and system settings</p>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <Users className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{stats.totalUsers}</p>
                    <p className="text-sm text-slate-400">Total Users</p>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{stats.totalJobs}</p>
                    <p className="text-sm text-slate-400">Total Jobs</p>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                    <Coins className="w-6 h-6 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{stats.totalTokensUsed}</p>
                    <p className="text-sm text-slate-400">Tokens in Circulation</p>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{stats.activeJobs}</p>
                    <p className="text-sm text-slate-400">Active Jobs</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 mb-6">
              <button
                onClick={() => setActiveTab("overview")}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  activeTab === "overview" ? "bg-red-500/20 text-red-400" : "text-slate-400 hover:text-white"
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab("users")}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  activeTab === "users" ? "bg-red-500/20 text-red-400" : "text-slate-400 hover:text-white"
                }`}
              >
                Users
              </button>
              <button
                onClick={() => setActiveTab("jobs")}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  activeTab === "jobs" ? "bg-red-500/20 text-red-400" : "text-slate-400 hover:text-white"
                }`}
              >
                Jobs
              </button>
            </div>

            {activeTab === "users" && (
              <>
                {/* Search */}
                <div className="relative mb-6">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search users by email or name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500/50"
                  />
                </div>

                {/* Users Table */}
                <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left text-sm font-medium text-slate-400 px-6 py-4">User</th>
                        <th className="text-left text-sm font-medium text-slate-400 px-6 py-4">Role</th>
                        <th className="text-left text-sm font-medium text-slate-400 px-6 py-4">Tokens</th>
                        <th className="text-left text-sm font-medium text-slate-400 px-6 py-4">Free Used</th>
                        <th className="text-left text-sm font-medium text-slate-400 px-6 py-4">Joined</th>
                        <th className="text-left text-sm font-medium text-slate-400 px-6 py-4"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((user) => (
                        <tr key={user.id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="px-6 py-4">
                            <div>
                              <p className="text-white font-medium">{user.display_name || "—"}</p>
                              <p className="text-sm text-slate-400">{user.email}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                user.role === "admin"
                                  ? "bg-red-500/20 text-red-400"
                                  : user.role === "user"
                                    ? "bg-green-500/20 text-green-400"
                                    : "bg-slate-500/20 text-slate-400"
                              }`}
                            >
                              {user.role}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-amber-400 font-medium">{user.tokens}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-slate-300">{user.free_previews_used}/3</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-slate-400">{formatDate(user.created_at)}</span>
                          </td>
                          <td className="px-6 py-4">
                            <button className="p-2 rounded-lg hover:bg-white/10 transition-colors">
                              <MoreVertical className="w-4 h-4 text-slate-400" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {activeTab === "jobs" && (
              <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left text-sm font-medium text-slate-400 px-6 py-4">Job ID</th>
                      <th className="text-left text-sm font-medium text-slate-400 px-6 py-4">Status</th>
                      <th className="text-left text-sm font-medium text-slate-400 px-6 py-4">Files</th>
                      <th className="text-left text-sm font-medium text-slate-400 px-6 py-4">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.slice(0, 20).map((job) => (
                      <tr key={job.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="px-6 py-4">
                          <span className="text-white font-mono text-sm">{job.id.slice(0, 8)}...</span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              job.status === "done"
                                ? "bg-green-500/20 text-green-400"
                                : job.status === "error"
                                  ? "bg-red-500/20 text-red-400"
                                  : "bg-amber-500/20 text-amber-400"
                            }`}
                          >
                            {job.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-slate-300">{job.file_list?.length || 0}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-slate-400">{formatDate(job.created_at)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === "overview" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Users */}
                <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Recent Users</h3>
                  <div className="space-y-3">
                    {users.slice(0, 5).map((user) => (
                      <div key={user.id} className="flex items-center justify-between">
                        <div>
                          <p className="text-white">{user.display_name || user.email.split("@")[0]}</p>
                          <p className="text-sm text-slate-400">{user.email}</p>
                        </div>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            user.role === "admin"
                              ? "bg-red-500/20 text-red-400"
                              : user.role === "user"
                                ? "bg-green-500/20 text-green-400"
                                : "bg-slate-500/20 text-slate-400"
                          }`}
                        >
                          {user.role}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Jobs */}
                <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Recent Jobs</h3>
                  <div className="space-y-3">
                    {jobs.slice(0, 5).map((job) => (
                      <div key={job.id} className="flex items-center justify-between">
                        <div>
                          <p className="text-white font-mono text-sm">{job.id.slice(0, 8)}...</p>
                          <p className="text-sm text-slate-400">{job.file_list?.length || 0} files</p>
                        </div>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            job.status === "done"
                              ? "bg-green-500/20 text-green-400"
                              : job.status === "error"
                                ? "bg-red-500/20 text-red-400"
                                : "bg-amber-500/20 text-amber-400"
                          }`}
                        >
                          {job.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
