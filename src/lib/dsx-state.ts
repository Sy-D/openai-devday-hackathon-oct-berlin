import { disruptionEvents, initialDisruptionIds } from "../data/dsx"

export type DisruptionUpdate = {
  version: 1
  cursor: number
  activeEventIds: string[]
  changedEventId: string | null
  change: "snapshot" | "activated" | "cleared"
  occurredAt: string
}

export type DisruptionStep = { eventId: string; active: boolean }

// A finite, deterministic demo script. It never describes a real incident feed.
export const disruptionTimeline: DisruptionStep[] = [
  ...disruptionEvents
    .filter((event) => !initialDisruptionIds.includes(event.id))
    .map((event) => ({ eventId: event.id, active: true })),
  ...initialDisruptionIds
    .slice(0, 1)
    .map((eventId) => ({ eventId, active: false })),
]

export function isDisruptionId(value: string): boolean {
  return disruptionEvents.some((event) => event.id === value)
}

export function validDisruptionCursor(value: string | null): number {
  if (value === null || !/^\d{1,3}$/.test(value)) return 0
  const cursor = Number(value)
  return cursor <= disruptionTimeline.length ? cursor : 0
}

export function activeDisruptionsAt(cursor: number): string[] {
  const active = new Set(initialDisruptionIds)
  for (const step of disruptionTimeline.slice(0, cursor)) {
    if (step.active) active.add(step.eventId)
    else active.delete(step.eventId)
  }
  return [...active]
}

/** Parse only the compact wire contract, looking up incident details locally. */
/* oxlint-disable anti-slop/no-runtime-typeof -- Validate untrusted SSE JSON at this parser boundary before returning the domain contract. */
export function parseDisruptionUpdate(raw: string): DisruptionUpdate | null {
  if (raw.length > 8192) return null
  try {
    // SSE is an external input boundary. Runtime checks are required before use.
    const value: unknown = JSON.parse(raw)
    if (
      typeof value !== "object" ||
      value === null ||
      !("version" in value) ||
      value.version !== 1
    )
      return null
    if (
      !("cursor" in value) ||
      typeof value.cursor !== "number" ||
      !Number.isInteger(value.cursor) ||
      value.cursor < 0 ||
      value.cursor > disruptionTimeline.length
    )
      return null
    if (
      !("activeEventIds" in value) ||
      !Array.isArray(value.activeEventIds) ||
      value.activeEventIds.length > disruptionEvents.length
    )
      return null
    const activeEventIds: string[] = []
    for (const id of value.activeEventIds) {
      if (
        typeof id !== "string" ||
        !isDisruptionId(id) ||
        activeEventIds.includes(id)
      )
        return null
      activeEventIds.push(id)
    }
    if (
      !("changedEventId" in value) ||
      (value.changedEventId !== null &&
        (typeof value.changedEventId !== "string" ||
          !isDisruptionId(value.changedEventId)))
    )
      return null
    if (
      !("change" in value) ||
      (value.change !== "snapshot" &&
        value.change !== "activated" &&
        value.change !== "cleared")
    )
      return null
    if (
      !("occurredAt" in value) ||
      typeof value.occurredAt !== "string" ||
      !Number.isFinite(Date.parse(value.occurredAt))
    )
      return null
    if (value.change !== "snapshot" && value.changedEventId === null)
      return null
    return {
      version: 1,
      cursor: value.cursor,
      activeEventIds,
      changedEventId: value.changedEventId,
      change: value.change,
      occurredAt: value.occurredAt,
    }
  } catch {
    return null
  }
}

/* oxlint-enable anti-slop/no-runtime-typeof */

export function mergeDisruptionOverrides(
  activeEventIds: readonly string[],
  overrides: ReadonlyMap<string, boolean>
): string[] {
  const active = new Set(activeEventIds)
  for (const [id, enabled] of overrides) {
    if (!isDisruptionId(id)) continue
    if (enabled) active.add(id)
    else active.delete(id)
  }
  return [...active]
}
