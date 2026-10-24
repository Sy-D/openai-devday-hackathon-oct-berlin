import { createHash } from "node:crypto"
import { z } from "zod"
import type { Coordinate, RoadRoute, RoadRouteRequest, RoadRouteResponse } from "../src/lib/procurement"

const PROVIDER_URL = "https://valhalla1.openstreetmap.de/route"
const coordinate = z.tuple([z.number().finite().min(-180).max(180), z.number().finite().min(-90).max(90)])
const requestSchema = z.object({ origin: coordinate, destination: coordinate, exclude: z.array(coordinate).max(10).default([]) }).strict()
const providerSchema = z.object({
  code: z.literal("Ok"),
  routes: z.array(z.object({
    distance: z.number().finite().nonnegative(), duration: z.number().finite().nonnegative(),
    geometry: z.object({ type: z.literal("LineString"), coordinates: z.array(coordinate).min(2).max(100_000) }),
  })).min(1).max(3),
  warnings: z.array(z.object({ description: z.string().optional(), code: z.number().optional() })).optional(),
})

export class RouteInputError extends Error {}
export class RoutingUnavailableError extends Error {}

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- Zod validates the public JSON request before it enters the router.
export function parseRouteRequest(value: unknown): RoadRouteRequest {
  const result = requestSchema.safeParse(value)
  if (!result.success) throw new RouteInputError("Supply valid [longitude, latitude] origin and destination coordinates and at most 10 exclusion points.")
  if (result.data.origin[0] === result.data.destination[0] && result.data.origin[1] === result.data.destination[1]) throw new RouteInputError("Origin and destination must be different.")
  return result.data
}

export function exclusionRing(point: Coordinate): Coordinate[] {
  // A user-selected conservative avoidance area, not an asserted closure extent.
  const latRadius = 0.00135 // approximately 150 metres
  const lngRadius = latRadius / Math.max(0.1, Math.cos(point[1] * Math.PI / 180))
  const west = Math.max(-180, point[0] - lngRadius), east = Math.min(180, point[0] + lngRadius)
  const south = Math.max(-90, point[1] - latRadius), north = Math.min(90, point[1] + latRadius)
  return [[west, south], [east, south], [east, north], [west, north], [west, south]]
}

function routeId(points: Coordinate[]): string {
  return `road-${createHash("sha256").update(JSON.stringify(points)).digest("hex").slice(0, 16)}`
}

export function createRoadRouter(options: { fetcher?: typeof fetch; timeoutMs?: number; spacingMs?: number; now?: () => number } = {}) {
  const fetcher = options.fetcher ?? fetch, now = options.now ?? Date.now
  const cache = new Map<string, { response: RoadRouteResponse; expiresAt: number }>()
  const pending = new Map<string, Promise<RoadRouteResponse>>()
  let queue: Promise<void> = Promise.resolve(), lastStarted = 0
  let queued = 0

  async function requestProvider(request: RoadRouteRequest, avoid: boolean): Promise<RoadRoute[]> {
    if (queued >= 2) throw new RoutingUnavailableError("Routing is busy. Please retry shortly.")
    queued++
    const previous = queue
    let release = () => {}
    queue = new Promise<void>(resolve => { release = resolve })
    await previous
    try {
      const delay = Math.max(0, lastStarted + (options.spacingMs ?? 1100) - now())
      if (delay) await new Promise(resolve => setTimeout(resolve, delay))
      lastStarted = now()
      const payload = {
        locations: [request.origin, request.destination].map(([lon, lat]) => ({ lat, lon })),
        // oxlint-disable-next-line anti-slop/no-shape-in-symbol-names -- shape_format is the upstream Valhalla protocol field, not an application symbol.
        costing: "auto", units: "kilometers", format: "osrm", shape_format: "geojson", alternates: 2, directions_type: "none",
        exclude_polygons: avoid && request.exclude.length ? request.exclude.map(exclusionRing) : undefined,
      }
      const response = await fetcher(PROVIDER_URL, {
        method: "POST", cache: "no-store", signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
        headers: { "Content-Type": "application/json", "User-Agent": "FORMA-supply-chain-hackathon/1.0", "X-Client-Id": "forma-supply-chain-hackathon" },
        body: JSON.stringify(payload),
      })
      if (!response.ok) { await response.body?.cancel(); throw new RoutingUnavailableError(`Routing provider returned HTTP ${response.status}.`) }
      if (!response.body || Number(response.headers.get("content-length")) > 4_000_000) { await response.body?.cancel(); throw new RoutingUnavailableError("Routing provider returned an empty or oversized response.") }
      const reader = response.body.getReader(), chunks: Uint8Array[] = []
      let bytes = 0
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          bytes += value.byteLength
          if (bytes > 4_000_000) throw new RoutingUnavailableError("Routing response exceeds the size limit.")
          chunks.push(value)
        }
      } finally { void reader.cancel().catch(() => {}); reader.releaseLock() }
      const parsed = providerSchema.safeParse(JSON.parse(Buffer.concat(chunks).toString("utf8")))
      if (!parsed.success) throw new RoutingUnavailableError("No usable road route was returned by the provider.")
      if (avoid && parsed.data.warnings?.length) throw new RoutingUnavailableError("The provider returned a warning for the avoidance request; the baseline is retained for review.")
      return parsed.data.routes.map((route, index) => ({
        id: routeId(route.geometry.coordinates), label: avoid ? index ? `Avoidance alternative ${index + 1}` : "Avoid selected areas" : index ? `Road alternative ${index + 1}` : "Baseline road route",
        distanceKm: route.distance / 1000, durationSeconds: route.duration, coordinates: route.geometry.coordinates, avoidance: avoid,
      }))
    } finally { queued--; release() }
  }

  async function route(input: RoadRouteRequest): Promise<RoadRouteResponse> {
    const request = parseRouteRequest(input)
    const key = JSON.stringify({ ...request, exclude: [...request.exclude].sort((a, b) => a[0] - b[0] || a[1] - b[1]) })
    const stored = cache.get(key)
    if (stored && stored.expiresAt > now()) return stored.response
    const existing = pending.get(key)
    if (existing) return existing
    const task = (async () => {
      let baseline: RoadRoute[]
      try { baseline = await requestProvider(request, false) }
      catch (error) { throw error instanceof RoutingUnavailableError ? error : new RoutingUnavailableError("The routing provider is unavailable or timed out. No route was fabricated.") }
      const warnings = [
        "Modeled car/van driving time, not a freight delivery ETA. Dispatch, loading, breaks, live traffic and vehicle restrictions are not verified.",
        "Auto routing is suitable only as a planning reference for small parcel parts. Rack systems and heavy freight require carrier-approved truck routing.",
        "Public FOSSGIS Valhalla demo service; OpenStreetMap data and modeled speeds. No guaranteed availability or live incident coverage.",
      ]
      let alternatives: RoadRoute[] = [], avoidanceFailed = false
      if (request.exclude.length) {
        warnings.push("Avoidance uses a roughly 300-metre-wide box around each selected report point. This is a conservative planning choice, not the provider's confirmed closure boundary; nearby ramps or opposite carriageways may also be excluded.")
        try {
          alternatives = await requestProvider(request, true)
          alternatives = alternatives.filter(route => !baseline.some(base => base.id === route.id))
          if (!alternatives.length) warnings.push("The requested exclusions did not produce a different route. No rerouting benefit is claimed.")
        } catch { avoidanceFailed = true; warnings.push("Avoidance could not be calculated. Baseline routes are shown; they have not been confirmed to avoid the selected areas.") }
      }
      const response: RoadRouteResponse = {
        version: 1, routes: [...baseline, ...alternatives], fetchedAt: new Date(now()).toISOString(),
        provider: "FOSSGIS Valhalla", attribution: "© OpenStreetMap contributors · Routing: Valhalla / FOSSGIS e.V.",
        sourceUrl: "https://valhalla.openstreetmap.de/", exclusions: request.exclude, warnings,
      }
      if (cache.size >= 64) cache.delete(cache.keys().next().value!)
      cache.set(key, { response, expiresAt: now() + (avoidanceFailed ? 30_000 : 300_000) })
      return response
    })().finally(() => pending.delete(key))
    pending.set(key, task)
    return task
  }
  return { route }
}

// SAFETY: this module owns the optional global and only assigns the matching router factory result.
const globalRouting = globalThis as typeof globalThis & { formaRoadRouterV1?: ReturnType<typeof createRoadRouter> }
export const roadRouter = globalRouting.formaRoadRouterV1 ??= createRoadRouter()
