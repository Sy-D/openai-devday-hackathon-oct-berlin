import type { Metadata } from "next"
import { redirect } from "next/navigation"
import DsxDashboard from "@/components/dsx/dsx-dashboard"

export const metadata: Metadata = {
  title: "POD delivery overview | FORMA",
  description:
    "Inspect every infrastructure component and recover disrupted supplier deliveries.",
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ panel?: string }>
}) {
  const { panel } = await searchParams
  if (panel === "compare" || panel === "research" || panel === "memo")
    redirect(`/suppliers?panel=${panel}`)
  return <DsxDashboard />
}
