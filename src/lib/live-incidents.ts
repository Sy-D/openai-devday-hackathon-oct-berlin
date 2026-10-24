export type IncidentSourceId =
  "gdacs" | "eonet" | "autobahn" | "ndw" | "portwatch"

export type LiveIncident = {
  id: string
  sourceId: IncidentSourceId
  providerId: string
  title: string
  description: string
  kind:
    "earthquake" | "flood" | "storm" | "wildfire" | "road" | "port" | "other"
  severity: "critical" | "high" | "medium" | "low" | "unknown"
  status: "active" | "scheduled" | "resolved" | "historical" | "unknown"
  country: string
  location: string
  coordinates?: [number, number]
  startedAt?: string
  endedAt?: string
  updatedAt?: string
  fetchedAt: string
  url: string
  evidence: "reported-restriction" | "hazard" | "historical"
  attribution?: string
}

export type LiveSourceStatus = {
  id: IncidentSourceId
  name: string
  state: "loading" | "live" | "stale" | "unavailable" | "historical"
  checkedAt?: string
  lastSuccessAt?: string
  recordCount: number
  updateIntervalSeconds: number
  message?: string
  url: string
}

export type IncidentSnapshot = {
  version: 1
  revision: string
  generatedAt: string
  incidents: LiveIncident[]
  sources: LiveSourceStatus[]
}

export const INCIDENT_SOURCE_NAMES = {
  gdacs: "GDACS",
  eonet: "NASA EONET",
  autobahn: "Autobahn Germany",
  ndw: "NDW Netherlands",
  portwatch: "IMF PortWatch",
} satisfies Record<IncidentSourceId, string>
