import type { Metadata } from "next"
import { LegalPage } from "@/components/legal-page"

export const metadata: Metadata = {
  title: "Privacy Policy - 5star.photos",
  description: "How 5star.photos collects, uses and protects your photos and account data.",
}

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="September 4, 2026"
      intro="5star.photos is operated by Allura Homes. This policy explains what we collect when you use the service, why we collect it, and the choices you have. We keep it short on purpose; if anything is unclear, email support@5star.photos."
      sections={[
        {
          heading: "What we collect",
          body: [
            "Account information: your email address, a display name if you set one, and your sign-in method. Passwords are handled by our authentication provider (Supabase) and are never visible to us.",
            "Your photos: the original images you upload and the enhanced variations you choose to save. We also store the room classification (indoor or outdoor) and the enhancement settings you pick so we can reproduce results.",
            "Usage records: a log of actions such as uploads, transforms and downloads, and the token balance associated with your account.",
            "Feedback: if you rate a variation with a thumbs up or down, we record that rating alongside the model that produced it.",
          ],
        },
        {
          heading: "How we use it",
          body: [
            "To run the service: storing your library, generating enhanced variations and letting you download them.",
            "To improve enhancement quality: aggregated thumbs-up and thumbs-down feedback helps us decide which AI models to keep. Admins may review rated examples to tune prompts. We do not sell your photos or use them to train third-party models.",
            "To keep the service safe: rate limiting, abuse detection and debugging.",
          ],
        },
        {
          heading: "Who processes your photos",
          body: [
            "To create enhanced variations, your photo is sent to one or more third-party AI image providers (currently OpenAI and Google). They process the image to return a result and are contractually bound not to use API inputs for training. Photos are also stored on Vercel Blob and Supabase Storage, both hosted in the United States.",
          ],
        },
        {
          heading: "Retention and deletion",
          body: [
            "Your photos stay in your library until you delete them. Deleting a photo removes the original and every saved variation from storage.",
            "You can delete your whole account by contacting support@5star.photos. We remove your profile, photos and usage records within 30 days, except where we must keep minimal records for legal or accounting reasons.",
          ],
        },
        {
          heading: "Cookies",
          body: [
            "We use strictly necessary cookies to keep you signed in. We do not use advertising or cross-site tracking cookies.",
          ],
        },
        {
          heading: "Your rights",
          body: [
            "You can access, correct or export your data, or ask us to delete it, at any time by emailing support@5star.photos. If you are in the EU, UK or California you have additional statutory rights which we honour on request.",
          ],
        },
        {
          heading: "Changes",
          body: [
            "If we make a material change to this policy we will show a notice in the app before it takes effect.",
          ],
        },
      ]}
    />
  )
}
