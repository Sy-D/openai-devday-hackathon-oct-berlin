import assert from "node:assert/strict"
import test from "node:test"
import { createServer } from "node:http"
import {
  parseAutobahn,
  parseEonet,
  parseGdacs,
  parseNdw,
  parsePortWatch,
} from "./incident-providers/parsers"
import { boundedFetch, type IncidentProvider } from "./incident-providers"
import { createIncidentHub, incidentRevision } from "./live-incidents"
import { createLiveIncidentStream } from "./live-incidents-stream"
import type { LiveIncident, LiveSourceStatus } from "../src/lib/live-incidents"

const stamp = "2026-10-24T13:00:00.000Z"
function example(overrides: Partial<LiveIncident> = {}): LiveIncident {
  return {
    id: "gdacs:EQ:1",
    sourceId: "gdacs",
    providerId: "EQ:1",
    title: "Earthquake report",
    description: "Hazard only",
    kind: "earthquake",
    severity: "unknown",
    status: "unknown",
    country: "Indonesia",
    location: "Indonesia",
    fetchedAt: stamp,
    url: "https://www.gdacs.org/",
    evidence: "hazard",
    ...overrides,
  }
}
function provider(
  load: IncidentProvider["load"],
  overrides: Partial<IncidentProvider> = {}
): IncidentProvider {
  return {
    id: "gdacs",
    name: "GDACS",
    url: "https://www.gdacs.org/",
    intervalSeconds: 60,
    load,
    ...overrides,
  }
}

test("Autobahn preserves ramp scope and parses false strings without inventing a motorway blockage", () => {
  const batch = parseAutobahn(
    {
      closure: [
        {
          identifier: "a",
          display_type: "CLOSURE_ENTRY_EXIT",
          isBlocked: "false",
          future: "false",
          startTimestamp: "2026-10-23T12:00:00Z",
          coordinate: { long: 10, lat: 52 },
          title: "Works",
          description: ["Exit closed"],
        },
        { identifier: "b", future: "true", isBlocked: "false", title: "Later" },
      ],
    },
    "closure",
    stamp
  )
  assert.equal(batch.incidents[0].severity, "unknown")
  assert.equal(batch.incidents[0].status, "active")
  assert.equal(batch.incidents[1].status, "scheduled")
  assert.match(batch.incidents[0].description, /not a whole-motorway closure/)
  assert.deepEqual(batch.incidents[0].coordinates, [10, 52])
  assert.equal(batch.incidents[0].updatedAt, undefined)
})

test("GDACS uses current episode alert, stable event identity and UTC provider dates", () => {
  const feature = {
    type: "Feature",
    geometry: { type: "Point", coordinates: [123, 22] },
    properties: {
      eventid: 1,
      eventtype: "TC",
      episodeid: 35,
      name: "Cyclone",
      country: "Japan",
      alertlevel: "Red",
      episodealertlevel: "Green",
      iscurrent: "true",
      fromdate: "2026-10-14T12:00:00",
      todate: "2026-10-23T00:00:00",
      datemodified: "2026-10-23T03:00:34",
      url: { report: "javascript:alert(1)" },
    },
  }
  const [incident] = parseGdacs({ features: [feature] }, stamp).incidents
  assert.equal(incident.severity, "low")
  assert.equal(incident.startedAt, "2026-10-14T12:00:00.000Z")
  assert.equal(
    incident.status,
    "unknown",
    "an expired hazard date is not proof of recovery"
  )
  assert.equal(incident.evidence, "hazard")
  assert.equal(incident.url, "https://www.gdacs.org/")
  assert.equal(
    parseGdacs(
      {
        features: [
          { ...feature, properties: { ...feature.properties, episodeid: 36 } },
        ],
      },
      stamp
    ).incidents[0].id,
    incident.id
  )
})

test("EONET closed state is explicit and no country or polygon centroid is invented", () => {
  const [incident] = parseEonet(
    {
      events: [
        {
          id: "e1",
          title: "Fire",
          closed: "2026-10-23T00:00:00Z",
          categories: [{ id: "wildfires" }],
          geometry: [
            {
              date: "2026-10-21T00:00:00Z",
              type: "Polygon",
              coordinates: [[[1, 2]]],
            },
          ],
          sources: [{ id: "GDACS", url: "https://www.gdacs.org/" }],
        },
      ],
    },
    stamp
  ).incidents
  assert.equal(incident.status, "resolved")
  assert.equal(incident.country, "Not reported")
  assert.equal(incident.coordinates, undefined)
  assert.equal(incident.severity, "unknown")
  assert.match(incident.attribution!, /GDACS/)
})

function ndwXml(publication = stamp, extra = "") {
  return `<?xml version="1.0"?><mc:messageContainer xmlns:mc="urn:mc" xmlns:com="urn:com" xmlns:sit="urn:sit" xmlns:loc="urn:loc" xmlns:xsi="urn:xsi"><mc:payload xsi:type="sit:SituationPublication"><com:publicationTime>${publication}</com:publicationTime><sit:situation><sit:overallSeverity>medium</sit:overallSeverity><sit:situationRecord id="road-1" xsi:type="sit:RoadOrCarriagewayOrLaneManagement"><sit:situationRecordVersionTime>2026-10-24T12:30:00Z</sit:situationRecordVersionTime><sit:probabilityOfOccurrence>certain</sit:probabilityOfOccurrence><sit:source><com:sourceName><com:values><com:value lang="nl">RWS</com:value></com:values></com:sourceName></sit:source><sit:validity><com:validityStatus>definedByValidityTimeSpec</com:validityStatus><com:validityTimeSpecification><com:overallStartTime>2026-10-23T00:00:00Z</com:overallStartTime><com:overallEndTime>2026-10-25T00:00:00Z</com:overallEndTime></com:validityTimeSpecification></sit:validity><sit:roadOrCarriagewayOrLaneManagementType>laneClosures</sit:roadOrCarriagewayOrLaneManagementType><loc:gmlLineString><loc:posList>52.1 5.1 52.2 5.2</loc:posList></loc:gmlLineString>${extra}</sit:situationRecord></sit:situation></mc:payload></mc:messageContainer>`
}
test("NDW parses namespaced records, latitude first geometry, source and provider update dates", () => {
  const batch = parseNdw(ndwXml(), stamp)
  const incident = batch.incidents[0]
  assert.equal(batch.stale, false)
  assert.equal(incident.id, "ndw:road-1")
  assert.equal(incident.title, "Lane closures")
  assert.equal(incident.status, "active")
  assert.equal(incident.updatedAt, "2026-10-24T12:30:00.000Z")
  assert.equal(incident.fetchedAt, stamp)
  assert.equal(incident.attribution, "NDW · RWS")
  assert.deepEqual(incident.coordinates, [5.1, 52.1])
  assert.match(
    incident.description,
    /does not necessarily mean a full road closure/
  )
  assert.equal(parseNdw(ndwXml("2026-10-23T00:00:00Z"), stamp).stale, true)
})
test("NDW rejects malformed/unexpected XML and entity declarations instead of clearing last good data", () => {
  assert.throws(() => parseNdw("<broken>", stamp), /malformed/)
  assert.throws(
    () => parseNdw("<html>Temporarily unavailable</html>", stamp),
    /situation publication/
  )
  assert.throws(
    () =>
      parseNdw(
        '<!DOCTYPE x [<!ENTITY x SYSTEM "file:///etc/passwd">]><x/>',
        stamp
      ),
    /declarations/
  )
})
test("NDW suspended, scheduled and overrunning records keep distinct provider states", () => {
  assert.equal(
    parseNdw(ndwXml().replace("definedByValidityTimeSpec", "suspended"), stamp)
      .incidents[0].status,
    "unknown"
  )
  assert.equal(
    parseNdw(
      ndwXml().replace("2026-10-23T00:00:00Z", "2026-10-25T00:00:00Z"),
      stamp
    ).incidents[0].status,
    "scheduled"
  )
  assert.equal(
    parseNdw(
      ndwXml(stamp, "<com:overrunning>true</com:overrunning>").replace(
        "2026-10-25T00:00:00Z",
        "2026-10-23T00:00:00Z"
      ),
      stamp
    ).incidents[0].status,
    "active"
  )
})
test("PortWatch stays historical even if a provider date is recent", () => {
  const [incident] = parsePortWatch(
    {
      features: [
        {
          attributes: {
            eventid: 2,
            eventtype: "EQ",
            eventname: "Earthquake",
            fromdate: Date.parse(stamp),
            lat: -6,
            long: 110,
          },
        },
      ],
    },
    stamp
  ).incidents
  assert.equal(incident.status, "historical")
  assert.equal(incident.evidence, "historical")
  assert.deepEqual(incident.coordinates, [110, -6])
})
test("valid empty feeds are accepted, HTTP-200 error objects and invalid records are rejected", () => {
  assert.deepEqual(parseGdacs({ features: [] }, stamp).incidents, [])
  assert.throws(() =>
    parsePortWatch({ error: { code: 499 }, features: [] }, stamp)
  )
  assert.throws(() => parseEonet({ events: [{}] }, stamp), /identifiers/)
})

test("cache coalesces callers, honors TTL and retains last good data on failure", async () => {
  let clock = Date.parse(stamp),
    calls = 0,
    fail = false,
    empty = false
  const hub = createIncidentHub(
    [
      provider(async () => {
        calls++
        await new Promise((resolve) => setTimeout(resolve, 5))
        if (fail) throw new Error("outage")
        return { incidents: empty ? [] : [example()] }
      }),
    ],
    { now: () => clock }
  )
  const [a, b] = await Promise.all([hub.getSnapshot(), hub.getSnapshot()])
  assert.equal(calls, 1)
  assert.equal(a.revision, b.revision)
  assert.equal(a.sources[0].state, "live")
  clock += 59_000
  await hub.getSnapshot()
  assert.equal(calls, 1)
  clock += 2_000
  fail = true
  const failed = await hub.getSnapshot()
  assert.equal(calls, 2)
  assert.equal(failed.sources[0].state, "stale")
  assert.equal(failed.sources[0].lastSuccessAt, stamp)
  assert.equal(failed.incidents[0].fetchedAt, stamp)
  assert.equal(failed.incidents.length, 1)
  assert.notEqual(failed.revision, a.revision)
  clock += 60_001
  fail = false
  empty = true
  const removed = await hub.getSnapshot()
  assert.equal(removed.sources[0].state, "live")
  assert.deepEqual(
    removed.incidents,
    [],
    "an upstream removal is reflected; never marked resolved locally"
  )
})
test("one unavailable provider cannot stop another; no fake fallback is added", async () => {
  const hub = createIncidentHub([
    provider(async () => {
      throw new Error("offline")
    }),
    provider(async () => ({ incidents: [] }), { id: "eonet" }),
  ])
  const result = await hub.getSnapshot()
  assert.deepEqual(
    result.sources.map((source) => source.state),
    ["unavailable", "live"]
  )
  assert.equal(result.incidents.length, 0)
})
test("revision ignores poll timestamps and ordering but detects substantive provider updates", () => {
  const source: LiveSourceStatus = {
    id: "gdacs",
    name: "GDACS",
    state: "live",
    recordCount: 2,
    updateIntervalSeconds: 60,
    url: "https://www.gdacs.org/",
    checkedAt: stamp,
  }
  const one = example(),
    two = example({ id: "gdacs:EQ:2" })
  const revision = incidentRevision([one, two], [source])
  assert.equal(
    incidentRevision(
      [two, { ...one, fetchedAt: "2026-10-24T14:00:00Z" }],
      [{ ...source, checkedAt: "2026-10-24T14:00:00Z" }]
    ),
    revision
  )
  assert.notEqual(
    incidentRevision([{ ...one, severity: "high" }, two], [source]),
    revision
  )
})
test("bounded fetch rejects oversized bodies even without content-length", async () => {
  const fetcher: typeof fetch = async () => new Response("123456")
  await assert.rejects(
    boundedFetch("https://example.com/", { maxBytes: 5, fetcher }),
    /byte limit/
  )
  const errorFetcher: typeof fetch = async () =>
    new Response("unavailable", { status: 503 })
  await assert.rejects(
    boundedFetch("https://example.com/", { fetcher: errorFetcher }),
    /HTTP 503/
  )
})
test("provider timeout also interrupts a response body that never finishes", async () => {
  const server = createServer((_request, response) => {
    response.writeHead(200)
    response.write("partial body")
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Node returns a socket path or AddressInfo; the ephemeral TCP test requires AddressInfo.
  assert.ok(address && typeof address === "object")
  try {
    await assert.rejects(
      boundedFetch(`http://127.0.0.1:${address.port}`, { timeoutMs: 50 }),
      /timeout|abort/i
    )
  } finally {
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})
test("SSE sends complete snapshots and ends within its bounded lifetime", async () => {
  const hub = createIncidentHub(
    [provider(async () => ({ incidents: [example()] }))],
    { pollIntervalMs: 10 }
  )
  const response = createLiveIncidentStream(
    new Request("http://localhost/api/incidents/stream"),
    { hub, lifetimeMs: 35, heartbeatMs: 10 }
  )
  const body = await response.text()
  assert.match(response.headers.get("Content-Type")!, /text\/event-stream/)
  assert.match(body, /event: snapshot/)
  assert.match(body, /"sourceId":"gdacs"/)
  assert.match(body, /retry: 3000/)
})
test("SSE cancellation unsubscribes from shared polling", async () => {
  let active = 0
  const hub = {
    getSnapshot: async () => {
      throw new Error("unused")
    },
    subscribe: () => {
      active++
      return () => {
        active--
      }
    },
  }
  const response = createLiveIncidentStream(
    new Request("http://localhost/api/incidents/stream"),
    { hub }
  )
  assert.equal(active, 1)
  await response.body!.cancel()
  assert.equal(active, 0)
})
test("aborted SSE requests do not subscribe to the shared broker", async () => {
  let subscribed = false
  const hub = {
    getSnapshot: async () => {
      throw new Error("unused")
    },
    subscribe: () => {
      subscribed = true
      return () => {}
    },
  }
  const controller = new AbortController()
  controller.abort()
  const response = createLiveIncidentStream(
    new Request("http://localhost/api/incidents/stream", {
      signal: controller.signal,
    }),
    { hub }
  )
  assert.equal(await response.text(), "")
  assert.equal(subscribed, false)
})
