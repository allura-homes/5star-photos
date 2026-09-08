# Billing

_Last updated: September 2026 (credits + Stripe release)._

The app meters usage in **credits**. Credits come from a one-time welcome grant, a monthly/annual subscription, or one-time top-up packs. Payments are handled by Stripe Checkout (embedded) and the Stripe Customer Portal.

## Credit costs

Defined once in `lib/plans.ts → CREDIT_COSTS` and read everywhere (server enforcement, pricing page, help page, tooltips).

| Action | Credits | Where it is charged |
|---|---|---|
| Upload a photo | 1 | `lib/actions/image-actions.ts → uploadImage` |
| Transform (all models in the plan, one call) | 10 | `POST /api/edit-image` (first model call per transform) |
| Save a variation as a working image | 1 | `POST /api/save-variation` |
| Download hi-res | 3 | `lib/actions/image-actions.ts` signed-URL path |
| Upscale (deprecated route) | 2 | `POST /api/upscale` |

A "finished photo" (upload + transform + hi-res download) is **14 credits** (`PHOTO_COST`). If every model in a transform fails, the 10 credits are refunded automatically (`refund` ledger row).

## Tiers

| Plan | Monthly | Annual (2 months free) | Credits / month | Photos / month | Models |
|---|---|---|---|---|---|
| Free | $0 | – | 45 one-time welcome grant | 3 total | V1 + V2 |
| Start-up | $19 | $190 | 100 | ~7 | V1 + V2 |
| Pro | $49 | $490 | 270 | ~19 | every active model |
| Max | $99 | $990 | 570 | ~40 | every active model |

Top-up packs (subscribers only): 50 for $12, 150 for $32, 300 for $60. Packs are priced above every plan's per-credit rate so upgrading is always the better deal.

### Margin sketch

Model cost per transform is roughly $0.04 (gpt-image-1) + $0.13 (gemini-3-pro-image-preview) for the base pair, up to ~$0.30 with all models; storage/egress is negligible. At 10 credits per transform:

| Plan | $/credit | Model cost per 10 credits | Gross margin |
|---|---|---|---|
| Start-up | 19.0c | ~$0.17 | ~91% |
| Pro | 18.1c | ~$0.30 | ~83% |
| Max | 17.4c | ~$0.30 | ~83% |

Unused plan credits do not roll over, so realised margin is higher.

## Credit buckets and rules

`profiles` carries two buckets plus a mirror:

- `plan_credits` — reset to the plan's monthly amount on every paid invoice. Do not roll over.
- `topup_credits` — added by top-up purchases. Persist across periods. **Frozen while `plan = 'free'`**: they are kept but cannot be spent until the user resubscribes.
- `tokens` — legacy column kept in sync by a trigger so older UI keeps working. Always equals the *usable* balance: `plan_credits + (plan = 'free' ? 0 : topup_credits)`.

Spending order is plan credits first, then top-ups. All debits go through the `spend_credits(p_user, p_amount, p_type, ...)` Postgres function, which locks the row (`for update`), checks the balance, applies the debit and writes the `token_transactions` row **in one transaction**. Concurrent spends cannot overdraw. A negative `p_amount` is a credit back (refunds, admin grants).

`subscription_status = 'past_due'` blocks spending (returns `past_due`) until the invoice is paid.

Ledger `type` values: `upload, transform, save_variation, download_hires, upscale, refund, welcome_grant, plan_grant, period_reset, topup_purchase, admin_adjust` (plus legacy `purchase, revision, bonus`). The CHECK constraint on `token_transactions.type` is authoritative; an unknown type makes the insert fail.

## Stripe wiring

- Catalog: `lib/plans.ts` is the source of truth. `scripts/stripe-setup.ts` idempotently creates Products/Prices in Stripe and tags each Price with a **lookup key** (`5star_<plan>_<interval>`, `5star_topup_<n>`). The app resolves Prices by lookup key at runtime, so no Price IDs are stored anywhere.
- Checkout: `lib/actions/billing-actions.ts → createPlanCheckout / createTopupCheckout` create an embedded Checkout Session (`ui_mode: 'embedded'`) with `metadata.supabase_user_id` and the plan/pack id. `/checkout` renders it; `/checkout/return` polls `getMyBalance()` until the webhook lands (max ~15 s).
- Plan changes: `changePlan()` updates the subscription item in place. Upgrades are prorated immediately (`proration_behavior: 'always_invoice'`) and the webhook grants the new monthly amount; downgrades apply at period end.
- Portal: `createPortalSession()` opens the Stripe Customer Portal for card updates, cancellation, invoices.
- Webhook: `POST /api/stripe/webhook`.

| Event | Effect |
|---|---|
| `checkout.session.completed` (mode `payment`) | Adds the pack's credits to `topup_credits`; ledger `topup_purchase`. |
| `customer.subscription.created` / `updated` | Syncs `plan`, `billing_interval`, `subscription_status`, `current_period_end`, `cancel_at_period_end`. |
| `invoice.paid` | Sets `plan_credits` to the plan's monthly amount; ledger `plan_grant` (first) or `period_reset`. |
| `invoice.payment_failed` | `subscription_status = 'past_due'` (spending blocked). |
| `customer.subscription.deleted` | `plan = 'free'`, `plan_credits = 0`, top-ups frozen. |

Every event id is written to `stripe_events` first; a replayed event is acknowledged with `200` and ignored. Signature verification uses `STRIPE_WEBHOOK_SECRET`; a bad signature returns `400`.

Annual subscribers are invoiced once a year, so `GET /api/cron/grant-annual-credits` (Vercel Cron, daily 06:15 UTC, guarded by `CRON_SECRET`) resets `plan_credits` for annual users whose monthly anniversary has passed.

## Environment variables

| Variable | Scope | Purpose |
|---|---|---|
| `STRIPE_SECRET_KEY` | server | API calls, Checkout, Portal |
| `STRIPE_WEBHOOK_SECRET` | server | Webhook signature verification |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | client | Embedded Checkout (`@stripe/stripe-js`) |
| `CRON_SECRET` | server | Authorises the annual-credits cron |

## Changing prices or credits

1. Edit `lib/plans.ts` (prices, credits, pack sizes, `CREDIT_COSTS`).
2. Run `node --env-file-if-exists=/vercel/share/.env.project --experimental-strip-types scripts/stripe-setup.ts`. Existing Prices are immutable in Stripe, so a changed amount creates a new Price and moves the lookup key to it; existing subscriptions stay on the old Price until changed.
3. No DB migration is needed. Existing subscribers receive the new `monthlyCredits` on their next invoice.

## Go-live checklist

- [ ] Run `stripe-setup.ts` against the **live** key; confirm 6 plan Prices + 3 pack Prices exist with lookup keys.
- [ ] Add the live webhook endpoint (`https://<domain>/api/stripe/webhook`) with the five event types above; set `STRIPE_WEBHOOK_SECRET`.
- [ ] Enable the Customer Portal in the Stripe dashboard (allow cancel, update payment method, invoice history; disallow plan switching there — the app handles it).
- [ ] Set `CRON_SECRET` and confirm the cron shows in the Vercel project.
- [ ] Test-mode pass with card `4242 4242 4242 4242`: subscribe to each plan, upgrade Start-up → Pro mid-cycle (+170), buy a pack, cancel, resubscribe (top-ups thaw).
- [ ] Enable Google as an auth provider in Supabase if "Continue with Google" should work (Authentication → Providers → Google; add the OAuth client id/secret and the Supabase callback URL to Google Cloud). The app works with email-only if it is left off.
