import type { PartComponentId } from "../data/part-catalog"
import type { LiveIncident } from "./live-incidents"

export type Coordinate = [number, number] // longitude, latitude
export type EvidenceSource = { title: string; url: string; observedAt: string }
export type ProcurementOffer = {
  id: string
  componentId: PartComponentId
  seller: string
  sku: string
  productName: string
  condition: "new" | "refurbished" | "not-specified"
  orderUrl: string
  orderMode: "purchase" | "inquiry" | "quote-required"
  price?: {
    amount: number
    currency: "EUR"
    vat: "excluded" | "included" | "unknown"
  }
  availability: string
  observedAt: string
  dispatch?: {
    label: string
    coordinates: Coordinate
    precision: "city" | "address"
    status: "warehouse-city" | "confirmed-pickup" | "unverified"
    note: string
    source: EvidenceSource
  }
  sources: EvidenceSource[]
  note: string
}

export type DeliveryLocation = {
  label: string
  coordinates: Coordinate
  note: string
  source?: EvidenceSource
}

export type RoadRoute = {
  id: string
  label: string
  distanceKm: number
  durationSeconds: number
  coordinates: Coordinate[]
  avoidance: boolean
}

export type RoadRouteRequest = {
  origin: Coordinate
  destination: Coordinate
  exclude: Coordinate[]
}

export type RoadRouteResponse = {
  version: 1
  routes: RoadRoute[]
  fetchedAt: string
  provider: string
  attribution: string
  sourceUrl: string
  exclusions: Coordinate[]
  warnings: string[]
}

export type RouteExposure = {
  incident: LiveIncident
  distanceKm: number
  kind: "reported-restriction" | "hazard"
  stale: boolean
}

export type CostBasis = {
  label: string
  perKmEur: number
  fixedEur: number
  includedKm: number
  firstKm?: number
  firstKmRateEur?: number
  minEur?: number
  multiplier?: number
  source: EvidenceSource
  note: string
}

export type EmissionsBasis = {
  label: string
  kgCo2ePerKm: number
  source: EvidenceSource
  note: string
}

export type DeliveryInputs = {
  departure: string
  deadline: string
  handlingMinutes: number
  quantity: number
}

export type RouteMetrics = {
  distanceKm: number
  drivingMinutes: number
  transportEstimateEur: number | null
  productSubtotalEur: number | null
  totalEstimateEur: number | null
  emissionsKg: number | null
  arrival: string | null
  bufferMinutes: number | null
}
