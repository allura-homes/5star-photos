import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Coins, Images, Layers, Shield, ArrowRight } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { getAccountSummary } from "@/lib/actions/account-actions"
import { getTokenHistory } from "@/lib/actions/token-actions"
import { getBalance } from "@/lib/credits"
import { BillingSection } from "@/components/billing/billing-section"
import { DisplayNameForm } from "@/components/account/display-name-form"
import { PhoneLinkForm } from "@/components/account/phone-link-form"
import { SignOutButton } from "@/components/account/sign-out-button"
import { TransactionList } from "@/components/account/transaction-list"

export const metadata: Metadata = {
  title: "Account - 5star.photos",
}

export default async function AccountPage() {
  const [{ account }, { transactions }] = await Promise.all([getAccountSummary(), getTokenHistory(25)])

  if (!account) redirect("/auth/login?redirect=/account")

  const balance = await getBalance(account.id)

  const joined = new Date(account.created_at).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto flex flex-col gap-10">
        <header className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold text-white">Account</h1>
          <p className="text-slate-400">Member since {joined}</p>
        </header>

        <section aria-labelledby="usage" className="grid gap-4 sm:grid-cols-3">
          <h2 id="usage" className="sr-only">
            Usage
          </h2>
          <StatCard icon={Images} label="Photos" value={account.image_count} />
          <StatCard icon={Layers} label="Saved variations" value={account.saved_variation_count} />
          <StatCard icon={Coins} label="Credits available" value={balance?.total ?? account.tokens} tone="amber" />
        </section>

        {balance && <BillingSection balance={balance} />}

        <section aria-labelledby="profile" className="glass-card rounded-2xl p-6 flex flex-col gap-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="profile" className="text-lg font-semibold text-white">
                Profile
              </h2>
              <p className="text-sm text-slate-400">{account.email}</p>
            </div>
            {account.role === "admin" && (
              <Link
                href="/admin"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/15 text-red-300 text-sm font-medium hover:bg-red-500/25 transition-colors"
              >
                <Shield className="w-4 h-4" aria-hidden="true" />
                Admin
              </Link>
            )}
          </div>
          <DisplayNameForm initialName={account.display_name ?? ""} />
        </section>

        <section aria-labelledby="phone-login" className="glass-card rounded-2xl p-6 flex flex-col gap-4">
          <div>
            <h2 id="phone-login" className="text-lg font-semibold text-white">
              Text sign-in
            </h2>
            <p className="text-sm text-slate-400">
              Verify a phone number to sign in with a text code instead of a password.
            </p>
          </div>
          <PhoneLinkForm initialPhone={account.phone} initialVerified={account.phone_verified} />
        </section>

        <section aria-labelledby="history" className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 id="history" className="text-lg font-semibold text-white">
              Recent activity
            </h2>
            <Link
              href="/history"
              className="inline-flex items-center gap-1 text-sm text-fuchsia-300 hover:text-fuchsia-200 transition-colors"
            >
              Full history
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
          <TransactionList transactions={transactions ?? []} />
        </section>

        <section aria-labelledby="session" className="glass-card rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 id="session" className="text-lg font-semibold text-white">
              Session
            </h2>
            <p className="text-sm text-slate-400">Sign out of this device.</p>
          </div>
          <SignOutButton />
        </section>
      </div>
    </AppShell>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: typeof Images
  label: string
  value: number | string
  tone?: "default" | "amber"
}) {
  return (
    <div className="glass-card rounded-2xl p-5 flex items-center gap-4">
      <div
        className={`w-11 h-11 rounded-xl flex items-center justify-center ${
          tone === "amber" ? "bg-amber-500/15 text-amber-300" : "bg-white/10 text-slate-200"
        }`}
      >
        <Icon className="w-5 h-5" aria-hidden="true" />
      </div>
      <div className="flex flex-col">
        <span className="text-2xl font-bold text-white leading-none">{value}</span>
        <span className="text-xs text-slate-400 mt-1">{label}</span>
      </div>
    </div>
  )
}
