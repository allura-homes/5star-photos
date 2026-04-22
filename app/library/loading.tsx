import { Loader2 } from "lucide-react"

export default function LibraryLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 text-fuchsia-500 animate-spin" />
        <p className="text-slate-400">Loading library...</p>
      </div>
    </div>
  )
}
