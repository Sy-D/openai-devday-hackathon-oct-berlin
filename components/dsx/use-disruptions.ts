"use client"

import { useSyncExternalStore } from "react"
import { disruptionEvents, initialDisruptionIds } from "@/src/data/dsx"
import {
  isDisruptionId,
  mergeDisruptionOverrides,
  parseDisruptionUpdate,
} from "@/src/lib/dsx-state"

type Connection = "connecting" | "connected" | "reconnecting" | "paused"
type DisruptionNotification = {
  eventId: string
  change: "activated" | "cleared"
  cursor: number
}
type Snapshot = {
  activeEventIds: string[]
  connection: Connection
  lastReceivedAt: string | null
  streamEnabled: boolean
  lastEvent: DisruptionNotification | null
}

const initialSnapshot: Snapshot = {
  activeEventIds: [...initialDisruptionIds],
  connection: "connecting",
  lastReceivedAt: null,
  streamEnabled: true,
  lastEvent: null,
}

// One browser session store is shared by the model and its detail route. Manual
// scenario toggles override the scripted feed until Reset scenario is chosen.
let snapshot = initialSnapshot
let cursor = 0
let serverActive = [...initialDisruptionIds]
const overrides = new Map<string, boolean>()
const listeners = new Set<() => void>()
let source: EventSource | null = null
let closeTimer: ReturnType<typeof setTimeout> | undefined

function publish(next: Snapshot) {
  snapshot = next
  for (const listener of listeners) listener()
}

function disconnect() {
  source?.close()
  source = null
}

function connect() {
  if (source || !snapshot.streamEnabled || !listeners.size) return
  const stream = new EventSource(`/api/disruptions?after=${cursor}`)
  source = stream
  const receive = (event: MessageEvent<string>) => {
    if (source !== stream) return
    const update = parseDisruptionUpdate(event.data)
    if (!update || update.cursor < cursor) return
    // Snapshot refreshes can prove connectivity without replaying old alerts.
    if (update.cursor === cursor && update.change !== "snapshot") return
    const changed = update.cursor > cursor || snapshot.lastReceivedAt === null
    const lastEvent =
      update.cursor > cursor &&
      update.change !== "snapshot" &&
      update.changedEventId !== null
        ? {
            eventId: update.changedEventId,
            change: update.change,
            cursor: update.cursor,
          }
        : snapshot.lastEvent
    cursor = update.cursor
    serverActive = update.activeEventIds
    publish({
      ...snapshot,
      activeEventIds: mergeDisruptionOverrides(serverActive, overrides),
      connection: "connected",
      lastReceivedAt: changed ? update.occurredAt : snapshot.lastReceivedAt,
      lastEvent,
    })
  }
  stream.addEventListener("snapshot", receive)
  stream.addEventListener("disruption", receive)
  stream.onopen = () => {
    if (source === stream) publish({ ...snapshot, connection: "connected" })
  }
  stream.onerror = () => {
    if (source === stream) publish({ ...snapshot, connection: "reconnecting" })
  }
}

function subscribe(listener: () => void) {
  clearTimeout(closeTimer)
  listeners.add(listener)
  connect()
  return () => {
    listeners.delete(listener)
    // React remounts subscriptions in development and during route transitions.
    closeTimer = setTimeout(() => {
      if (!listeners.size) disconnect()
    }, 0)
  }
}

function getSnapshot() {
  return snapshot
}
function getServerSnapshot() {
  return initialSnapshot
}

function setStreamEnabled(enabled: boolean) {
  if (enabled === snapshot.streamEnabled) return
  disconnect()
  publish({
    ...snapshot,
    streamEnabled: enabled,
    connection: enabled ? "connecting" : "paused",
  })
  if (enabled) connect()
}

function toggleEvent(id: string) {
  if (!isDisruptionId(id)) return
  overrides.set(id, !snapshot.activeEventIds.includes(id))
  publish({
    ...snapshot,
    activeEventIds: mergeDisruptionOverrides(serverActive, overrides),
  })
}

function resetScenario() {
  disconnect()
  overrides.clear()
  cursor = 0
  serverActive = [...initialDisruptionIds]
  publish({
    ...initialSnapshot,
    streamEnabled: snapshot.streamEnabled,
    connection: snapshot.streamEnabled ? "connecting" : "paused",
  })
  connect()
}

export function useDisruptions() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return {
    ...state,
    events: disruptionEvents,
    setStreamEnabled,
    toggleEvent,
    resetScenario,
  }
}
