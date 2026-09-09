"use client"

import { AppShell } from "@/components/app-shell"
import { useAuthContext } from "@/lib/contexts/auth-context"
import { AdminDashboard } from "@/components/admin/admin-dashboard"
import { Loader2 } from "lucide-react"

export default function AdminPage() {
  const { isSuperAdmin, isLoading } = useAuthContext()

  // The security boundary for this route is the proxy middleware, which does a
  // server-side service-role check of admin_role before the page is ever served
  // (and every dashboard server action independently re-checks with requireAdmin).
  // We deliberately do NOT gate rendering on the client `isAdmin` flag: the
  // client profile fetch can hang inside the preview iframe (Web Locks), which
  // would leave a legitimate admin stuck. `isSuperAdmin` is only a first-paint
  // hint for UI affordances; the dashboard replaces it with the server-resolved
  // tier from getAdminMetrics and fails closed until then.
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#FF3EDB] animate-spin" />
      </div>
    )
  }

  return (
    <AppShell>
      <AdminDashboard isSuperAdmin={isSuperAdmin} />
    </AppShell>
  )
}
