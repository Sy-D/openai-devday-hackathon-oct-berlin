import test from "node:test"
import assert from "node:assert/strict"
import {
  dsxParts,
  disruptionEvents,
  initialDisruptionIds,
  shipmentRoutes,
  transportEdges,
  transportNodes,
} from "../data/dsx"
import { getPartRoutes, getPartStatus, recommendedRoute } from "./dsx-routing"

test("DSX catalogue contains ten distinct parts and connected, qualified alternatives", () => {
  assert.equal(dsxParts.length, 10)
  assert.equal(new Set(dsxParts.map((part) => part.id)).size, 10)
  assert.equal(new Set(disruptionEvents.map((event) => event.kind)).size, 6)
  assert.ok(disruptionEvents.length >= 10)
  for (const part of dsxParts) {
    const routes = shipmentRoutes.filter(
      (route) => route.componentId === part.id
    )
    assert.equal(routes.length, 3)
    assert.ok(routes.some((route) => route.id === part.defaultRouteId))
    for (const route of routes) {
      const edges = route.edgeIds.map((id) => {
        const edge = transportEdges.find((item) => item.id === id)
        assert.ok(edge, `missing edge ${id}`)
        return edge
      })
      assert.equal(edges.at(-1)?.to, "berlin")
      edges.forEach((edge, index) => {
        assert.ok(transportNodes.some((node) => node.id === edge.from))
        assert.ok(transportNodes.some((node) => node.id === edge.to))
        if (index > 0)
          assert.equal(
            edges[index - 1].to,
            edge.from,
            `${route.id} is disconnected`
          )
      })
    }
  }
  for (const event of disruptionEvents) {
    assert.equal(event.source, "Simulated scenario")
    assert.ok(
      event.affectedEdgeIds.every((id) =>
        transportEdges.some((edge) => edge.id === id)
      )
    )
  }
})

test("baseline blockers identify exactly compute, cooling and enclosure; controls are explicitly delivered", () => {
  const statuses = dsxParts.map((part) =>
    getPartStatus(part.id, initialDisruptionIds)
  )
  assert.deepEqual(
    statuses
      .filter((item) => ["blocked", "delayed"].includes(item.status))
      .map((item) => item.part.id),
    ["compute-a", "cooling", "enclosure"]
  )
  assert.equal(
    getPartStatus("controls", initialDisruptionIds).status,
    "delivered"
  )
  assert.equal(
    getPartStatus("storage", initialDisruptionIds).status,
    "on-track"
  )
})

test("closed flight lane is unavailable and the recommendation physically bypasses that edge", () => {
  const routes = getPartRoutes("compute-a", ["airspace-central"])
  const closed = routes.find((route) => route.id === "compute-a-fra")
  assert.ok(closed)
  assert.equal(closed.available, false)
  const recommended = recommendedRoute(routes)
  assert.equal(recommended?.id, "compute-a-ams")
  assert.ok(!recommended?.edgeIds.includes("tpe-fra-air"))
  assert.equal(
    getPartStatus("compute-a", ["airspace-central"], recommended?.id).status,
    "on-track"
  )
  assert.notEqual(
    getPartStatus("compute-a", [], recommended?.id).status,
    "delivered"
  )
})

test("flood delays change ETA and recommendation; an unrelated route stays unchanged", () => {
  const baseline = getPartRoutes("cooling", []).find(
    (route) => route.id === "cooling-road"
  )
  const disrupted = getPartRoutes("cooling", ["rhine-flood"]).find(
    (route) => route.id === "cooling-road"
  )
  assert.ok(baseline && disrupted)
  assert.equal(disrupted.etaHours - baseline.etaHours, 24)
  assert.equal(disrupted.bufferHours, -10)
  assert.equal(disrupted.available, true)
  assert.equal(
    recommendedRoute(getPartRoutes("cooling", initialDisruptionIds))?.id,
    "cooling-sea"
  )
  assert.equal(
    recommendedRoute(
      getPartRoutes("cooling", [...initialDisruptionIds, "north-sea-storm"])
    )?.id,
    "cooling-rail"
  )
  assert.deepEqual(
    getPartRoutes("storage", []),
    getPartRoutes("storage", initialDisruptionIds)
  )
})

test("distinct incidents add delays once each and duplicate deliveries do not double count", () => {
  const routes = getPartRoutes("cooling", [
    "rhine-flood",
    "berlin-road",
    "rhine-flood",
  ])
  const road = routes.find((route) => route.id === "cooling-road")
  assert.ok(road)
  assert.equal(road.delayHours, 32)
  assert.equal(road.etaHours, 68)
  assert.deepEqual(road.eventIds, ["rhine-flood", "berlin-road"])
})

test("every route crossing a blocked edge is unavailable, including nonselected alternatives", () => {
  const ids = disruptionEvents
    .filter((event) => event.blocked)
    .map((event) => event.id)
  const blockedEdges = new Set(
    disruptionEvents
      .filter((event) => event.blocked)
      .flatMap((event) => event.affectedEdgeIds)
  )
  for (const part of dsxParts) {
    for (const route of getPartRoutes(part.id, ids)) {
      if (route.edgeIds.some((id) => blockedEdges.has(id)))
        assert.equal(route.available, false, route.id)
    }
  }
})

test("a supplier allocation hold cannot be solved by pretending another transport route has stock", () => {
  const routes = getPartRoutes("fabric", ["fabric-shortage"])
  assert.ok(routes.every((route) => !route.available))
  assert.equal(recommendedRoute(routes), undefined)
  assert.equal(getPartStatus("fabric", ["fabric-shortage"]).status, "blocked")
})

test("routes that miss the deadline are never recommended and clearing an event restores the route", () => {
  const routes = getPartRoutes("power", ["power-quality", "berlin-road"])
  assert.ok(routes.every((route) => route.bufferHours < 0))
  assert.equal(recommendedRoute(routes), undefined)
  assert.equal(getPartStatus("power", ["power-quality"]).status, "delayed")
  assert.equal(getPartStatus("power", []).status, "on-track")
})

test("recommendations are deterministic and do not reorder the caller list", () => {
  const routes = getPartRoutes("enclosure", initialDisruptionIds)
  const order = routes.map((route) => route.id)
  assert.equal(recommendedRoute(routes)?.id, "enclosure-road")
  assert.equal(recommendedRoute([...routes].reverse())?.id, "enclosure-road")
  assert.deepEqual(
    routes.map((route) => route.id),
    order
  )
  const tied = routes.map((route) => ({
    ...route,
    available: true,
    bufferHours: 10,
    cost: 100,
    etaHours: 50,
  }))
  assert.equal(
    recommendedRoute(tied)?.id,
    [...tied].sort((a, b) => a.id.localeCompare(b.id))[0].id
  )
})

test("stale identifiers cannot select another component route or fabricate a new incident", () => {
  assert.throws(() => getPartRoutes("missing-part", []), RangeError)
  assert.throws(
    () => getPartStatus("compute-a", [], "storage-road"),
    RangeError
  )
  assert.deepEqual(
    getPartRoutes("compute-a", ["unknown-future-event"]),
    getPartRoutes("compute-a", [])
  )
})

test("confirmed route remains evaluated against new incidents and delivered seed stays delivered", () => {
  assert.equal(
    getPartStatus("enclosure", initialDisruptionIds, "enclosure-road").status,
    "on-track"
  )
  assert.equal(
    getPartStatus(
      "enclosure",
      [...initialDisruptionIds, "alpine-road"],
      "enclosure-road"
    ).status,
    "delayed"
  )
  assert.equal(
    recommendedRoute(
      getPartRoutes("enclosure", [...initialDisruptionIds, "alpine-road"])
    )?.id,
    "enclosure-lyon"
  )
  assert.equal(getPartStatus("controls", ["berlin-road"]).status, "delivered")
  assert.deepEqual(getPartStatus("controls", ["berlin-road"]).eventIds, [])
})
