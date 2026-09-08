import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Header } from "@/components/header"
import { CheckoutReturnStatus } from "@/components/billing/checkout-return-status"

export const metadata: Metadata = {
  title: "Finishing up - 5star.photos",
  robots: { index: false },
}

interface ReturnPageProps {
  searchParams: Promise<{ session_id?: string }>
}

export default async function CheckoutReturnPage({ searchParams }: ReturnPageProps) {
  const { session_id } = await searchParams
  if (!session_id) redirect("/pricing")

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 pt-20 flex items-center justify-center px-4">
        <CheckoutReturnStatus sessionId={session_id} />
      </main>
    </div>
  )
}
