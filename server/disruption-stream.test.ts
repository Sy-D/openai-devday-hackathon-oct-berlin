import assert from "node:assert/strict"
import test from "node:test"
import { createDisruptionStream } from "./disruption-stream"
import {
  activeDisruptionsAt,
  disruptionTimeline,
  parseDisruptionUpdate,
} from "../src/lib/dsx-state"

const fixedTime = () => "2026-10-27T07:00:00.000Z"
const request = (after = "0", headers: HeadersInit = {}) =>
  new Request(`http://localhost/api/disruptions?after=${after}`, { headers })

async function readEvent(reader: ReadableStreamDefaultReader<Uint8Array>) {
  const decoder = new TextDecoder()
  for (let i = 0; i < 20; i++) {
    const chunk = await reader.read()
    if (chunk.done) return null
    const payload = decoder
      .decode(chunk.value)
      .split("\n")
      .find((line) => line.startsWith("data: "))
    if (payload) return parseDisruptionUpdate(payload.slice(6))
  }
  throw new Error("No event payload received")
}

test("SSE is uncached, explicitly simulated and sends the initial snapshot immediately", async () => {
  const response = createDisruptionStream(request(), { now: fixedTime })
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/event-stream/
  )
  assert.equal(response.headers.get("cache-control"), "no-store, no-transform")
  assert.equal(
    response.headers.get("x-disruption-source"),
    "simulated-scenario"
  )
  const reader = response.body!.getReader()
  assert.deepEqual(await readEvent(reader), {
    version: 1,
    cursor: 0,
    activeEventIds: activeDisruptionsAt(0),
    changedEventId: null,
    change: "snapshot",
    occurredAt: fixedTime(),
  })
  await reader.cancel()
})

test("real streamed messages arrive without another request and advance the cursor", async () => {
  const response = createDisruptionStream(request(), {
    intervalMs: 8,
    heartbeatMs: 1000,
    lifetimeMs: 1000,
    now: fixedTime,
  })
  const reader = response.body!.getReader()
  await readEvent(reader)
  const next = await readEvent(reader)
  assert.equal(next?.cursor, 1)
  assert.equal(next?.change, "activated")
  assert.equal(next?.changedEventId, disruptionTimeline[0].eventId)
  assert.deepEqual(next?.activeEventIds, activeDisruptionsAt(1))
  await reader.cancel()
})

test("Last-Event-ID resumes exactly once and overrides an older query cursor", async () => {
  const response = createDisruptionStream(
    request("0", { "Last-Event-ID": "2" }),
    { intervalMs: 8, heartbeatMs: 1000, lifetimeMs: 1000, now: fixedTime }
  )
  const reader = response.body!.getReader()
  const initial = await readEvent(reader)
  assert.equal(initial?.cursor, 2)
  assert.deepEqual(initial?.activeEventIds, activeDisruptionsAt(2))
  const next = await readEvent(reader)
  assert.equal(next?.cursor, 3)
  assert.equal(next?.changedEventId, disruptionTimeline[2].eventId)
  await reader.cancel()
})

test("malformed cursors restart safely and the finite scenario does not invent more incidents", async () => {
  for (const cursor of ["-1", "NaN", "999999", "1.5"]) {
    const reader = createDisruptionStream(request(cursor), {
      now: fixedTime,
    }).body!.getReader()
    assert.equal((await readEvent(reader))?.cursor, 0)
    await reader.cancel()
  }
  const reader = createDisruptionStream(
    request(String(disruptionTimeline.length)),
    { intervalMs: 2, heartbeatMs: 1000, lifetimeMs: 12 }
  ).body!.getReader()
  assert.equal((await readEvent(reader))?.cursor, disruptionTimeline.length)
  assert.equal(await readEvent(reader), null)
})

test("aborting a client request closes the stream and clears pending timers", async () => {
  const abort = new AbortController()
  const response = createDisruptionStream(
    new Request("http://localhost/api/disruptions", { signal: abort.signal }),
    { intervalMs: 1000, lifetimeMs: 2000 }
  )
  const reader = response.body!.getReader()
  await readEvent(reader)
  abort.abort()
  assert.equal((await reader.read()).done, true)
})

test("already aborted requests return a closed stream", async () => {
  const abort = new AbortController()
  abort.abort()
  const response = createDisruptionStream(
    new Request("http://localhost/api/disruptions", { signal: abort.signal })
  )
  assert.equal((await response.body!.getReader().read()).done, true)
})
