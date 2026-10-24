import { z } from "zod"
import type { IncidentSnapshot, LiveIncident } from "@/src/lib/live-incidents"

const sourceId = z.enum(["gdacs", "eonet", "autobahn", "ndw", "portwatch"])
const timestamp = z
  .string()
  .refine((value) => Number.isFinite(Date.parse(value)))
const sourceUrl = z
  .string()
  .url()
  .refine((value) => /^https?:\/\//i.test(value))
const incidentSchema = z.object({
  id: z.string().min(1),
  sourceId,
  providerId: z.string(),
  title: z.string().min(1),
  description: z.string(),
  kind: z.enum([
    "earthquake",
    "flood",
    "storm",
    "wildfire",
    "road",
    "port",
    "other",
  ]),
  severity: z.enum(["critical", "high", "medium", "low", "unknown"]),
  status: z.enum(["active", "scheduled", "resolved", "historical", "unknown"]),
  country: z.string(),
  location: z.string(),
  coordinates: z
    .tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])
    .optional(),
  startedAt: timestamp.optional(),
  endedAt: timestamp.optional(),
  updatedAt: timestamp.optional(),
  fetchedAt: timestamp,
  url: sourceUrl,
  evidence: z.enum(["reported-restriction", "hazard", "historical"]),
  attribution: z.string().optional(),
})
const snapshotSchema = z.object({
  version: z.literal(1),
  revision: z.string().min(1),
  generatedAt: timestamp,
  incidents: z.array(incidentSchema),
  sources: z.array(
    z.object({
      id: sourceId,
      name: z.string().min(1),
      state: z.enum(["loading", "live", "stale", "unavailable", "historical"]),
      checkedAt: timestamp.optional(),
      lastSuccessAt: timestamp.optional(),
      recordCount: z.number().int().nonnegative(),
      updateIntervalSeconds: z.number().positive(),
      message: z.string().optional(),
      url: sourceUrl,
    })
  ),
})

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- Network payload boundary: Zod validates every field before returning the domain snapshot.
export function parseIncidentSnapshot(value: unknown): IncidentSnapshot | null {
  const parsed = snapshotSchema.safeParse(value)
  if (!parsed.success) return null
  const snapshot = parsed.data
  if (
    new Set(snapshot.incidents.map((incident) => incident.id)).size !==
    snapshot.incidents.length
  )
    return null
  if (
    new Set(snapshot.sources.map((source) => source.id)).size !==
    snapshot.sources.length
  )
    return null
  return snapshot
}

export const sourceNames = {
  gdacs: "GDACS",
  eonet: "NASA EONET",
  autobahn: "Autobahn Germany",
  ndw: "NDW Netherlands",
  portwatch: "IMF PortWatch",
} as const

export const kindLabels = {
  earthquake: "Earthquake",
  flood: "Flood",
  storm: "Storm",
  wildfire: "Wildfire",
  road: "Road restriction",
  port: "Port disruption",
  other: "Other event",
} satisfies Record<LiveIncident["kind"], string>
export const statusLabels = {
  active: "Active",
  scheduled: "Scheduled",
  resolved: "Resolved by source",
  historical: "Historical",
  unknown: "Status not supplied",
} satisfies Record<LiveIncident["status"], string>
export const evidenceLabels = {
  "reported-restriction": "Reported restriction",
  hazard: "Hazard report",
  historical: "Historical record",
} satisfies Record<LiveIncident["evidence"], string>

export function isCurrentIncident(incident: LiveIncident) {
  return (
    incident.status !== "resolved" &&
    incident.status !== "historical" &&
    incident.evidence !== "historical"
  )
}

export function latestIncidentTime(incident: LiveIncident) {
  return Date.parse(incident.updatedAt ?? incident.fetchedAt)
}

export function sortIncidents(incidents: LiveIncident[]) {
  return [...incidents].sort(
    (a, b) =>
      latestIncidentTime(b) - latestIncidentTime(a) || a.id.localeCompare(b.id)
  )
}

export function formatIncidentTime(value?: string) {
  if (!value) return "Not supplied"
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return "Not supplied"
  return `${date.toISOString().slice(0, 10)} · ${date.toISOString().slice(11, 16)} UTC`
}

/** Provider facts change alerts; polling timestamps alone do not. */
export function incidentFingerprint(incident: LiveIncident) {
  return JSON.stringify({ ...incident, fetchedAt: undefined })
}

export function countIncidentChanges(
  previous: LiveIncident[],
  next: LiveIncident[]
) {
  const oldRecords = new Map(
    previous.map((incident) => [incident.id, incidentFingerprint(incident)])
  )
  let added = 0
  let updated = 0
  for (const incident of next) {
    const old = oldRecords.get(incident.id)
    if (old === undefined) added += 1
    else if (old !== incidentFingerprint(incident)) updated += 1
  }
  return { added, updated }
}
