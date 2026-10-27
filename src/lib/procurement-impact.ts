import type { IncidentSnapshot } from "./live-incidents"
import type {
  Coordinate,
  CostBasis,
  DeliveryInputs,
  EmissionsBasis,
  ProcurementOffer,
  RoadRoute,
  RouteExposure,
  RouteMetrics,
} from "./procurement"

const EARTH_KM = 6371
const radians = (value: number) => (value * Math.PI) / 180

/** Local tangent projection; exact segment projection prevents vertex-only misses. */
export function pointRouteDistanceKm(
  point: Coordinate,
  line: Coordinate[]
): number {
  if (line.length === 0) return Infinity
  const scale = Math.cos(radians(point[1]))
  const project = ([lng, lat]: Coordinate): Coordinate => [
    radians(lng - point[0]) * EARTH_KM * scale,
    radians(lat - point[1]) * EARTH_KM,
  ]
  if (line.length === 1) return Math.hypot(...project(line[0]))
  let closest = Infinity
  for (let i = 1; i < line.length; i++) {
    const a = project(line[i - 1]),
      b = project(line[i])
    const dx = b[0] - a[0],
      dy = b[1] - a[1]
    const denominator = dx * dx + dy * dy
    const t = denominator
      ? Math.max(0, Math.min(1, -(a[0] * dx + a[1] * dy) / denominator))
      : 0
    closest = Math.min(closest, Math.hypot(a[0] + t * dx, a[1] + t * dy))
  }
  return closest
}

/** Screening only. Proximity never establishes a closed road or a shipment delay. */
export function matchRouteIncidents(
  route: RoadRoute,
  snapshot: IncidentSnapshot | null | undefined,
  departureISO?: string
): RouteExposure[] {
  if (!snapshot) return []
  const departure = Date.parse(departureISO || snapshot.generatedAt)
  const arrival = departure + route.durationSeconds * 1000
  // The route is identical for every report. Compute bounds once without large
  // spread arguments (providers may return up to 100,000 route vertices).
  let minLng = Infinity,
    maxLng = -Infinity,
    minLat = Infinity,
    maxLat = -Infinity
  for (const [lng, lat] of route.coordinates) {
    minLng = Math.min(minLng, lng)
    maxLng = Math.max(maxLng, lng)
    minLat = Math.min(minLat, lat)
    maxLat = Math.max(maxLat, lat)
  }
  minLng -= 0.2
  maxLng += 0.2
  minLat -= 0.1
  maxLat += 0.1
  const sources = new Map(snapshot.sources.map((source) => [source.id, source]))
  const now = Date.now()
  return snapshot.incidents
    .flatMap((incident): RouteExposure[] => {
      if (
        !incident.coordinates ||
        incident.status === "historical" ||
        incident.status === "resolved" ||
        incident.evidence === "historical"
      )
        return []
      const ended = Date.parse(incident.endedAt ?? "")
      const starts = Date.parse(incident.startedAt ?? "")
      if (
        Number.isFinite(departure) &&
        Number.isFinite(ended) &&
        ended <= departure
      )
        return []
      if (
        Number.isFinite(arrival) &&
        Number.isFinite(starts) &&
        starts > arrival
      )
        return []
      const lines =
        incident.geometry?.type === "LineString"
          ? [incident.geometry.coordinates]
          : (incident.geometry?.coordinates ?? [])
      // Retain the complete reported stretch: avoiding its start point alone does
      // not establish that a route avoids the remaining queue or road works.
      const points = lines.length ? lines.flat() : [incident.coordinates]
      const nearby = points.filter(
        ([lng, lat]) =>
          lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat
      )
      if (!nearby.length) return []
      let distanceKm = Infinity
      for (const point of nearby)
        distanceKm = Math.min(
          distanceKm,
          pointRouteDistanceKm(point, route.coordinates)
        )
      for (const line of lines) {
        if (distanceKm <= 0.025) break
        for (const point of route.coordinates)
          distanceKm = Math.min(distanceKm, pointRouteDistanceKm(point, line))
      }
      // Road records are point/line references, hazards may describe a broad area.
      // These screening radii are disclosed, not invented obstruction geometry.
      const radius = incident.evidence === "reported-restriction" ? 0.25 : 10
      if (distanceKm > radius) return []
      const source = sources.get(incident.sourceId)
      const lastSuccess = Date.parse(
        source?.lastSuccessAt ?? snapshot.generatedAt
      )
      const sourceAgeExceeded =
        !Number.isFinite(lastSuccess) ||
        now - lastSuccess >
          Math.max(
            120_000,
            (source?.updateIntervalSeconds ?? 60) * 2000 + 30_000
          )
      return [
        {
          incident,
          distanceKm,
          kind: incident.evidence,
          stale: source?.state !== "live" || sourceAgeExceeded,
        },
      ]
    })
    .sort(
      (a, b) =>
        a.distanceKm - b.distanceKm ||
        a.incident.id.localeCompare(b.incident.id)
    )
}

/** Changes only when evidence relevant to this route changes; polling time is ignored. */
export function exposureSignature(exposures: RouteExposure[]): string {
  return JSON.stringify(
    exposures
      .map(({ incident, stale }) => ({
        id: incident.id,
        status: incident.status,
        title: incident.title,
        description: incident.description,
        coordinates: incident.coordinates,
        startedAt: incident.startedAt,
        endedAt: incident.endedAt,
        updatedAt: incident.updatedAt,
        stale,
        reportedDelayMinutes: incident.reportedDelayMinutes,
        geometry: incident.geometry,
        roadImpact: incident.roadImpact,
      }))
      .sort((a, b) => a.id.localeCompare(b.id))
  )
}

function nonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0
}
const money = (value: number) => Math.round((value + 1e-9) * 100) / 100

function pickupMultiplier(cost: CostBasis, departure: string): number | null {
  const policy = cost.timingSurcharge
  if (!policy) return 1
  if (!Number.isFinite(Date.parse(departure))) return null
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: policy.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(departure))
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? ""
  if (Number(get("year")) !== policy.year) return null
  const date = `${get("year")}-${get("month")}-${get("day")}`,
    hour = Number(get("hour"))
  return hour >= policy.nightStartHour ||
    hour < policy.nightEndHour ||
    (policy.sunday && get("weekday") === "Sun") ||
    policy.dates.includes(date)
    ? policy.multiplier
    : 1
}

/** Current reported queues are forecasts only for departures within one hour of observation. */
export function reportedRouteDelayMinutes(
  route: RoadRoute,
  exposures: RouteExposure[],
  departureISO = new Date().toISOString()
): number {
  let maximum = 0
  const departure = Date.parse(departureISO)
  for (const { incident, stale } of exposures) {
    const observation = Date.parse(incident.fetchedAt)
    if (
      stale ||
      !Number.isFinite(departure) ||
      Math.abs(departure - observation) > 3_600_000 ||
      incident.sourceId !== "autobahn" ||
      !incident.reportedDelayMinutes ||
      incident.roadImpact?.scope === "ramp" ||
      incident.geometry?.type !== "LineString"
    )
      continue
    const line = incident.geometry.coordinates
    let overlapKm = 0
    for (let j = 1; j < line.length; j++) {
      const c = line[j - 1],
        d = line[j]
      const point: Coordinate = [(c[0] + d[0]) / 2, (c[1] + d[1]) / 2]
      const scale = Math.cos(radians(point[1]))
      const ix = (d[0] - c[0]) * scale,
        iy = d[1] - c[1]
      const incidentLength = Math.hypot(ix, iy)
      if (!incidentLength) continue
      let nearest = Infinity,
        alignment = 0
      for (let i = 1; i < route.coordinates.length; i++) {
        const a = route.coordinates[i - 1],
          b = route.coordinates[i]
        const ax = (a[0] - point[0]) * scale,
          ay = a[1] - point[1]
        const dx = (b[0] - a[0]) * scale,
          dy = b[1] - a[1]
        const length = Math.hypot(dx, dy)
        if (!length) continue
        const t = Math.max(
          0,
          Math.min(1, -(ax * dx + ay * dy) / (length * length))
        )
        const distance =
          (Math.hypot(ax + t * dx, ay + t * dy) * EARTH_KM * Math.PI) / 180
        if (distance < nearest) {
          nearest = distance
          alignment = (dx * ix + dy * iy) / (length * incidentLength)
        }
      }
      // Crossing a motorway on a bridge is not driving along its queue.
      if (nearest <= 0.075 && alignment >= 0.8)
        overlapKm += (incidentLength * EARTH_KM * Math.PI) / 180
    }
    // Require at least150m of parallel travel. Partial queue exposure retains
    // the largest whole report; we do not invent proportional delay savings.
    if (overlapKm >= 0.15)
      maximum = Math.max(maximum, incident.reportedDelayMinutes)
  }
  return maximum
}

export function calculateRouteMetrics(
  route: RoadRoute,
  offer: ProcurementOffer,
  inputs: DeliveryInputs,
  cost?: CostBasis,
  emissions?: EmissionsBasis,
  reportedDelayMinutes = 0
): RouteMetrics {
  const distanceValid = nonNegative(route.distanceKm)
  const durationValid = nonNegative(route.durationSeconds)
  const quantityValid = Number.isInteger(inputs.quantity) && inputs.quantity > 0
  const parcel =
    offer.componentId === "optics" || offer.componentId === "controls"
  const transportModelAvailable =
    parcel || cost?.appliesTo === "planning-freight"
  let transportEstimateEur: number | null = null
  if (
    cost &&
    transportModelAvailable &&
    distanceValid &&
    nonNegative(cost.perKmEur) &&
    nonNegative(cost.fixedEur)
  ) {
    const distance = Math.max(0, route.distanceKm - cost.includedKm)
    const tier = cost.firstKm ?? 0
    const subtotal =
      cost.fixedEur +
      Math.min(distance, tier) * (cost.firstKmRateEur ?? cost.perKmEur) +
      Math.max(0, distance - tier) * cost.perKmEur
    const timing = pickupMultiplier(cost, inputs.departure)
    if (timing !== null) {
      const total =
        Math.max(cost.minEur ?? 0, subtotal) * (cost.multiplier ?? 1) * timing
      transportEstimateEur =
        cost.rounding === "whole-euro" && total > (cost.minEur ?? 0)
          ? Math.round(total)
          : money(total)
    }
  }
  const productSubtotalEur =
    offer.price && quantityValid && nonNegative(offer.price.amount)
      ? money(offer.price.amount * inputs.quantity)
      : null
  // Never add a gross/unknown-tax item amount to a net transport tariff.
  const totalEstimateEur =
    productSubtotalEur !== null &&
    transportEstimateEur !== null &&
    offer.price?.vat === "excluded"
      ? money(productSubtotalEur + transportEstimateEur)
      : null
  const departure = Date.parse(inputs.departure)
  const delay = nonNegative(reportedDelayMinutes) ? reportedDelayMinutes : 0
  const arrivalMs =
    durationValid &&
    Number.isFinite(departure) &&
    nonNegative(inputs.handlingMinutes)
      ? departure +
        route.durationSeconds * 1000 +
        (inputs.handlingMinutes + delay) * 60_000
      : NaN
  const deadline = Date.parse(inputs.deadline)
  return {
    distanceKm: route.distanceKm,
    drivingMinutes: route.durationSeconds / 60,
    reportedDelayMinutes: delay,
    transportEstimateEur,
    productSubtotalEur,
    totalEstimateEur,
    emissionsKg:
      emissions &&
      transportModelAvailable &&
      distanceValid &&
      nonNegative(emissions.kgCo2ePerKm)
        ? route.distanceKm * emissions.kgCo2ePerKm
        : null,
    arrival: Number.isFinite(arrivalMs)
      ? new Date(arrivalMs).toISOString()
      : null,
    bufferMinutes:
      Number.isFinite(arrivalMs) && Number.isFinite(deadline)
        ? (deadline - arrivalMs) / 60_000
        : null,
  }
}
