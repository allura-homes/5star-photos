import { Plus } from "lucide-react"

export function FaqList({ items }: { items: readonly { q: string; a: string }[] }) {
  return (
    <div className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-foreground/5">
      {items.map((item) => (
        <details key={item.q} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-5 py-5 font-medium text-foreground focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
            {item.q}
            <Plus className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-45" aria-hidden="true" />
          </summary>
          <p className="px-5 pb-5 text-pretty text-sm leading-relaxed text-muted-foreground">{item.a}</p>
        </details>
      ))}
    </div>
  )
}
