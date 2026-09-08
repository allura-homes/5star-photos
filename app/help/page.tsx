import type { Metadata } from "next"
import Link from "next/link"
import { Upload, Wand2, Download, Coins, Camera, HelpCircle, ArrowRight } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { ACTIVE_MODELS } from "@/lib/constants/models"
import { CREDIT_COSTS, WELCOME_CREDITS } from "@/lib/plans"

export const metadata: Metadata = {
  title: "Help - 5star.photos",
  description: "How to enhance your real estate photos with 5star.photos: upload, pick a variation, download.",
}

const STEPS = [
  {
    icon: Upload,
    title: "Upload",
    body: "Drop in one photo or a whole listing. JPG, PNG, WebP and HEIC all work. We detect whether each shot is indoor or outdoor so the right fixes are applied.",
  },
  {
    icon: Wand2,
    title: "Enhance",
    body: "Open a photo and press Transform. Three AI models each produce a version. Compare them side by side, thumbs-up the ones you like and save the best.",
  },
  {
    icon: Download,
    title: "Download",
    body: "Download full-resolution, watermark-free files ready for Airbnb, VRBO, Zillow or your own site.",
  },
]

const TIPS = [
  "Shoot in landscape at roughly 3:2. Listing sites crop portrait photos.",
  "Turn on every light in the room, then let the AI balance the colour temperature.",
  "Stand in a corner at chest height and include two walls for depth.",
  "Tidy first. The AI removes small clutter but works best on a clean scene.",
  "Upload the original file, not a screenshot or a compressed message attachment.",
]

const FAQ = [
  {
    q: "Which variation should I pick?",
    a: "There is no wrong answer. V1 is the more faithful OpenAI result, V2 is OpenAI's newest image model, and V3 is Google's latest. Many hosts save two and A/B test them on their listing.",
  },
  {
    q: "One of the variations says it is unavailable. Did something break?",
    a: "No. Each model runs independently, and sometimes one provider is busy or declines an edit. The others still finish. Press Transform again in a minute to retry the missing one.",
  },
  {
    q: "Can I undo a save?",
    a: "Saved variations sit under the original photo in your Library. Delete any you no longer want from the photo's menu.",
  },
  {
    q: "Will you change the layout of my property?",
    a: "No. The models are instructed to keep walls, windows, furniture placement and fixtures exactly where they are. They fix lighting, colour, sky, lawn and small clutter only.",
  },
  {
    q: "Where are my old jobs from the previous version?",
    a: "The earlier job-based flow was retired in this release. Everything you saved is still in your Library.",
  },
]

export default function HelpPage() {
  return (
    <AppShell>
      <div className="max-w-4xl mx-auto flex flex-col gap-12">
        <header className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-fuchsia-500/20 flex items-center justify-center">
              <HelpCircle className="w-5 h-5 text-fuchsia-300" />
            </div>
            <h1 className="text-3xl font-bold text-white">Help</h1>
          </div>
          <p className="text-slate-400 text-pretty max-w-2xl">
            5star.photos turns ordinary listing photos into ones that make guests stop scrolling. Here is how it works
            and how to get the best results.
          </p>
        </header>

        <section aria-labelledby="how-it-works" className="flex flex-col gap-6">
          <h2 id="how-it-works" className="text-xl font-semibold text-white">
            How it works
          </h2>
          <ol className="grid gap-4 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="glass-card rounded-2xl p-6 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-white/10 text-sm font-semibold text-white flex items-center justify-center">
                    {i + 1}
                  </span>
                  <step.icon className="w-5 h-5 text-fuchsia-300" aria-hidden="true" />
                  <h3 className="font-semibold text-white">{step.title}</h3>
                </div>
                <p className="text-sm text-slate-400 leading-relaxed">{step.body}</p>
              </li>
            ))}
          </ol>
          <Link
            href="/library?upload=1"
            className="self-start inline-flex items-center gap-2 px-5 py-3 rounded-xl gradient-magenta-violet text-white font-medium hover:scale-[1.02] transition-transform"
          >
            Upload your first photo
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </section>

        <section aria-labelledby="variations" className="flex flex-col gap-6">
          <h2 id="variations" className="text-xl font-semibold text-white">
            The variations
          </h2>
          <p className="text-slate-400 text-pretty">
            Every transform runs your photo through {ACTIVE_MODELS.length} different AI models at once. Each has its own
            personality, so you always have a choice.
          </p>
          <ul className="grid gap-4 sm:grid-cols-3">
            {ACTIVE_MODELS.map((m) => (
              <li key={m.provider} className="glass-card rounded-2xl p-5 flex flex-col gap-2">
                <span className="text-2xl font-bold text-white">{m.label}</span>
                <p className="text-sm text-slate-400 leading-relaxed">{m.description}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="tokens" className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <Coins className="w-5 h-5 text-amber-300" aria-hidden="true" />
            <h2 id="tokens" className="text-xl font-semibold text-white">
              Credits
            </h2>
          </div>
          <p className="text-slate-400 text-pretty">
            Every new account starts with {WELCOME_CREDITS} welcome credits. Credits are spent on the actions below and
            your balance is always shown in the header. Plans refill credits monthly; top-up packs add more whenever you
            need them.
          </p>
          <dl className="glass-card rounded-2xl divide-y divide-white/10">
            {[
              ["Upload a photo", CREDIT_COSTS.upload],
              ["Transform (all models in your plan)", CREDIT_COSTS.transform],
              ["Save a variation as a working image", CREDIT_COSTS.save_variation],
              ["Download hi-res", CREDIT_COSTS.download_hires],
            ].map(([label, cost]) => (
              <div key={String(label)} className="flex items-center justify-between px-5 py-3">
                <dt className="text-sm text-slate-300">{label}</dt>
                <dd className="text-sm font-medium text-white">
                  {cost} {cost === 1 ? "credit" : "credits"}
                </dd>
              </div>
            ))}
          </dl>
          <Link
            href="/pricing"
            className="self-start inline-flex items-center gap-2 text-sm font-medium text-fuchsia-300 hover:text-fuchsia-200"
          >
            Compare plans and top-up packs
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </section>

        <section aria-labelledby="tips" className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <Camera className="w-5 h-5 text-sky-300" aria-hidden="true" />
            <h2 id="tips" className="text-xl font-semibold text-white">
              Getting a great source photo
            </h2>
          </div>
          <ul className="glass-card rounded-2xl p-6 flex flex-col gap-3">
            {TIPS.map((tip) => (
              <li key={tip} className="flex gap-3 text-sm text-slate-300 leading-relaxed">
                <span className="mt-2 w-1.5 h-1.5 rounded-full bg-fuchsia-400 shrink-0" aria-hidden="true" />
                {tip}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="faq" className="flex flex-col gap-6">
          <h2 id="faq" className="text-xl font-semibold text-white">
            Common questions
          </h2>
          <div className="flex flex-col gap-3">
            {FAQ.map((item) => (
              <details key={item.q} className="glass-card rounded-2xl group">
                <summary className="cursor-pointer list-none px-5 py-4 font-medium text-white flex items-center justify-between gap-4">
                  {item.q}
                  <span className="text-slate-500 group-open:rotate-90 transition-transform" aria-hidden="true">
                    &rsaquo;
                  </span>
                </summary>
                <p className="px-5 pb-5 text-sm text-slate-400 leading-relaxed text-pretty">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <footer className="flex flex-wrap gap-6 text-sm text-slate-500 border-t border-white/10 pt-6">
          <Link href="/privacy" className="hover:text-white transition-colors">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-white transition-colors">
            Terms
          </Link>
          <a href="mailto:support@5star.photos" className="hover:text-white transition-colors">
            support@5star.photos
          </a>
        </footer>
      </div>
    </AppShell>
  )
}
