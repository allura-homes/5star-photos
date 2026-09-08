import "server-only"

import Stripe from "stripe"

const secretKey = process.env.STRIPE_SECRET_KEY
if (!secretKey) {
  throw new Error("STRIPE_SECRET_KEY is not set")
}

export const stripe = new Stripe(secretKey, {
  typescript: true,
  appInfo: { name: "5star.photos", url: "https://5star.photos" },
})

// Resolves a Price by its lookup key so we never persist generated Stripe IDs.
const priceCache = new Map<string, string>()

export async function getPriceIdByLookupKey(lookupKey: string): Promise<string> {
  const cached = priceCache.get(lookupKey)
  if (cached) return cached

  const prices = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 })
  const price = prices.data[0]
  if (!price) {
    throw new Error(`Stripe price with lookup key "${lookupKey}" not found. Run scripts/stripe-setup.ts.`)
  }
  priceCache.set(lookupKey, price.id)
  return price.id
}

export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL
  if (explicit) return explicit.replace(/\/$/, "")
  const vercel = process.env.NEXT_PUBLIC_VERCEL_URL || process.env.VERCEL_URL
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`
  return "http://localhost:3000"
}
