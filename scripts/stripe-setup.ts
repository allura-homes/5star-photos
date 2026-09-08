// Idempotently creates the Stripe Products and Prices the app expects.
// Safe to re-run: existing Prices are matched by lookup key and left untouched.
//
//   node --env-file-if-exists=/vercel/share/.env.project --experimental-strip-types scripts/stripe-setup.ts

import Stripe from "stripe"
import {
  PLANS,
  PAID_PLAN_IDS,
  TOPUP_PACKS,
  planLookupKey,
  topupLookupKey,
  type BillingInterval,
} from "../lib/plans.ts"

const secretKey = process.env.STRIPE_SECRET_KEY
if (!secretKey) {
  console.error("STRIPE_SECRET_KEY is not set")
  process.exit(1)
}

const stripe = new Stripe(secretKey)

async function findOrCreateProduct(key: string, name: string, description: string) {
  const existing = await stripe.products.search({ query: `metadata["app_key"]:"${key}" AND active:"true"`, limit: 1 })
  if (existing.data[0]) return existing.data[0]
  return stripe.products.create({ name, description, metadata: { app_key: key, app: "5star.photos" } })
}

async function ensurePrice(params: {
  lookupKey: string
  productId: string
  unitAmount: number
  recurring?: { interval: BillingInterval }
  metadata: Record<string, string>
}) {
  const found = await stripe.prices.list({ lookup_keys: [params.lookupKey], active: true, limit: 1 })
  if (found.data[0]) {
    console.log(`  = ${params.lookupKey} (exists ${found.data[0].id})`)
    return found.data[0]
  }
  const price = await stripe.prices.create({
    product: params.productId,
    currency: "usd",
    unit_amount: params.unitAmount,
    lookup_key: params.lookupKey,
    recurring: params.recurring ? { interval: params.recurring.interval } : undefined,
    metadata: params.metadata,
  })
  console.log(`  + ${params.lookupKey} (${price.id})`)
  return price
}

async function main() {
  console.log("Subscriptions:")
  for (const planId of PAID_PLAN_IDS) {
    const plan = PLANS[planId]
    const product = await findOrCreateProduct(`plan_${planId}`, `5star.photos ${plan.name}`, plan.tagline)
    await ensurePrice({
      lookupKey: planLookupKey(planId, "month"),
      productId: product.id,
      unitAmount: plan.monthlyPriceCents,
      recurring: { interval: "month" },
      metadata: { plan: planId, interval: "month", credits: String(plan.monthlyCredits) },
    })
    await ensurePrice({
      lookupKey: planLookupKey(planId, "year"),
      productId: product.id,
      unitAmount: plan.annualPriceCents,
      recurring: { interval: "year" },
      metadata: { plan: planId, interval: "year", credits: String(plan.monthlyCredits) },
    })
  }

  console.log("Top-up packs:")
  const topupProduct = await findOrCreateProduct(
    "topup",
    "5star.photos credit top-up",
    "Extra credits for subscribers. Never expire while subscribed.",
  )
  for (const pack of TOPUP_PACKS) {
    await ensurePrice({
      lookupKey: topupLookupKey(pack.id),
      productId: topupProduct.id,
      unitAmount: pack.priceCents,
      metadata: { pack: pack.id, credits: String(pack.credits) },
    })
  }

  console.log("Done.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
