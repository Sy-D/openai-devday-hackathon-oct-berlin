// Deterministic workload, never used as application incident data.
import { performance } from "node:perf_hooks"
import { matchRouteIncidents } from "../src/lib/procurement-impact"
import type { IncidentSnapshot } from "../src/lib/live-incidents"
import type { RoadRoute } from "../src/lib/procurement"

const route: RoadRoute = {
  id: "benchmark",
  label: "Benchmark",
  distanceKm: 270,
  durationSeconds: 10800,
  avoidance: false,
  coordinates: Array.from({ length: 2500 }, (_, i) => [
    10 + i / 1000,
    53 + Math.sin(i / 100) / 100,
  ]),
}
const now = new Date().toISOString()
const snapshot: IncidentSnapshot = {
  version: 1,
  revision: "benchmark",
  generatedAt: now,
  sources: [
    {
      id: "autobahn",
      name: "Benchmark",
      state: "live",
      recordCount: 4000,
      lastSuccessAt: now,
      updateIntervalSeconds: 60,
      url: "https://example.com",
    },
  ],
  incidents: Array.from({ length: 4000 }, (_, i) => ({
    id: `benchmark-${i}`,
    providerId: String(i),
    sourceId: "autobahn",
    title: "Benchmark",
    description: "Benchmark fixture",
    kind: "road",
    severity: "medium",
    status: "active",
    country: "Germany",
    location: "Benchmark",
    coordinates: i < 40 ? route.coordinates[i * 50] : [30 + i / 10000, 40],
    fetchedAt: now,
    url: "https://example.com",
    evidence: "reported-restriction",
  })),
}
for (let i = 0; i < 3; i++) matchRouteIncidents(route, snapshot)
const times = Array.from({ length: 15 }, () => {
  const start = performance.now()
  const matches = matchRouteIncidents(route, snapshot)
  if (matches.length !== 40) throw new Error("Expected 40 matching reports")
  return performance.now() - start
}).sort((a, b) => a - b)
console.log(
  JSON.stringify(
    {
      vertices: 2500,
      incidents: 4000,
      matches: 40,
      samples: times.length,
      medianMs: times[7],
      p95Ms: times[14],
    },
    null,
    2
  )
)
