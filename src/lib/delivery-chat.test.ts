import test from "node:test"
import assert from "node:assert/strict"
import { freshDeliveryDraft, inTimeZone, zonedIso } from "./delivery-chat"
import { writeDraftBatch } from "./delivery-store"
import { draftKey } from "../../components/procurement/plan-state"

test("planner dates retain Berlin's timezone on both sides of the DST change", () => {
  assert.equal(
    zonedIso("2026-10-24T12:00", "Europe/Berlin"),
    "2026-10-24T10:00:00.000Z"
  )
  assert.equal(
    zonedIso("2026-10-25T12:00", "Europe/Berlin"),
    "2026-10-25T11:00:00.000Z"
  )
  assert.equal(
    inTimeZone("2026-10-24T10:00:00Z", "Europe/Berlin"),
    "2026-10-24T12:00"
  )
  assert.throws(
    () => zonedIso("2026-03-29T02:30", "Europe/Berlin"),
    /does not exist/
  )
})

function storage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
    removeItem: (key: string) => {
      values.delete(key)
    },
  }
}
test("draft batch protects concurrent edits and Undo restores the exact original", () => {
  const store = storage(),
    key = draftKey("optics"),
    next = JSON.stringify(freshDeliveryDraft("optics", "UTC"))
  const undo = writeDraftBatch(store, [
    { componentId: "optics", expected: null, next },
  ])
  assert.equal(store.getItem(key), next)
  writeDraftBatch(store, undo)
  assert.equal(store.getItem(key), null)
  store.setItem(key, "newer manual edit")
  assert.throws(
    () =>
      writeDraftBatch(store, [{ componentId: "optics", expected: null, next }]),
    /changed while/
  )
  assert.equal(store.getItem(key), "newer manual edit")
})
test("batch preflight prevents partially updating multiple deliveries", () => {
  const store = storage()
  store.setItem(draftKey("cooling"), "manual edit")
  assert.throws(
    () =>
      writeDraftBatch(
        store,
        ["optics", "cooling"].map((componentId) => ({
          componentId,
          expected: null,
          next: JSON.stringify(freshDeliveryDraft(componentId, "UTC")),
        }))
      ),
    /changed while/
  )
  assert.equal(store.getItem(draftKey("optics")), null)
})
