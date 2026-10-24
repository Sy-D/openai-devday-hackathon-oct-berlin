import { test } from "node:test"
import assert from "node:assert/strict"
import {
  createPlaceSearch,
  normalizePlaceQuery,
  parsePlaces,
} from "./place-search"

const sample = {
  features: [
    {
      properties: {
        osm_type: "W",
        osm_id: 30324253,
        street: "Nonnendammallee",
        housenumber: "15",
        city: "Berlin",
        postcode: "13599",
        country: "Germany",
        type: "house",
      },
      geometry: { type: "Point", coordinates: [13.2376192, 52.5375121] },
    },
  ],
}
test("address search returns a named location and rejects malformed coordinates", () => {
  assert.equal(
    parsePlaces(sample)[0].label,
    "Nonnendammallee 15, 13599 Berlin, Germany"
  )
  assert.deepEqual(parsePlaces(sample)[0].coordinates, [13.2376192, 52.5375121])
  assert.deepEqual(
    parsePlaces({
      features: [
        {
          ...sample.features[0],
          geometry: { type: "Point", coordinates: [999, 90] },
        },
      ],
    }),
    []
  )
  assert.throws(() => normalizePlaceQuery("x"))
  assert.throws(() => normalizePlaceQuery("x".repeat(161)))
})
test("repeated location searches share a request and retain successful cached results", async () => {
  let calls = 0
  const search = createPlaceSearch(async () => {
    calls++
    return Response.json(sample)
  })
  const [a, b] = await Promise.all([
    search("Berlin address"),
    search("Berlin address"),
  ])
  assert.deepEqual(a, b)
  await search(" Berlin   address ")
  assert.equal(calls, 1)
})
test("failed location lookup does not invent a location", async () => {
  const search = createPlaceSearch(
    async () => new Response("down", { status: 503 })
  )
  await assert.rejects(search("Berlin address"))
})
