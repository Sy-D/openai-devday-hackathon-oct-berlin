import { z } from "zod"
import type {
  DeliveryInputs,
  RoadRoute,
  RoadRouteResponse,
  RouteMetrics,
} from "@/src/lib/procurement"

const coordinate = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
])
const timestamp = z
  .string()
  .refine((value) => Number.isFinite(Date.parse(value)))
const roadRoute = z.object({
  id: z.string().min(1),
  label: z.string(),
  distanceKm: z.number().nonnegative(),
  durationSeconds: z.number().nonnegative(),
  coordinates: z.array(coordinate).min(2),
  avoidance: z.boolean(),
})
const responseSchema = z.object({
  version: z.literal(1),
  routes: z.array(roadRoute).min(1),
  fetchedAt: timestamp,
  provider: z.string(),
  attribution: z.string(),
  sourceUrl: z
    .string()
    .url()
    .refine((value) => /^https?:\/\//.test(value)),
  exclusions: z.array(coordinate),
  exclusionPaths: z.array(z.array(coordinate)).optional(),
  warnings: z.array(z.string()),
})
const inputsSchema = z.object({
  departure: z.string(),
  deadline: z.string(),
  handlingMinutes: z.number().min(0).max(10080),
  quantity: z.number().int().min(1).max(10000),
})
export const metricsSchema = z.object({
  distanceKm: z.number(),
  drivingMinutes: z.number(),
  reportedDelayMinutes: z.number().nonnegative(),
  transportEstimateEur: z.number().nullable(),
  productSubtotalEur: z.number().nullable(),
  totalEstimateEur: z.number().nullable(),
  emissionsKg: z.number().nullable(),
  arrival: z.string().nullable(),
  bufferMinutes: z.number().nullable(),
})
export const REVIEW_VERSION = 2

const savedSchema = z.object({
  reviewVersion: z.number().int().positive().optional(),
  savedAt: timestamp,
  route: roadRoute,
  baseline: roadRoute,
  metrics: metricsSchema,
  exposureSignature: z.string(),
  inputSignature: z.string(),
  offerId: z.string(),
  offerObservedAt: timestamp,
})
export const draftSchema = z.object({
  version: z.literal(1),
  componentId: z.string(),
  offerId: z.string(),
  originLabel: z.string(),
  originLon: z.string(),
  originLat: z.string(),
  destinationLabel: z.string(),
  destinationLon: z.string(),
  destinationLat: z.string(),
  inputs: inputsSchema,
  response: responseSchema.nullable(),
  baseline: roadRoute.nullable(),
  selectedRouteId: z.string(),
  routeEndpoints: z.string(),
  avoidedIds: z.array(z.string()),
  saved: savedSchema.nullable(),
})

export type SavedAction = {
  reviewVersion?: number
  savedAt: string
  route: RoadRoute
  baseline: RoadRoute
  metrics: RouteMetrics
  exposureSignature: string
  inputSignature: string
  offerId: string
  offerObservedAt: string
}
export type DeliveryDraft = {
  version: 1
  componentId: string
  offerId: string
  originLabel: string
  originLon: string
  originLat: string
  destinationLabel: string
  destinationLon: string
  destinationLat: string
  inputs: DeliveryInputs
  response: RoadRouteResponse | null
  baseline: RoadRoute | null
  selectedRouteId: string
  routeEndpoints: string
  avoidedIds: string[]
  saved: SavedAction | null
}

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- HTTP boundary: validate the full routing response before exposing the domain type.
export function parseRoadResponse(value: unknown): RoadRouteResponse | null {
  const result = responseSchema.safeParse(value)
  return result.success ? result.data : null
}

export function parseSavedDraft(
  raw: string | null,
  componentId: string
): DeliveryDraft | null {
  if (!raw) return null
  try {
    const parsed = draftSchema.safeParse(JSON.parse(raw))
    return parsed.success && parsed.data.componentId === componentId
      ? parsed.data
      : null
  } catch {
    return null
  }
}

export const draftKey = (componentId: string) =>
  `forma.delivery.v1.${componentId}`
export function inputSignature(draft: DeliveryDraft) {
  return JSON.stringify([
    draft.offerId,
    draft.originLon,
    draft.originLat,
    draft.destinationLon,
    draft.destinationLat,
    draft.inputs,
  ])
}
export function endpointSignature(draft: DeliveryDraft) {
  return JSON.stringify([
    draft.originLon,
    draft.originLat,
    draft.destinationLon,
    draft.destinationLat,
  ])
}
export function localDateTime(date = new Date()) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16)
}
export function toIso(value: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return ""
  return new Date(value).toISOString()
}
