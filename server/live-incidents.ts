import { createHash } from "node:crypto"
import type {
  IncidentSnapshot,
  LiveIncident,
  LiveSourceStatus,
} from "../src/lib/live-incidents"
import { incidentProviders, type IncidentProvider } from "./incident-providers"

type CachedSource = {
  incidents: LiveIncident[]
  status: LiveSourceStatus
  nextCheck: number
  inFlight?: Promise<void>
}
type Listener = (snapshot: IncidentSnapshot) => void

export function incidentRevision(
  incidents: LiveIncident[],
  sources: LiveSourceStatus[]
): string {
  // Retrieval timestamps change on successful polling without changing the event.
  const substantive = incidents
    .map((record) => ({ ...record, fetchedAt: undefined }))
    .sort((a, b) => a.id.localeCompare(b.id))
  const health = sources.map(({ id, state, recordCount, message }) => ({
    id,
    state,
    recordCount,
    message,
  }))
  return createHash("sha256")
    .update(JSON.stringify({ incidents: substantive, sources: health }))
    .digest("hex")
    .slice(0, 24)
}

export function createIncidentHub(
  providers: IncidentProvider[] = incidentProviders,
  options: { now?: () => number; pollIntervalMs?: number } = {}
) {
  const now = options.now ?? Date.now
  const cache = new Map<string, CachedSource>(
    providers.map((provider) => [
      provider.id,
      {
        incidents: [],
        nextCheck: 0,
        status: {
          id: provider.id,
          name: provider.name,
          state: "loading",
          recordCount: 0,
          updateIntervalSeconds: provider.intervalSeconds,
          url: provider.url,
        },
      },
    ])
  )
  const listeners = new Set<Listener>()
  let pollTimer: ReturnType<typeof setInterval> | undefined
  let broadcastInFlight: Promise<void> | undefined

  async function refresh(provider: IncidentProvider): Promise<void> {
    const entry = cache.get(provider.id)!
    if (entry.inFlight) return entry.inFlight
    if (now() < entry.nextCheck) return
    const checkedAt = new Date(now()).toISOString()
    entry.inFlight = (async () => {
      try {
        const batch = await provider.load(new Date(checkedAt))
        entry.incidents = [
          ...new Map(
            batch.incidents.map((record) => [record.id, record])
          ).values(),
        ]
        entry.status = {
          ...entry.status,
          state: batch.stale
            ? "stale"
            : provider.historical
              ? "historical"
              : "live",
          checkedAt,
          lastSuccessAt: new Date(now()).toISOString(),
          recordCount: entry.incidents.length,
          message: batch.message,
        }
      } catch (error) {
        const reason =
          error instanceof Error &&
          (error.name === "TimeoutError" || error.name === "AbortError")
            ? "Provider request timed out."
            : error instanceof Error &&
                error.message.startsWith("Provider returned HTTP")
              ? `${error.message}.`
              : "Provider response could not be retrieved or validated."
        entry.status = {
          ...entry.status,
          state: entry.status.lastSuccessAt ? "stale" : "unavailable",
          checkedAt,
          message: `${reason} ${entry.status.lastSuccessAt ? "Showing the last successful snapshot; missing records do not mean resolved incidents." : "No successful snapshot available. No simulated data substituted."}`,
        }
      } finally {
        // Start the interval after completion, and back off failures as well.
        entry.nextCheck = now() + provider.intervalSeconds * 1000
        entry.inFlight = undefined
      }
    })()
    return entry.inFlight
  }

  async function getSnapshot(): Promise<IncidentSnapshot> {
    await Promise.all(providers.map(refresh))
    const incidents = providers
      .flatMap((provider) => cache.get(provider.id)!.incidents)
      .sort(
        (a, b) =>
          (b.updatedAt ?? b.startedAt ?? "").localeCompare(
            a.updatedAt ?? a.startedAt ?? ""
          ) || a.id.localeCompare(b.id)
      )
    const sources = providers.map((provider) => ({
      ...cache.get(provider.id)!.status,
    }))
    return {
      version: 1,
      revision: incidentRevision(incidents, sources),
      generatedAt: new Date(now()).toISOString(),
      incidents,
      sources,
    }
  }

  function broadcast(): Promise<void> {
    if (broadcastInFlight) return broadcastInFlight
    broadcastInFlight = getSnapshot()
      .then((snapshot) => {
        for (const listener of listeners) listener(snapshot)
      })
      .finally(() => {
        broadcastInFlight = undefined
      })
    return broadcastInFlight
  }

  function subscribe(listener: Listener): () => void {
    listeners.add(listener)
    if (!pollTimer)
      pollTimer = setInterval(() => {
        void broadcast()
      }, options.pollIntervalMs ?? 15_000)
    // A new connection always receives a complete current snapshot. Last-Event-ID
    // is not an event-log cursor; provider snapshots are reconciled by stable IDs.
    void getSnapshot().then((snapshot) => {
      if (listeners.has(listener)) listener(snapshot)
    })
    return () => {
      listeners.delete(listener)
      if (!listeners.size && pollTimer) {
        clearInterval(pollTimer)
        pollTimer = undefined
      }
    }
  }

  return { getSnapshot, subscribe }
}

export type IncidentHub = ReturnType<typeof createIncidentHub>
// Share both polling and successful provider data across requests and hot reloads.
// Each hosted process has its own bounded cache; this is not a durable event store.
// SAFETY: this module owns this optional global property and only assigns createIncidentHub() results.
const globalIncidentState = globalThis as typeof globalThis & {
  formaIncidentHubV2?: IncidentHub
}
export const liveIncidentHub = (globalIncidentState.formaIncidentHubV2 ??=
  createIncidentHub())
