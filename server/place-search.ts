import { z } from "zod"

const featureSchema = z.object({
  geometry: z.object({
    type: z.literal("Point"),
    coordinates: z.tuple([
      z.number().min(-180).max(180),
      z.number().min(-90).max(90),
    ]),
  }),
  properties: z.object({
    osm_type: z.string().optional(),
    osm_id: z.number().optional(),
    name: z.string().optional(),
    street: z.string().optional(),
    housenumber: z.string().optional(),
    city: z.string().optional(),
    postcode: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    type: z.string().optional(),
  }),
})
export type PlaceResult = {
  id: string
  label: string
  coordinates: [number, number]
  kind: string
}
export class PlaceInputError extends Error {}

export function normalizePlaceQuery(query: string) {
  const clean = query.trim().replace(/\s+/g, " ")
  if (
    clean.length < 3 ||
    clean.length > 160 ||
    [...clean].some((character) => character.charCodeAt(0) < 32)
  )
    throw new PlaceInputError(
      "Enter a place or address using 3–160 characters."
    )
  return clean
}

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- External provider JSON is checked before becoming a selectable location.
export function parsePlaces(value: unknown): PlaceResult[] {
  const parsed = z
    .object({ features: z.array(z.unknown()).max(30) })
    .parse(value)
  return parsed.features
    .flatMap((item, index) => {
      const result = featureSchema.safeParse(item)
      if (!result.success) return []
      const { properties: p, geometry } = result.data
      const street = [p.street, p.housenumber].filter(Boolean).join(" ")
      const locality = [p.postcode, p.city ?? p.state].filter(Boolean).join(" ")
      const label = [
        ...new Set([p.name, street, locality, p.country].filter(Boolean)),
      ].join(", ")
      if (!label) return []
      return [
        {
          id: `${p.osm_type ?? "place"}-${p.osm_id ?? index}`,
          label,
          coordinates: geometry.coordinates,
          kind: p.type ?? "place",
        },
      ]
    })
    .slice(0, 5)
}

export function createPlaceSearch(fetcher: typeof fetch = fetch) {
  const cache = new Map<string, { places: PlaceResult[]; expires: number }>()
  const pending = new Map<string, Promise<PlaceResult[]>>()
  let nextRequestAt = 0
  return async function search(query: string): Promise<PlaceResult[]> {
    const q = normalizePlaceQuery(query),
      key = q.toLowerCase()
    const cached = cache.get(key)
    if (cached && cached.expires > Date.now()) return cached.places
    const existing = pending.get(key)
    if (existing) return existing
    if (pending.size >= 2)
      throw new Error("Place search is busy. Try again shortly.")
    const wait = Math.max(0, nextRequestAt - Date.now())
    nextRequestAt = Date.now() + wait + 1100
    const work = (async () => {
      if (wait) await new Promise((resolve) => setTimeout(resolve, wait))
      const url = new URL(
        process.env.PHOTON_SEARCH_URL ?? "https://photon.komoot.io/api/"
      )
      url.searchParams.set("q", q)
      url.searchParams.set("limit", "5")
      url.searchParams.set("lang", "en")
      const response = await fetcher(url, {
        headers: {
          "User-Agent":
            "FORMA-DeliveryPlanner/1.0 (+https://github.com/Sy-D/openai-devday-hackathon-oct-berlin)",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      })
      if (!response.ok || !response.body)
        throw new Error("Place search is unavailable. Try again shortly.")
      const reader = response.body.getReader(),
        chunks: Uint8Array[] = []
      let bytes = 0
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          bytes += value.byteLength
          if (bytes > 250_000)
            throw new Error("Place search returned an oversized response.")
          chunks.push(value)
        }
      } finally {
        void reader.cancel().catch(() => {})
        reader.releaseLock()
      }
      const places = parsePlaces(
        JSON.parse(Buffer.concat(chunks).toString("utf8"))
      )
      if (cache.size >= 100) cache.delete(cache.keys().next().value!)
      cache.set(key, { places, expires: Date.now() + 86_400_000 })
      return places
    })()
    pending.set(key, work)
    try {
      return await work
    } finally {
      pending.delete(key)
    }
  }
}

export const searchPlaces = createPlaceSearch()
