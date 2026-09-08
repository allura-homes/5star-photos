"use client"

import { useActionState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { updateDisplayName } from "@/lib/actions/account-actions"

type State = { success: boolean; error?: string } | null

export function DisplayNameForm({ initialName }: { initialName: string }) {
  const [state, action, pending] = useActionState<State, FormData>(async (_prev, formData) => {
    const result = await updateDisplayName(formData)
    if (result.success) toast.success("Name updated")
    else if (result.error) toast.error(result.error)
    return result
  }, null)

  return (
    <form action={action} className="flex flex-col sm:flex-row sm:items-end gap-3">
      <div className="flex flex-col gap-1.5 flex-1">
        <label htmlFor="display_name" className="text-sm text-slate-300">
          Display name
        </label>
        <input
          id="display_name"
          name="display_name"
          defaultValue={initialName}
          maxLength={60}
          required
          autoComplete="name"
          className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50"
          placeholder="How should we address you?"
          aria-invalid={state?.error ? true : undefined}
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 text-white font-medium hover:bg-white/15 disabled:opacity-60 transition-colors"
      >
        {pending && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
        Save
      </button>
    </form>
  )
}
