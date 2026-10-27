import test from "node:test"
import assert from "node:assert/strict"
import {
  calculateRouteMetrics,
  exposureSignature,
  matchRouteIncidents,
  pointRouteDistanceKm,
  reportedRouteDelayMinutes,
} from "./procurement-impact"
import type { IncidentSnapshot, LiveIncident } from "./live-incidents"
import type { DeliveryInputs, ProcurementOffer, RoadRoute } from "./procurement"
import { transportCostBasis } from "../data/transport-evidence"
import { emissionsBasis } from "../data/emissions-evidence"

const route: RoadRoute = {
  id: "route",
  label: "Test road",
  distanceKm: 300,
  durationSeconds: 10800,
  coordinates: [
    [10, 53],
    [11, 53],
  ],
  avoidance: false,
}
const offer: ProcurementOffer = {
  id: "offer",
  componentId: "optics",
  seller: "Test seller",
  sku: "test",
  productName: "test",
  condition: "new",
  orderUrl: "https://example.com/product",
  orderMode: "purchase",
  price: { amount: 1483.28, currency: "EUR", vat: "excluded" },
  availability: "test",
  observedAt: "2026-10-24T13:00:00Z",
  sources: [],
  note: "test fixture",
}
const inputs: DeliveryInputs = {
  departure: "2026-10-26T08:00:00Z",
  deadline: "2026-10-26T12:00:00Z",
  handlingMinutes: 15,
  quantity: 2,
}
const incident: LiveIncident = {
  id: "road:1",
  sourceId: "autobahn",
  providerId: "1",
  title: "Traffic report",
  description: "Provider report",
  kind: "road",
  severity: "medium",
  status: "active",
  country: "Germany",
  location: "A24",
  coordinates: [10.5, 53],
  fetchedAt: "2026-10-24T13:00:00Z",
  url: "https://example.com/incident",
  evidence: "reported-restriction",
  reportedDelayMinutes: 20,
}
function snapshot(records: LiveIncident[]): IncidentSnapshot {
  return {
    version: 1,
    revision: "test",
    generatedAt: "2026-10-24T13:00:00Z",
    incidents: records,
    sources: [
      {
        id: "autobahn",
        name: "Road reports",
        state: "live",
        lastSuccessAt: new Date().toISOString(),
        recordCount: records.length,
        updateIntervalSeconds: 60,
        url: "https://example.com",
      },
    ],
  }
}

test("segment distance detects an incident between widely spaced route vertices", () => {
  assert.ok(pointRouteDistanceKm([10.5, 53], route.coordinates) < 0.001)
  assert.ok(pointRouteDistanceKm([10.5, 54], route.coordinates) > 110)
  assert.equal(pointRouteDistanceKm([10, 53], []), Infinity)
})
test("route matches only current geographically relevant reports", () => {
  const records: LiveIncident[] = [
    incident,
    { ...incident, id: "far", coordinates: [20, 60] },
    { ...incident, id: "old", status: "historical" as const },
    { ...incident, id: "resolved", status: "resolved" as const },
  ]
  assert.deepEqual(
    matchRouteIncidents(route, snapshot(records)).map((x) => x.incident.id),
    ["road:1"]
  )
})
test("reported line remains exposed after a route avoids only its first point", () => {
  const extended: LiveIncident = {
    ...incident,
    coordinates: [9, 54],
    geometry: {
      type: "LineString",
      coordinates: [
        [9, 54],
        [10.5, 53],
        [11, 53],
      ],
    },
  }
  assert.equal(matchRouteIncidents(route, snapshot([extended])).length, 1)
})
test("validity windows exclude ended and later scheduled events", () => {
  const records = [
    { ...incident, id: "ended", endedAt: "2026-10-26T07:59:00Z" },
    {
      ...incident,
      id: "later",
      status: "scheduled" as const,
      startedAt: "2026-10-26T15:00:00Z",
    },
    incident,
  ]
  assert.deepEqual(
    matchRouteIncidents(route, snapshot(records), inputs.departure).map(
      (x) => x.incident.id
    ),
    ["road:1"]
  )
})
test("missing source health makes a match stale instead of declaring a road clear", () => {
  const data = snapshot([incident])
  data.sources = []
  assert.equal(matchRouteIncidents(route, data)[0].stale, true)
})
test("an old retained snapshot cannot keep a live operational delay", () => {
  const data = snapshot([incident])
  data.sources[0].lastSuccessAt = new Date(Date.now() - 600_000).toISOString()
  const exposed = matchRouteIncidents(route, data)
  assert.equal(exposed[0].stale, true)
  assert.equal(reportedRouteDelayMinutes(route, exposed, incident.fetchedAt), 0)
})
test("irrelevant polling timestamps do not invalidate a saved decision", () => {
  const a = matchRouteIncidents(route, snapshot([incident]))
  const b = matchRouteIncidents(
    route,
    snapshot([{ ...incident, fetchedAt: "2026-10-24T13:01:00Z" }])
  )
  assert.equal(exposureSignature(a), exposureSignature(b))
  const c = matchRouteIncidents(
    route,
    snapshot([{ ...incident, reportedDelayMinutes: 30 }])
  )
  assert.notEqual(exposureSignature(a), exposureSignature(c))
})
test("published tier tariff, quantity and emissions calculate in their actual units", () => {
  const m = calculateRouteMetrics(
    route,
    offer,
    inputs,
    transportCostBasis,
    emissionsBasis,
    20
  )
  assert.equal(m.transportEstimateEur, 409)
  assert.equal(m.productSubtotalEur, 2966.56)
  assert.equal(m.totalEstimateEur, 3375.56)
  assert.ok(Math.abs(m.emissionsKg! - 300 * emissionsBasis.kgCo2ePerKm) < 1e-9)
  assert.equal(m.arrival, "2026-10-26T11:35:00.000Z")
  assert.equal(m.bufferMinutes, 25)
  assert.equal(m.reportedDelayMinutes, 20)
})
test("missing deadline and departure never become invented delivery promises", () => {
  const m = calculateRouteMetrics(route, offer, {
    ...inputs,
    departure: "",
    deadline: "",
  })
  assert.equal(m.arrival, null)
  assert.equal(m.bufferMinutes, null)
  assert.equal(m.transportEstimateEur, null)
  assert.equal(m.emissionsKg, null)
})
test("gross and unknown VAT offers are never added to net transport costs", () => {
  for (const vat of ["included", "unknown"] as const) {
    const m = calculateRouteMetrics(
      route,
      { ...offer, price: { amount: 100, currency: "EUR", vat } },
      inputs,
      transportCostBasis
    )
    assert.equal(m.productSubtotalEur, 200)
    assert.equal(m.totalEstimateEur, null)
  }
})
test("an enterprise rack is not priced or assigned emissions as a parcel car", () => {
  const m = calculateRouteMetrics(
    route,
    { ...offer, componentId: "compute-a", price: undefined },
    inputs,
    transportCostBasis,
    emissionsBasis
  )
  assert.equal(m.transportEstimateEur, null)
  assert.equal(m.emissionsKg, null)
  assert.equal(m.productSubtotalEur, null)
})
test("negative quantities and corrupt numeric route values cannot manufacture savings", () => {
  const m = calculateRouteMetrics(
    { ...route, distanceKm: NaN, durationSeconds: -1 },
    offer,
    { ...inputs, quantity: -1 },
    transportCostBasis,
    emissionsBasis
  )
  assert.equal(m.transportEstimateEur, null)
  assert.equal(m.productSubtotalEur, null)
  assert.equal(m.arrival, null)
  assert.equal(m.emissionsKg, null)
})

test("reported queues count once only in the route's direction and with live evidence", () => {
  const line: LiveIncident = {
    ...incident,
    geometry: {
      type: "LineString",
      coordinates: [
        [10.2, 53],
        [10.5, 53],
        [10.8, 53],
      ],
    },
    roadImpact: { scope: "traffic-warning", restriction: "warning" },
  }
  const exposures = matchRouteIncidents(
    route,
    snapshot([line, { ...line, id: "overlap", reportedDelayMinutes: 9 }])
  )
  assert.equal(
    reportedRouteDelayMinutes(route, exposures, incident.fetchedAt),
    20
  )
  assert.equal(
    reportedRouteDelayMinutes(
      { ...route, coordinates: [...route.coordinates].reverse() },
      exposures,
      incident.fetchedAt
    ),
    0
  )
  assert.equal(
    reportedRouteDelayMinutes(
      route,
      exposures.map((item) => ({ ...item, stale: true }))
    ),
    0
  )
  assert.equal(
    reportedRouteDelayMinutes(
      route,
      exposures.map((item) => ({
        ...item,
        incident: {
          ...item.incident,
          roadImpact: { scope: "ramp", restriction: "closed" },
        },
      }))
    ),
    0
  )
})
test("carrier surcharge uses Berlin pickup time, Sunday and official holidays", () => {
  for (const departure of [
    "2026-10-26T19:00:00Z",
    "2026-10-25T10:00:00Z",
    "2026-10-31T10:00:00Z",
  ]) {
    assert.equal(
      calculateRouteMetrics(
        route,
        offer,
        { ...inputs, departure },
        transportCostBasis
      ).transportEstimateEur,
      511
    )
  }
  assert.equal(
    calculateRouteMetrics(
      route,
      offer,
      { ...inputs, departure: "2027-01-04T08:00:00Z" },
      transportCostBasis
    ).transportEstimateEur,
    null
  )
})
