import Link from "next/link"

export function SiteFooter() {
  return (
    <footer className="border-t border-border px-6 py-8 text-sm text-muted-foreground">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 sm:flex-row">
        <p>© {new Date().getFullYear()} <span className="font-semibold text-foreground">5star.photos</span></p>
        <nav aria-label="Footer" className="flex flex-wrap justify-center gap-5">
          <Link href="/pricing" className="transition-colors hover:text-foreground">Pricing</Link>
          <Link href="/help" className="transition-colors hover:text-foreground">Help & contact</Link>
          <Link href="/privacy" className="transition-colors hover:text-foreground">Privacy</Link>
          <Link href="/terms" className="transition-colors hover:text-foreground">Terms</Link>
        </nav>
      </div>
    </footer>
  )
}
