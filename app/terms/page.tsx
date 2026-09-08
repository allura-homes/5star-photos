import type { Metadata } from "next"
import { LegalPage } from "@/components/legal-page"

export const metadata: Metadata = {
  title: "Terms of Service - 5star.photos",
  description: "The terms that govern your use of 5star.photos.",
}

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="September 8, 2026"
      intro="These terms are an agreement between you and Allura Homes covering your use of 5star.photos. By creating an account you agree to them."
      sections={[
        {
          heading: "The service",
          body: [
            "5star.photos uses AI models to enhance real estate photographs. Usage is metered in credits. New accounts receive a one-time grant of welcome credits; further credits come from a monthly or annual subscription plan or from one-time top-up packs. Features, limits and pricing may change, and we will give notice in the app before any change affects what you pay.",
          ],
        },
        {
          heading: "Your content",
          body: [
            "You keep all rights to the photos you upload and to the enhanced variations you download. You grant us only the licence needed to store, process and display them back to you.",
            "You must have the right to upload every photo. Do not upload images you do not own or have permission to use, images of people without their consent, or anything unlawful.",
          ],
        },
        {
          heading: "Truthful listings",
          body: [
            "Enhanced photos are intended to present a property accurately in its best light: correct exposure, colour and clutter removal. The models are instructed not to alter structure, layout or fixtures. You are responsible for making sure any photo you publish does not misrepresent the property to guests or buyers.",
          ],
        },
        {
          heading: "Acceptable use",
          body: [
            "Do not attempt to access other users' data, circumvent authentication, overload the service, or use automated tooling against our APIs without written permission.",
          ],
        },
        {
          heading: "Credits and billing",
          body: [
            "Credits are consumed as described on the Pricing and Help pages. Plan credits reset at the start of each billing period and unused plan credits do not roll over. Top-up credits do not expire while a subscription is active; if the subscription ends they are held and become usable again on resubscribing. Credits have no cash value, are non-transferable and are not refundable except where required by law. A transform that returns no result is automatically refunded.",
            "Subscriptions renew automatically until cancelled. You can cancel, upgrade or downgrade at any time from your Account page. Upgrades take effect immediately and are prorated; downgrades and cancellations take effect at the end of the current billing period. Payments are processed by Stripe.",
          ],
        },
        {
          heading: "Availability and warranty",
          body: [
            "AI providers occasionally fail or decline an edit. We do not guarantee that every transform will succeed or that results will meet a particular standard. The service is provided as is, without warranties of any kind, to the extent permitted by law.",
          ],
        },
        {
          heading: "Liability",
          body: [
            "To the fullest extent permitted by law, Allura Homes is not liable for indirect or consequential losses arising from your use of the service. Our total liability for any claim is limited to the amount you paid us in the twelve months before the claim.",
          ],
        },
        {
          heading: "Termination",
          body: [
            "You may stop using the service and request account deletion at any time. We may suspend accounts that violate these terms.",
          ],
        },
        {
          heading: "Contact",
          body: ["Questions about these terms: support@5star.photos."],
        },
      ]}
    />
  )
}
