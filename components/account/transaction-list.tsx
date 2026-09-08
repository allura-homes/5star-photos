import { Upload, Wand2, Save, Download, Gift, ShoppingBag, RefreshCw, Maximize2, Coins } from "lucide-react"

interface Transaction {
  id: string
  type: string
  amount: number
  description: string | null
  created_at: string
}

const ICONS: Record<string, typeof Upload> = {
  upload: Upload,
  transform: Wand2,
  revision: RefreshCw,
  save_variation: Save,
  download_hires: Download,
  upscale: Maximize2,
  purchase: ShoppingBag,
  topup: ShoppingBag,
  plan_grant: RefreshCw,
  signup_bonus: Gift,
  bonus: Gift,
  refund: RefreshCw,
  admin_grant: Gift,
  admin_deduct: Coins,
}

const LABELS: Record<string, string> = {
  upload: "Uploaded",
  transform: "Transformed",
  revision: "Re-transformed",
  save_variation: "Saved variation",
  download_hires: "Downloaded hi-res",
  upscale: "Upscaled",
  purchase: "Credits added",
  topup: "Top-up purchased",
  plan_grant: "Monthly credits",
  signup_bonus: "Welcome credits",
  bonus: "Bonus credits",
  refund: "Refund",
  admin_grant: "Credits granted",
  admin_deduct: "Credits adjusted",
}

export function TransactionList({ transactions }: { transactions: Transaction[] }) {
  if (transactions.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-8 text-center flex flex-col items-center gap-2">
        <Coins className="w-8 h-8 text-slate-500" aria-hidden="true" />
        <p className="text-slate-400 text-sm">No activity yet. Upload a photo to get started.</p>
      </div>
    )
  }

  return (
    <ul className="glass-card rounded-2xl divide-y divide-white/10">
      {transactions.map((t) => {
        const Icon = ICONS[t.type] ?? Coins
        const label = LABELS[t.type] ?? t.type
        const description = (t.description ?? "").replace(/\s*\((free beta|FREE[^)]*)\)\s*$/i, "")
        const date = new Date(t.created_at).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
        return (
          <li key={t.id} className="flex items-center gap-4 px-5 py-3">
            <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4 text-slate-300" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">{label}</p>
              {description && <p className="text-xs text-slate-500 truncate">{description}</p>}
            </div>
            <div className="text-right shrink-0">
              <p className={`text-sm font-medium ${t.amount > 0 ? "text-emerald-300" : t.amount < 0 ? "text-white" : "text-slate-500"}`}>
                {t.amount > 0 ? `+${t.amount}` : t.amount === 0 ? "free" : t.amount}
              </p>
              <p className="text-xs text-slate-500">{date}</p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
