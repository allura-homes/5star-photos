"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { LogOut, Loader2 } from "lucide-react"
import { useAuthContext } from "@/lib/contexts/auth-context"

export function SignOutButton() {
  const { signOut } = useAuthContext()
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        await signOut()
        router.push("/")
        router.refresh()
      }}
      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-white/15 text-slate-200 hover:bg-white/5 disabled:opacity-60 transition-colors"
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <LogOut className="w-4 h-4" aria-hidden="true" />}
      Sign out
    </button>
  )
}
