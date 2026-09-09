"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Loader2,
  Users,
  DollarSign,
  UserCheck,
  Ban,
  Search,
  Shield,
  ImageIcon,
} from "lucide-react"
import { getAdminMetrics, listUsers, listAuditLog, type AdminMetrics, type AdminUserRow, type AuditLogRow } from "@/lib/actions/admin-actions"
import { getAllJobs } from "@/lib/actions/job-actions"
import { PLANS } from "@/lib/plans"
import type { Job } from "@/lib/types"
import type { AdminRole } from "@/lib/admin-auth"
import { UserDetailDrawer } from "@/components/admin/user-detail-drawer"
import { Pill, formatDate, formatDateTime, formatCents, subscriptionTone, jobStatusTone } from "@/components/admin/admin-ui"

type Tab = "overview" | "users" | "jobs" | "audit"

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "users", label: "Users" },
  { id: "jobs", label: "Jobs" },
  { id: "audit", label: "Audit log" },
]

function roleTone(role: AdminRole | null): "brand" | "info" | "neutral" {
  if (role === "super_admin") return "brand"
  if (role === "support") return "info"
  return "neutral"
}

function roleLabel(role: AdminRole | null): string {
  if (role === "super_admin") return "Super admin"
  if (role === "support") return "Support"
  return "Customer"
}

export function AdminDashboard({ isSuperAdmin: isSuperAdminHint }: { isSuperAdmin: boolean }) {
  const [tab, setTab] = useState<Tab>("overview")
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null)
  // The server-resolved tier (from getAdminMetrics) is authoritative for UI
  // gating; the prop is only a first-paint hint from the client auth hook,
  // which can be stale/unresolved inside the preview iframe.
  const isSuperAdmin = metrics ? metrics.viewerRole === "super_admin" : isSuperAdminHint
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [audit, setAudit] = useState<AuditLogRow[]>([])
  const [search, setSearch] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  const loadUsers = useCallback(async (searchTerm: string) => {
    const result = await listUsers({ search: searchTerm, pageSize: 50 })
    if (result.ok && result.users) setUsers(result.users)
  }, [])

  const loadAll = useCallback(async () => {
    setIsLoading(true)
    const [m, jobsResult, a] = await Promise.all([getAdminMetrics(), getAllJobs(), listAuditLog(50)])
    setMetrics(m)
    if (jobsResult.jobs) setJobs(jobsResult.jobs)
    if (a.ok && a.entries) setAudit(a.entries)
    await loadUsers("")
    setIsLoading(false)
  }, [loadUsers])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  // Debounced search against the server so results reflect the whole user base,
  // not just the current page.
  useEffect(() => {
    const handle = setTimeout(() => loadUsers(search), 250)
    return () => clearTimeout(handle)
  }, [search, loadUsers])

  if (isLoading && !metrics) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#FF3EDB] animate-spin" />
      </div>
    )
  }

  const stat = (icon: React.ReactNode, value: string | number, label: string, tone: string) => (
    <div className="p-5 bg-white/5 rounded-2xl border border-white/10">
      <div className="flex items-center gap-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${tone}`}>{icon}</div>
        <div>
          <p className="text-2xl font-bold text-white">{value}</p>
          <p className="text-sm text-slate-400">{label}</p>
        </div>
      </div>
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-xl bg-[#FF3EDB]/15 flex items-center justify-center">
          <Shield className="w-6 h-6 text-[#FF3EDB]" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white">Admin</h1>
          <p className="text-slate-400">
            {isSuperAdmin ? "Super-admin access — full control." : "Support access — view and adjust credits."}
          </p>
        </div>
      </div>

      {/* Metrics */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stat(<DollarSign className="w-5 h-5 text-emerald-400" />, formatCents(metrics.mrrCents), "MRR", "bg-emerald-500/20")}
          {stat(<UserCheck className="w-5 h-5 text-sky-400" />, metrics.activeSubscribers, "Active subscribers", "bg-sky-500/20")}
          {stat(<Users className="w-5 h-5 text-violet-400" />, metrics.totalUsers, "Total users", "bg-violet-500/20")}
          {stat(<Ban className="w-5 h-5 text-red-400" />, metrics.suspendedUsers, "Suspended", "bg-red-500/20")}
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              tab === t.id ? "bg-[#FF3EDB]/15 text-[#FF3EDB]" : "text-slate-400 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && metrics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Plan distribution</h3>
            <div className="flex flex-col gap-3">
              {(Object.keys(PLANS) as (keyof typeof PLANS)[]).map((plan) => (
                <div key={plan} className="flex items-center justify-between">
                  <span className="text-slate-300">{PLANS[plan].name}</span>
                  <span className="text-white font-medium">{metrics.planBreakdown[plan] ?? 0}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Health</h3>
            <div className="flex flex-col gap-3 text-slate-300">
              <div className="flex items-center justify-between">
                <span>New users (30 days)</span>
                <span className="text-white font-medium">{metrics.newUsers30d}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Past-due accounts</span>
                <span className="text-amber-400 font-medium">{metrics.pastDueUsers}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Canceled</span>
                <span className="text-red-400 font-medium">{metrics.canceled30d}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "users" && (
        <>
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              type="text"
              placeholder="Search users by email or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-[#FF3EDB]/50"
            />
          </div>
          <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-white/10 text-left text-sm font-medium text-slate-400">
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Access</th>
                  <th className="px-6 py-4">Plan</th>
                  <th className="px-6 py-4">Credits</th>
                  <th className="px-6 py-4">Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => setSelectedUserId(u.id)}
                    className="border-b border-white/5 hover:bg-white/5 cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <p className="text-white font-medium flex items-center gap-2">
                        {u.displayName || "—"}
                        {u.isSuspended && <Pill tone="danger">Suspended</Pill>}
                      </p>
                      <p className="text-sm text-slate-400">{u.email}</p>
                    </td>
                    <td className="px-6 py-4">
                      <Pill tone={roleTone(u.adminRole)}>{roleLabel(u.adminRole)}</Pill>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <Pill tone={u.plan !== "free" ? "brand" : "neutral"}>{PLANS[u.plan]?.name ?? u.plan}</Pill>
                        {u.subscriptionStatus && u.subscriptionStatus !== "active" && (
                          <Pill tone={subscriptionTone(u.subscriptionStatus)}>{u.subscriptionStatus}</Pill>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-amber-400 font-medium">{u.totalCredits}</td>
                    <td className="px-6 py-4 text-slate-400">{formatDate(u.createdAt)}</td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-slate-500">
                      No users match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "jobs" && (
        <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="border-b border-white/10 text-left text-sm font-medium text-slate-400">
                <th className="px-6 py-4">Job</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Files</th>
                <th className="px-6 py-4">Created</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-6 py-4">
                    <span className="text-white font-mono text-sm inline-flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-slate-500" />
                      {job.id.slice(0, 8)}…
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <Pill tone={jobStatusTone(job.status)}>{job.status}</Pill>
                  </td>
                  <td className="px-6 py-4 text-slate-300">{job.file_list?.length || 0}</td>
                  <td className="px-6 py-4 text-slate-400">{formatDate(job.created_at)}</td>
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-slate-500">
                    No jobs yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "audit" && (
        <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
          {audit.length === 0 ? (
            <p className="px-6 py-10 text-center text-slate-500">No admin actions recorded yet.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {audit.map((e) => (
                <li key={e.id} className="px-6 py-4 flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <span className="text-white font-medium">
                      <span className="font-mono text-sm text-[#FF3EDB]">{e.action}</span>
                      {e.targetEmail && <span className="text-slate-400"> → {e.targetEmail}</span>}
                    </span>
                    <span className="text-xs text-slate-500">{formatDateTime(e.createdAt)}</span>
                  </div>
                  <div className="text-sm text-slate-400">
                    {e.reason && <span>{e.reason} · </span>}
                    <span className="text-slate-500">by {e.actorEmail ?? "unknown"}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <UserDetailDrawer
        userId={selectedUserId}
        isSuperAdmin={isSuperAdmin}
        onClose={() => setSelectedUserId(null)}
        onChanged={() => {
          loadUsers(search)
          getAdminMetrics().then(setMetrics)
          listAuditLog(50).then((a) => a.ok && a.entries && setAudit(a.entries))
        }}
      />
    </div>
  )
}
