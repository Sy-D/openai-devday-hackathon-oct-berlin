import type { Metadata } from "next"
import { getPartReference } from "@/src/data/part-catalog"
import { IncidentsDashboard } from "@/components/incidents/incidents-dashboard"

export const metadata: Metadata = {
  title: "Live incidents | FORMA",
  description:
    "Source-reported hazards and transport restrictions, with provider freshness and evidence.",
}

export default async function IncidentsPage({
  searchParams,
}: {
  searchParams: Promise<{ component?: string }>
}) {
  const { component } = await searchParams
  return (
    <IncidentsDashboard
      componentId={getPartReference(component ?? "")?.componentId}
    />
  )
}
