import type { Metadata } from "next"
import Link from "next/link"
import { Upload, Wand2, Download, Coins, Camera, HelpCircle, ArrowRight } from "lucide-react"
import { PublicPageShell } from "@/components/public-page-shell"
import { FaqList } from "@/components/faq-list"
import { ContactForm } from "@/components/help/contact-form"
import { ACTIVE_MODELS } from "@/lib/constants/models"
import { CREDIT_COSTS, WELCOME_CREDITS } from "@/lib/plans"

export const metadata: Metadata = {
  title: "Help & Contact - 5star.photos",
  description: "Get answers about photo enhancement, credits and subscriptions, or contact the 5star.photos team. Help is available with or without an account.",
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
    body: "Open a photo and press Transform. The models included in your plan each create a variation. Compare the results, check that the property is represented accurately, and choose your favorite.",
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
    a: "Compare lighting, detail and accuracy against the original. V1, V2 and V3 offer different enhancement styles; V4 is also included for everyone during beta. Pick the version that best represents your actual property, not just the most dramatic edit.",
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
    a: "Standard enhancements are instructed to preserve the structure, furniture and fixtures, and results are checked against the original. AI can still make mistakes: review every image before publishing. Virtual staging and twilight are separate, intentional effects; follow your listing platform's disclosure rules when using them.",
  },
  {
    q: "Do I need a paid plan to try it?",
    a: `No. New accounts receive ${WELCOME_CREDITS} welcome credits without a credit card. Paid plans add monthly credits, and subscribers can buy top-up packs. Visit Pricing to compare the options.`,
  },
]

export default function HelpPage() {
  return (
    <PublicPageShell>
      <div className="mx-auto flex max-w-6xl flex-col gap-12">
        <header className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-fuchsia-500/20 flex items-center justify-center">
              <HelpCircle className="w-5 h-5 text-fuchsia-300" />
            </div>
            <h1 className="text-balance text-3xl font-bold text-foreground sm:text-4xl">A little help. A better photo.</h1>
          </div>
          <p className="text-muted-foreground text-pretty max-w-2xl">
            Find a quick answer, get more from your photos, or send our team a message.
            You do not need an account to get in touch.
          </p>
          <nav aria-label="Help sections" className="flex flex-wrap gap-5 text-sm font-medium text-foreground">
            <a href="#contact" className="underline decoration-primary underline-offset-4">Contact us</a>
            <a href="#faq" className="underline underline-offset-4">Common questions</a>
            <a href="#how-it-works" className="underline underline-offset-4">Getting started</a>
          </nav>
        </header>

        <div className="grid items-start gap-8 lg:grid-cols-2">
          <section id="contact" aria-labelledby="contact-title" className="scroll-mt-24 rounded-3xl border border-border bg-foreground/5 p-6 sm:p-8">
            <div className="flex flex-col gap-2 pb-6">
              <p className="text-sm font-semibold uppercase tracking-wider text-primary">Contact us</p>
              <h2 id="contact-title" className="text-2xl font-bold text-foreground">What can we help with?</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">Your message goes directly to our team. We will reply to the email address you provide.</p>
            </div>
            <ContactForm />
          </section>
          <section id="faq" aria-labelledby="faq-title" className="flex scroll-mt-24 flex-col gap-5">
            <h2 id="faq-title" className="text-2xl font-bold text-foreground">Common questions</h2>
            <FaqList items={FAQ} />
            <p className="text-sm leading-relaxed text-muted-foreground">Prefer email? <a href="mailto:5star.photos@allurahomes.com" className="break-all text-foreground underline underline-offset-4">5star.photos@allurahomes.com</a></p>
          </section>
        </div>

        <section aria-labelledby="how-it-works" className="flex flex-col gap-6">
          <h2 id="how-it-works" className="scroll-mt-24 text-xl font-semibold text-white">
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
                <p className="text-sm text-muted-foreground leading-relaxed">{step.body}</p>
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
          <p className="text-muted-foreground text-pretty">
            Every transform runs your photo through {ACTIVE_MODELS.length} different AI models at once. Each has its own
            personality, so you always have a choice.
          </p>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ACTIVE_MODELS.map((m) => (
              <li key={m.provider} className="glass-card rounded-2xl p-5 flex flex-col gap-2">
                <span className="text-2xl font-bold text-white">{m.label}</span>
                <p className="text-sm text-muted-foreground leading-relaxed">{m.description}</p>
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
          <p className="text-muted-foreground text-pretty">
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


      </div>
    </PublicPageShell>
  )
}
