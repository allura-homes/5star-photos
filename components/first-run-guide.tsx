"use client"

import { useState } from "react"
import Image from "next/image"
import { Upload, Wand2, Download, Sparkles, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { uploadImage } from "@/lib/actions/image-actions"
import { prepareImageForUpload } from "@/lib/compress-image"
import type { PhotoClassification } from "@/lib/types"

/**
 * Shown in the Library when a user has no photos yet.
 * Three steps plus a one-click sample so people can see a result without
 * having to dig out a photo of their own first.
 */

const SAMPLE = {
  src: "/images/hero/living1-before.jpg",
  fileName: "sample-living-room.jpg",
  classification: "indoor" as PhotoClassification,
}

const STEPS = [
  { icon: Upload, title: "Upload", body: "Drop in a listing photo. We detect indoor vs outdoor automatically." },
  { icon: Wand2, title: "Enhance", body: "Press Transform. Three AI models each give you a version to compare." },
  { icon: Download, title: "Download", body: "Save the one you like and download it full-resolution, watermark-free." },
]

export function FirstRunGuide({ onSampleAdded, onUploadClick }: { onSampleAdded: () => void; onUploadClick: () => void }) {
  const [busy, setBusy] = useState(false)

  async function addSample() {
    setBusy(true)
    try {
      const res = await fetch(SAMPLE.src)
      if (!res.ok) throw new Error(`sample fetch failed: ${res.status}`)
      const blob = await res.blob()
      // The hero asset is a full-size photo; shrink it the same way the
      // regular uploader does so it fits the server-action body limit.
      const base64 = await prepareImageForUpload(blob)
      const { error } = await uploadImage(base64, SAMPLE.fileName, "image/jpeg", SAMPLE.classification)
      if (error) {
        toast.error("Couldn't add the sample photo. Try uploading one of your own instead.")
      } else {
        toast.success("Sample added. Open it and press Transform to see the magic.")
        onSampleAdded()
      }
    } catch {
      toast.error("Couldn't add the sample photo. Try uploading one of your own instead.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="first-run-title" className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h2 id="first-run-title" className="text-2xl font-bold text-white text-balance">
          Three steps to a photo that books
        </h2>
        <p className="text-slate-400 text-pretty max-w-2xl">
          Your library is empty. Here is the whole workflow; the first result takes about a minute.
        </p>
      </div>

      <ol className="grid gap-4 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <li key={step.title} className="glass-card rounded-2xl p-5 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-white/10 text-xs font-semibold text-white flex items-center justify-center">
                {i + 1}
              </span>
              <step.icon className="w-5 h-5 text-fuchsia-300" aria-hidden="true" />
              <h3 className="font-semibold text-white">{step.title}</h3>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">{step.body}</p>
          </li>
        ))}
      </ol>

      <div className="glass-card rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-5">
        <div className="relative w-full sm:w-40 aspect-[3/2] rounded-xl overflow-hidden shrink-0">
          <Image src={SAMPLE.src} alt="Sample living room before enhancement" fill className="object-cover" sizes="160px" />
        </div>
        <div className="flex-1 flex flex-col gap-1">
          <p className="font-medium text-white">No photo handy? Try ours.</p>
          <p className="text-sm text-slate-400 text-pretty">
            We&apos;ll drop a sample living room into your library so you can run a transform right now.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={addSample}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl gradient-magenta-violet text-white font-medium hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100 transition-transform"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Sparkles className="w-4 h-4" aria-hidden="true" />}
            Try a sample photo
          </button>
          <button
            type="button"
            onClick={onUploadClick}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 text-white font-medium hover:bg-white/15 transition-colors"
          >
            <Upload className="w-4 h-4" aria-hidden="true" />
            Upload my own
          </button>
        </div>
      </div>
    </section>
  )
}
