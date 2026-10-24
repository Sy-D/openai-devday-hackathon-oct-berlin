import assert from "node:assert/strict"
import test from "node:test"
import { createServer } from "node:http"
import { createRoadRouter, exclusionRing, parseRouteRequest } from "./road-routing"
import type { RoadRouteRequest } from "../src/lib/procurement"

const request: RoadRouteRequest = { origin: [10.213583, 53.5411468], destination: [13.2376192, 52.5375121], exclude: [] }
const baseline = { code: "Ok", routes: [{ distance: 270_000, duration: 10_000, geometry: { type: "LineString", coordinates: [[10.2, 53.5], [12, 53], [13.2, 52.5]] } }] }
const avoided = { code: "Ok", routes: [{ distance: 275_000, duration: 10_600, geometry: { type: "LineString", coordinates: [[10.2, 53.5], [11.8, 53.2], [13.2, 52.5]] } }] }

test("public routing input rejects invalid coordinates, identical points and excessive exclusions", () => {
  assert.throws(() => parseRouteRequest({ ...request, origin: [200, 53] }))
  assert.throws(() => parseRouteRequest({ ...request, destination: request.origin }))
  assert.throws(() => parseRouteRequest({ ...request, exclude: Array(11).fill([12, 53]) }))
  assert.throws(() => parseRouteRequest({ ...request, upstreamUrl: "https://example.com" }))
  assert.deepEqual(parseRouteRequest(request), request)
})
test("baseline and recalculated geometry are retained with explicit uncertainty", async () => {
  const requests: string[] = []
  const fetcher: typeof fetch = async (_url, options) => { requests.push(String(options?.body)); return Response.json(requests.length === 1 ? baseline : avoided) }
  const router = createRoadRouter({ fetcher, spacingMs: 0 })
  const result = await router.route({ ...request, exclude: [[12, 53]] })
  assert.equal(result.routes.length, 2)
  assert.equal(result.routes[0].avoidance, false)
  assert.equal(result.routes[1].avoidance, true)
  assert.equal(result.routes[1].distanceKm - result.routes[0].distanceKm, 5)
  assert.notEqual(result.routes[0].id, result.routes[1].id)
  assert.match(requests[1], /exclude_polygons/)
  assert.match(result.warnings.join(" "), /not a freight delivery ETA/)
  assert.match(result.warnings.join(" "), /not the provider's confirmed closure/)
})
test("avoidance failure preserves the calculated baseline and never fabricates a replacement", async () => {
  let calls = 0
  const fetcher: typeof fetch = async () => { if (++calls === 1) return Response.json(baseline); throw new Error("offline") }
  const result = await createRoadRouter({ fetcher, spacingMs: 0 }).route({ ...request, exclude: [[12, 53]] })
  assert.equal(result.routes.length, 1)
  assert.equal(result.routes[0].avoidance, false)
  assert.match(result.warnings.join(" "), /Avoidance could not be calculated/)
})
test("unchanged avoidance produces no duplicate route or invented saving", async () => {
  const fetcher: typeof fetch = async () => Response.json(baseline)
  const result = await createRoadRouter({ fetcher, spacingMs: 0 }).route({ ...request, exclude: [[12, 53]] })
  assert.equal(result.routes.length, 1)
  assert.match(result.warnings.join(" "), /did not produce a different route/)
})
test("shared routing cache coalesces requests and expires after five minutes", async () => {
  let calls = 0, now = Date.parse("2026-10-24T13:00:00Z")
  const fetcher: typeof fetch = async () => { calls++; await new Promise(resolve => setTimeout(resolve, 5)); return Response.json(baseline) }
  const router = createRoadRouter({ fetcher, spacingMs: 0, now: () => now })
  const [first, second] = await Promise.all([router.route(request), router.route(request)])
  assert.equal(calls, 1)
  assert.equal(first.fetchedAt, second.fetchedAt)
  now += 299_000
  await router.route(request)
  assert.equal(calls, 1)
  now += 2000
  const fresh = await router.route(request)
  assert.equal(calls, 2)
  assert.equal(fresh.routes[0].id, first.routes[0].id)
})
test("malformed and oversized provider responses fail closed", async () => {
  await assert.rejects(createRoadRouter({ fetcher: async () => Response.json({ code: "NoRoute" }), spacingMs: 0 }).route(request), /No usable/)
  await assert.rejects(createRoadRouter({ fetcher: async () => new Response("x".repeat(4_000_001)), spacingMs: 0 }).route(request), /size limit/)
})
test("routing deadline interrupts an upstream body that never finishes", async () => {
  const server = createServer((_request, response) => { response.writeHead(200); response.write("{") })
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Node's address union includes socket paths; this TCP test requires AddressInfo.
  assert.ok(address && typeof address === "object")
  const fetcher: typeof fetch = (_url, init) => fetch(`http://127.0.0.1:${address.port}`, init)
  try { await assert.rejects(createRoadRouter({ fetcher, timeoutMs: 50, spacingMs: 0 }).route(request), /unavailable or timed out/) }
  finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())) }
})
test("exclusion areas are finite and closed even near the poles", () => {
  const ring = exclusionRing([179.999, 89.999])
  assert.deepEqual(ring[0], ring.at(-1))
  assert.ok(ring.every(([lon, lat]) => Math.abs(lon) <= 180 && Math.abs(lat) <= 90))
})
