import type { IncidentSnapshot } from "./live-incidents"
import type {
  Coordinate, CostBasis, DeliveryInputs, EmissionsBasis, ProcurementOffer,
  RoadRoute, RouteExposure, RouteMetrics,
} from "./procurement"

const EARTH_KM = 6371
const radians = (value: number) => value * Math.PI / 180

/** Local tangent projection; exact segment projection prevents vertex-only misses. */
export function pointRouteDistanceKm(point: Coordinate, line: Coordinate[]): number {
  if (line.length === 0) return Infinity
  const scale = Math.cos(radians(point[1]))
  const project = ([lng, lat]: Coordinate): Coordinate => [
    radians(lng - point[0]) * EARTH_KM * scale,
    radians(lat - point[1]) * EARTH_KM,
  ]
  if (line.length === 1) return Math.hypot(...project(line[0]))
  let closest = Infinity
  for (let i = 1; i < line.length; i++) {
    const a = project(line[i - 1]), b = project(line[i])
    const dx = b[0] - a[0], dy = b[1] - a[1]
    const denominator = dx * dx + dy * dy
    const t = denominator ? Math.max(0, Math.min(1, -(a[0] * dx + a[1] * dy) / denominator)) : 0
    closest = Math.min(closest, Math.hypot(a[0] + t * dx, a[1] + t * dy))
  }
  return closest
}

/** Screening only. Proximity never establishes a closed road or a shipment delay. */
export function matchRouteIncidents(
  route: RoadRoute,
  snapshot: IncidentSnapshot | null | undefined,
  departureISO?: string,
): RouteExposure[] {
  if (!snapshot) return []
  const departure = Date.parse(departureISO || snapshot.generatedAt)
  const arrival = departure + route.durationSeconds * 1000
  return snapshot.incidents.flatMap((incident): RouteExposure[] => {
    if (!incident.coordinates || incident.status === "historical" || incident.status === "resolved" || incident.evidence === "historical") return []
    const ended = Date.parse(incident.endedAt ?? "")
    const starts = Date.parse(incident.startedAt ?? "")
    if (Number.isFinite(departure) && Number.isFinite(ended) && ended <= departure) return []
    if (Number.isFinite(arrival) && Number.isFinite(starts) && starts > arrival) return []
    const distanceKm = pointRouteDistanceKm(incident.coordinates, route.coordinates)
    // Road records are point/line references, hazards may describe a broad area.
    // These screening radii are disclosed, not invented obstruction geometry.
    const radius = incident.evidence === "reported-restriction" ? 0.25 : 10
    if (distanceKm > radius) return []
    const source = snapshot.sources.find((item) => item.id === incident.sourceId)
    return [{ incident, distanceKm, kind: incident.evidence, stale: source?.state !== "live" }]
  }).sort((a,b) => a.distanceKm - b.distanceKm || a.incident.id.localeCompare(b.incident.id))
}

/** Changes only when evidence relevant to this route changes; polling time is ignored. */
export function exposureSignature(exposures: RouteExposure[]): string {
  return JSON.stringify(exposures.map(({incident, stale}) => ({
    id: incident.id, status: incident.status, title: incident.title,
    description: incident.description, coordinates: incident.coordinates,
    startedAt: incident.startedAt, endedAt: incident.endedAt,
    updatedAt: incident.updatedAt, stale,
  })).sort((a,b) => a.id.localeCompare(b.id)))
}

function nonNegative(value: number): boolean { return Number.isFinite(value) && value >= 0 }

export function calculateRouteMetrics(
  route: RoadRoute,
  offer: ProcurementOffer,
  inputs: DeliveryInputs,
  cost?: CostBasis,
  emissions?: EmissionsBasis,
): RouteMetrics {
  const distanceValid = nonNegative(route.distanceKm)
  const durationValid = nonNegative(route.durationSeconds)
  const quantityValid = Number.isInteger(inputs.quantity) && inputs.quantity > 0
  const parcel = offer.componentId === "optics" || offer.componentId === "controls"
  let transportEstimateEur: number | null = null
  if (cost && parcel && distanceValid && nonNegative(cost.perKmEur) && nonNegative(cost.fixedEur)) {
    const distance = Math.max(0, route.distanceKm - cost.includedKm)
    const tier = cost.firstKm ?? 0
    const subtotal = cost.fixedEur + Math.min(distance, tier) * (cost.firstKmRateEur ?? cost.perKmEur)
      + Math.max(0, distance - tier) * cost.perKmEur
    transportEstimateEur = Math.round(Math.max(cost.minEur ?? 0, subtotal) * (cost.multiplier ?? 1) * 100) / 100
  }
  const productSubtotalEur = offer.price && quantityValid && nonNegative(offer.price.amount)
    ? Math.round(offer.price.amount * inputs.quantity * 100) / 100 : null
  // Never add a gross/unknown-tax item amount to a net transport tariff.
  const totalEstimateEur = productSubtotalEur !== null && transportEstimateEur !== null && offer.price?.vat === "excluded"
    ? Math.round((productSubtotalEur + transportEstimateEur) * 100) / 100 : null
  const departure = Date.parse(inputs.departure)
  const arrivalMs = durationValid && Number.isFinite(departure) && nonNegative(inputs.handlingMinutes)
    ? departure + route.durationSeconds * 1000 + inputs.handlingMinutes * 60_000 : NaN
  const deadline = Date.parse(inputs.deadline)
  return {
    distanceKm: route.distanceKm,
    drivingMinutes: route.durationSeconds / 60,
    transportEstimateEur,
    productSubtotalEur,
    totalEstimateEur,
    emissionsKg: emissions && parcel && distanceValid && nonNegative(emissions.kgCo2ePerKm)
      ? route.distanceKm * emissions.kgCo2ePerKm : null,
    arrival: Number.isFinite(arrivalMs) ? new Date(arrivalMs).toISOString() : null,
    bufferMinutes: Number.isFinite(arrivalMs) && Number.isFinite(deadline) ? (deadline - arrivalMs) / 60_000 : null,
  }
}
