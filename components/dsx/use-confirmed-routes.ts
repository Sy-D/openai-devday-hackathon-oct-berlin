"use client"

import { useSyncExternalStore } from "react"
import { z } from "zod"
import { dsxParts } from "@/src/data/dsx"
import type { RouteConfirmation } from "@/src/lib/dsx-confirmation"
import { getPartRoutes, type RouteAssessment } from "@/src/lib/dsx-routing"

const confirmationSchema = z.object({
  componentId: z.string(),
  routeId: z.string(),
  cost: z.number().finite(),
  etaHours: z.number().finite(),
  confirmedAt: z.string(),
})
const key = "forma.dsx.routes.v1"
const empty: readonly RouteConfirmation[] = []
let confirmations = empty
const listeners = new Set<() => void>()

function readSaved() {
  try {
    const parsed = z
      .array(confirmationSchema)
      .safeParse(JSON.parse(localStorage.getItem(key) ?? "[]"))
    if (!parsed.success) return empty
    return parsed.data.filter(
      (item) =>
        dsxParts.some((part) => part.id === item.componentId) &&
        getPartRoutes(item.componentId, []).some(
          (route) => route.id === item.routeId
        )
    )
  } catch {
    return empty
  }
}
function subscribe(listener: () => void) {
  const firstSubscriber = listeners.size === 0
  listeners.add(listener)
  if (firstSubscriber) {
    confirmations = readSaved()
    listener()
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === key || event.key === null) {
      confirmations = readSaved()
      listeners.forEach((notify) => notify())
    }
  }
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", onStorage)
  }
}
const getSnapshot = () => confirmations
const getServerSnapshot = () => empty
function save(next: readonly RouteConfirmation[]) {
  confirmations = next
  try {
    localStorage.setItem(key, JSON.stringify(next))
  } catch {
    /* Keep the current tab usable without storage. */
  }
  listeners.forEach((listener) => listener())
}
export function useConfirmedRoutes() {
  const assignments = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  )
  return {
    assignments,
    confirm: (route: RouteAssessment) => {
      if (!route.available || route.bufferHours < 0) return
      save([
        ...confirmations.filter(
          (item) => item.componentId !== route.componentId
        ),
        {
          componentId: route.componentId,
          routeId: route.id,
          cost: route.cost,
          etaHours: route.etaHours,
          confirmedAt: new Date().toISOString(),
        },
      ])
    },
    reset: () => save(empty),
  }
}
