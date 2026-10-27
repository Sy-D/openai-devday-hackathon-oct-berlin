import type { Metadata } from "next"
import LiveDsxDashboard from "@/components/dsx/live-dsx-dashboard"

export const metadata: Metadata = {
  title: "Infrastructure workspace | FORMA",
  description:
    "Explore sourced hardware and plan real deliveries against live incident reports.",
}
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ component?: string; mode?: string }>
}) {
  const { component } = await searchParams
  return <LiveDsxDashboard initialComponent={component} />
}
