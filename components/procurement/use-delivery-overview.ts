"use client"

import { useMemo, useSyncExternalStore } from "react"
import { partCatalog } from "@/src/data/part-catalog"
import { offersWithAssumptions } from "@/src/data/procurement-assumptions"
import type { IncidentSnapshot } from "@/src/lib/live-incidents"
import {
  exposureSignature,
  matchRouteIncidents,
} from "@/src/lib/procurement-impact"
import {
  draftKey,
  REVIEW_VERSION,
  endpointSignature,
  inputSignature,
  parseSavedDraft,
  toIso,
  type DeliveryDraft,
} from "./plan-state"

const componentIds = Object.values(partCatalog).map((part) => part.componentId)
const emptyDrafts: DeliveryDraft[] = []
let cachedRaw = ""
let cachedDrafts = emptyDrafts

function readDrafts() {
  try {
    const values = componentIds.map((id) => localStorage.getItem(draftKey(id)))
    const raw = JSON.stringify(values)
    if (raw !== cachedRaw) {
      cachedRaw = raw
      cachedDrafts = values.flatMap((value, index) => {
        const draft = parseSavedDraft(value, componentIds[index])
        return draft ? [draft] : []
      })
    }
    return cachedDrafts
  } catch {
    return emptyDrafts
  }
}

function subscribe(listener: () => void) {
  window.addEventListener("storage", listener)
  window.addEventListener("focus", listener)
  window.addEventListener("forma:delivery-updated", listener)
  return () => {
    window.removeEventListener("storage", listener)
    window.removeEventListener("focus", listener)
    window.removeEventListener("forma:delivery-updated", listener)
  }
}

export function useDeliveryOverview(snapshot: IncidentSnapshot | null) {
  const drafts = useSyncExternalStore(subscribe, readDrafts, () => emptyDrafts)
  return useMemo(
    () =>
      componentIds.map((componentId) => {
        const draft = drafts.find((item) => item.componentId === componentId)
        const route =
          draft?.response?.routes.find(
            (item) => item.id === draft.selectedRouteId
          ) ??
          (draft?.baseline?.id === draft?.selectedRouteId
            ? draft?.baseline
            : undefined)
        const exposures =
          route && draft
            ? matchRouteIncidents(
                route,
                snapshot,
                toIso(draft.inputs.departure)
              )
            : []
        const offer =
          draft &&
          offersWithAssumptions(componentId).find(
            (item) => item.id === draft.offerId
          )
        const savedExposures = draft?.saved
          ? matchRouteIncidents(
              draft.saved.route,
              snapshot,
              toIso(draft.inputs.departure)
            )
          : []
        const changed =
          !!draft?.saved &&
          (draft.saved.reviewVersion !== REVIEW_VERSION ||
            draft.saved.inputSignature !== inputSignature(draft) ||
            draft.saved.route.id !== route?.id ||
            draft.saved.offerObservedAt !== offer?.observedAt ||
            (snapshot !== null &&
              draft.saved.exposureSignature !==
                exposureSignature(savedExposures)))
        const needsCalculation =
          !route || !draft || draft.routeEndpoints !== endpointSignature(draft)
        const status = changed
          ? "changed"
          : needsCalculation
            ? "unplanned"
            : draft.saved && snapshot
              ? "reviewed"
              : exposures.length
                ? "exposed"
                : "ready"
        const label =
          status === "changed"
            ? "Decision needs review"
            : status === "exposed"
              ? `${exposures.length} nearby report${exposures.length === 1 ? "" : "s"}`
              : status === "reviewed"
                ? "Decision reviewed"
                : status === "ready"
                  ? "Review and apply route"
                  : "Calculate delivery route"
        return {
          componentId,
          status,
          label,
          planned: !!route,
          exposureCount: exposures.length,
        }
      }),
    [drafts, snapshot]
  )
}
