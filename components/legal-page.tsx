import Link from "next/link"
import { Header } from "@/components/header"

interface Section {
  heading: string
  body: string[]
}

export function LegalPage({
  title,
  updated,
  intro,
  sections,
}: {
  title: string
  updated: string
  intro: string
  sections: Section[]
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 pt-28 pb-16 px-4 sm:px-6">
        <article className="max-w-3xl mx-auto flex flex-col gap-10">
          <header className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold text-white">{title}</h1>
            <p className="text-sm text-slate-500">Last updated {updated}</p>
            <p className="text-slate-300 leading-relaxed text-pretty mt-2">{intro}</p>
          </header>

          {sections.map((s) => (
            <section key={s.heading} className="flex flex-col gap-3">
              <h2 className="text-xl font-semibold text-white">{s.heading}</h2>
              {s.body.map((p, i) => (
                <p key={i} className="text-slate-300 leading-relaxed text-pretty">
                  {p}
                </p>
              ))}
            </section>
          ))}

          <footer className="flex flex-wrap gap-6 text-sm text-slate-500 border-t border-white/10 pt-6">
            <Link href="/" className="hover:text-white transition-colors">
              Home
            </Link>
            <Link href="/privacy" className="hover:text-white transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-white transition-colors">
              Terms
            </Link>
            <Link href="/help" className="hover:text-white transition-colors">
              Help
            </Link>
          </footer>
        </article>
      </main>
    </div>
  )
}
