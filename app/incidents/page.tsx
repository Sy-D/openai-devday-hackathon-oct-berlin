import type { Metadata } from "next"
import { IncidentsDashboard } from "@/components/incidents/incidents-dashboard"

export const metadata: Metadata = {
  title: "Live incidents | FORMA",
  description:
    "Source-reported hazards and transport restrictions, with provider freshness and evidence.",
}

export default function IncidentsPage() {
  return <IncidentsDashboard />
}
