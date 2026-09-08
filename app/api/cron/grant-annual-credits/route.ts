import { NextResponse } from "next/server"

import { createDirectClient } from "@/lib/supabase/direct"
import { setPlanCredits } from "@/lib/credits"
import { PLANS, isPaidPlanId } from "@/lib/plans"

export const runtime = "nodejs"

// Annual subscribers pay once a year but receive credits monthly. Vercel Cron
// calls this daily; each profile is granted at most once per calendar month.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get("authorization")
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createDirectClient()
  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, plan")
    .eq("billing_interval", "year")
    .in("subscription_status", ["active", "trialing"])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const monthStart = new Date()
  monthStart.setUTCDate(1)
  monthStart.setUTCHours(0, 0, 0, 0)

  let granted = 0
  for (const profile of profiles ?? []) {
    if (!isPaidPlanId(profile.plan)) continue

    const { data: existing } = await admin
      .from("token_transactions")
      .select("id")
      .eq("user_id", profile.id)
      .in("type", ["plan_grant", "period_reset"])
      .gte("created_at", monthStart.toISOString())
      .limit(1)

    if (existing && existing.length > 0) continue

    await setPlanCredits(
      profile.id,
      PLANS[profile.plan].monthlyCredits,
      "period_reset",
      `${PLANS[profile.plan].name} monthly credits (annual plan)`,
    )
    granted += 1
  }

  return NextResponse.json({ checked: profiles?.length ?? 0, granted })
}
