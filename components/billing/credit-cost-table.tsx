import { Upload, Wand2, Bookmark, Download } from "lucide-react"
import { CREDIT_COSTS } from "@/lib/plans"

const ROWS = [
  {
    icon: Upload,
    action: "Upload a photo",
    cost: CREDIT_COSTS.upload,
    note: "Stores the original in your Library and detects indoor vs outdoor.",
  },
  {
    icon: Wand2,
    action: "Transform",
    cost: CREDIT_COSTS.transform,
    note: "Runs every model your plan includes at once and saves each result. Refunded if nothing comes back.",
  },
  {
    icon: Bookmark,
    action: "Save as working image",
    cost: CREDIT_COSTS.save_variation,
    note: "Promote a result so you can transform it again with different settings.",
  },
  {
    icon: Download,
    action: "Hi-res download",
    cost: CREDIT_COSTS.download_hires,
    note: "Full resolution, no watermark, upscaled and ready for listing sites.",
  },
]

const PHOTO_TOTAL = CREDIT_COSTS.upload + CREDIT_COSTS.transform + CREDIT_COSTS.download_hires

export function CreditCostTable() {
  return (
    <section aria-labelledby="credit-costs" className="flex flex-col gap-6 max-w-3xl mx-auto w-full">
      <div className="flex flex-col items-center gap-2 text-center">
        <h2 id="credit-costs" className="text-2xl font-bold text-white">
          What a credit buys
        </h2>
        <p className="text-slate-400 text-pretty">
          A typical finished photo is {PHOTO_TOTAL} credits: upload, transform, and one hi-res download.
        </p>
      </div>

      <ul className="glass-card rounded-2xl divide-y divide-white/10">
        {ROWS.map((row) => (
          <li key={row.action} className="flex items-start gap-4 p-4 sm:p-5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/5">
              <row.icon className="size-5 text-[#FF3EDB]" aria-hidden="true" />
            </div>
            <div className="flex flex-1 flex-col gap-1 min-w-0">
              <p className="font-semibold text-white">{row.action}</p>
              <p className="text-sm text-slate-400 leading-relaxed">{row.note}</p>
            </div>
            <p className="shrink-0 text-right font-bold text-white">
              {row.cost} <span className="text-xs font-medium text-slate-400">cr</span>
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
