import type { Metadata } from "next"
import DsxDashboard from "@/components/dsx/dsx-dashboard"
import LiveDsxDashboard from "@/components/dsx/live-dsx-dashboard"

export const metadata: Metadata = {
  title: "Infrastructure workspace | FORMA",
  description:
    "Explore sourced hardware references and monitor real infrastructure incidents.",
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; component?: string }>
}) {
  const { mode, component } = await searchParams
  return mode === "demo" ? (
    <DsxDashboard />
  ) : (
    <LiveDsxDashboard initialComponent={component} />
  )
}
