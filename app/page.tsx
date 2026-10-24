import type { Metadata } from "next"
import DsxDashboard from "@/components/dsx/dsx-dashboard"

export const metadata: Metadata = {
  title: "POD delivery overview | FORMA",
  description:
    "Inspect every infrastructure component and recover disrupted supplier deliveries.",
}

export default function Page() {
  return <DsxDashboard />
}
