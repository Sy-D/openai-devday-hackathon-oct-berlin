"use client"

import { useSyncExternalStore } from "react"
import type { IncidentSnapshot } from "@/src/lib/live-incidents"
import { countIncidentChanges, parseIncidentSnapshot } from "./incident-data"

type Connection = "connecting" | "connected" | "reconnecting" | "unavailable"
export type LiveIncidentState = {
  snapshot: IncidentSnapshot | null
  connection: Connection
  error: string | null
  receivedAt: string | null
  change: { revision: string; added: number; updated: number } | null
}

const initialState: LiveIncidentState = {
  snapshot: null,
  connection: "connecting",
  error: null,
  receivedAt: null,
  change: null,
}
let state = initialState
const listeners = new Set<() => void>()
let stream: EventSource | null = null
let controller: AbortController | null = null
let closeTimer: ReturnType<typeof setTimeout> | undefined
let freshnessTimer: ReturnType<typeof setInterval> | undefined

function publish(next: LiveIncidentState) {
  state = next
  listeners.forEach((listener) => listener())
}

function accept(next: IncidentSnapshot, fromStream: boolean) {
  if (
    state.snapshot &&
    Date.parse(next.generatedAt) < Date.parse(state.snapshot.generatedAt)
  )
    return
  const changedRevision = next.revision !== state.snapshot?.revision
  const change =
    state.snapshot && changedRevision
      ? {
          revision: next.revision,
          ...countIncidentChanges(state.snapshot.incidents, next.incidents),
        }
      : null
  publish({
    ...state,
    snapshot: next,
    connection: fromStream ? "connected" : state.connection,
    error: null,
    receivedAt: new Date().toISOString(),
    // Repeated snapshots refresh health without replaying incident alerts.
    change: change && (change.added || change.updated) ? change : state.change,
  })
}

function connect() {
  if (stream || !listeners.size) return
  freshnessTimer ??= setInterval(() => {
    if (!state.snapshot) return
    const now = Date.now()
    // A silent/disconnected stream must not retain a live freshness claim forever.
    const sources = state.snapshot.sources.map((source) => {
      if (source.state !== "live") return source
      const age =
        now - Date.parse(source.lastSuccessAt ?? state.snapshot!.generatedAt)
      if (
        Number.isFinite(age) &&
        age <= Math.max(120_000, source.updateIntervalSeconds * 2000 + 30_000)
      )
        return source
      return {
        ...source,
        state: "stale" as const,
        message:
          "No recent successful source update. Retaining the last received reports for review.",
      }
    })
    publish({ ...state, snapshot: { ...state.snapshot, sources } })
  }, 30_000)
  publish({
    ...state,
    connection: state.snapshot ? "reconnecting" : "connecting",
  })
  controller = new AbortController()
  const request = controller
  void fetch("/api/incidents", { cache: "no-store", signal: request.signal })
    .then(async (response) => {
      if (!response.ok)
        throw new Error(`Incident service returned ${response.status}`)
      const next = parseIncidentSnapshot(await response.json())
      if (request.signal.aborted) return
      if (next) accept(next, false)
      else
        publish({
          ...state,
          error:
            "An update could not be verified. Keeping the last valid records.",
        })
    })
    .catch(() => {
      if (request.signal.aborted) return
      publish({
        ...state,
        connection:
          state.connection === "connected"
            ? "connected"
            : state.snapshot
              ? "reconnecting"
              : "unavailable",
        error: state.snapshot
          ? "Latest fetch failed. Keeping the last received records while the stream reconnects."
          : "Incident service is unavailable.",
      })
    })
  const current = new EventSource("/api/incidents/stream")
  stream = current
  current.addEventListener("snapshot", (event: MessageEvent<string>) => {
    if (stream !== current) return
    try {
      const next = parseIncidentSnapshot(JSON.parse(event.data))
      if (next) accept(next, true)
      else
        publish({
          ...state,
          error:
            "An update could not be verified. Keeping the last valid records.",
        })
    } catch {
      publish({
        ...state,
        error: "An update could not be read. Keeping the last valid records.",
      })
    }
  })
  current.onopen = () => {
    if (stream === current) publish({ ...state, connection: "connected" })
  }
  current.onerror = () => {
    if (stream === current)
      publish({
        ...state,
        connection: state.snapshot ? "reconnecting" : "unavailable",
      })
    // EventSource resumes automatically; keep all verified data during outages.
  }
}

function subscribe(listener: () => void) {
  clearTimeout(closeTimer)
  listeners.add(listener)
  connect()
  return () => {
    listeners.delete(listener)
    closeTimer = setTimeout(() => {
      if (listeners.size) return
      stream?.close()
      stream = null
      controller?.abort()
      controller = null
      clearInterval(freshnessTimer)
      freshnessTimer = undefined
    }, 0)
  }
}

export function useLiveIncidents(): LiveIncidentState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => initialState
  )
}
