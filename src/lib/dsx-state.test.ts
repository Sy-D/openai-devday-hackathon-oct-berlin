import assert from "node:assert/strict"
import test from "node:test"
import { initialDisruptionIds } from "../data/dsx"
import {
  activeDisruptionsAt,
  disruptionTimeline,
  mergeDisruptionOverrides,
  parseDisruptionUpdate,
  validDisruptionCursor,
} from "./dsx-state"

const fixture = () => ({
  version: 1,
  cursor: 0,
  activeEventIds: activeDisruptionsAt(0),
  changedEventId: null,
  change: "snapshot",
  occurredAt: "2026-10-27T07:00:00.000Z",
})

test("wire parser validates ids, sequence, timestamp and input size before use", () => {
  assert.deepEqual(parseDisruptionUpdate(JSON.stringify(fixture())), fixture())
  for (const value of [
    null,
    {},
    { ...fixture(), version: 2 },
    { ...fixture(), cursor: -1 },
    { ...fixture(), cursor: 0.5 },
    { ...fixture(), cursor: 999 },
    { ...fixture(), activeEventIds: ["unknown"] },
    {
      ...fixture(),
      activeEventIds: [initialDisruptionIds[0], initialDisruptionIds[0]],
    },
    { ...fixture(), changedEventId: "unknown" },
    { ...fixture(), change: "activated" },
    { ...fixture(), occurredAt: "broken" },
  ]) {
    assert.equal(parseDisruptionUpdate(JSON.stringify(value)), null)
  }
  assert.equal(parseDisruptionUpdate("{"), null)
  assert.equal(parseDisruptionUpdate("x".repeat(8193)), null)
})

test("manual scenario overrides survive subsequent server snapshots until reset", () => {
  const baselineId = initialDisruptionIds[0]
  const nextId = disruptionTimeline[0].eventId
  const overrides = new Map([
    [baselineId, false],
    [nextId, true],
  ])
  const before = mergeDisruptionOverrides(activeDisruptionsAt(0), overrides)
  const after = mergeDisruptionOverrides(activeDisruptionsAt(2), overrides)
  assert.ok(!before.includes(baselineId))
  assert.ok(!after.includes(baselineId))
  assert.ok(before.includes(nextId))
  assert.ok(after.includes(nextId))
  assert.deepEqual(
    mergeDisruptionOverrides(activeDisruptionsAt(0), new Map()),
    activeDisruptionsAt(0)
  )
})

test("timeline can restore an initial incident and cursor parsing is bounded", () => {
  assert.ok(activeDisruptionsAt(0).includes(initialDisruptionIds[0]))
  assert.ok(
    !activeDisruptionsAt(disruptionTimeline.length).includes(
      initialDisruptionIds[0]
    )
  )
  assert.equal(validDisruptionCursor(null), 0)
  assert.equal(validDisruptionCursor("2"), 2)
  for (const value of ["-1", "1.5", "1x", "9999", "NaN"])
    assert.equal(validDisruptionCursor(value), 0)
})
