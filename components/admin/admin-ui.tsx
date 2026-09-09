"use client"

import type { ReactNode } from "react"

export const STRIPE_DASHBOARD = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith("pk_live")
  ? "https://dashboard.stripe.com"
  : "https://dashboard.stripe.com/test"

export function formatDate(dateString: string | null): string {
  if (!dateString) return "—"
  return new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export function formatDateTime(dateString: string | null): string {
  if (!dateString) return "—"
  return new Date(dateString).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: cents % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`
}

/** Small pill used across the admin panel. Tone maps to a semantic color. */
export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode
  tone?: "neutral" | "success" | "warning" | "danger" | "info" | "brand"
}) {
  const tones: Record<string, string> = {
    neutral: "bg-slate-500/20 text-slate-300",
    success: "bg-emerald-500/20 text-emerald-300",
    warning: "bg-amber-500/20 text-amber-300",
    danger: "bg-red-500/20 text-red-300",
    info: "bg-sky-500/20 text-sky-300",
    brand: "bg-[#FF3EDB]/15 text-[#FF3EDB]",
  }
  return (
    <span className={`inline-flex w-fit items-center px-2 py-1 rounded-full text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  )
}

export function subscriptionTone(status: string | null): "success" | "warning" | "danger" | "neutral" {
  if (status === "active" || status === "trialing") return "success"
  if (status === "past_due") return "warning"
  if (status === "canceled") return "danger"
  return "neutral"
}

export function jobStatusTone(status: string): "success" | "danger" | "warning" {
  if (status === "done") return "success"
  if (status === "error") return "danger"
  return "warning"
}
