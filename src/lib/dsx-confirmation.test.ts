import test from "node:test"
import assert from "node:assert/strict"
import { getPartStatus } from "./dsx-routing"
import {
  deliveryStatus,
  needsRouteReview,
  type RouteConfirmation,
} from "./dsx-confirmation"

function savedFor(partId: string, events: string[]): RouteConfirmation {
  const { route } = getPartStatus(partId, events)
  return {
    componentId: partId,
    routeId: route.id,
    cost: route.cost,
    etaHours: route.etaHours,
    confirmedAt: "2026-10-27T08:00:00Z",
  }
}
test("new blocked incident retains red status even on a confirmed route", () => {
  const saved = savedFor("compute-a", [])
  const result = getPartStatus("compute-a", ["airspace-central"], saved.routeId)
  assert.equal(deliveryStatus(result, saved), "blocked")
  assert.equal(needsRouteReview(saved, result.route), true)
})
test("reviewed on-time delay resolves action without claiming delivery", () => {
  const saved = savedFor("compute-b", ["berlin-road"])
  const result = getPartStatus("compute-b", ["berlin-road"], saved.routeId)
  assert.ok(result.route.bufferHours >= 0)
  assert.equal(deliveryStatus(result, saved), "on-track")
  assert.equal(needsRouteReview(saved, result.route), false)
})
test("changed estimate reopens a saved route while delivered seed stays delivered", () => {
  const saved = savedFor("compute-b", [])
  const result = getPartStatus("compute-b", ["berlin-road"], saved.routeId)
  assert.notEqual(result.route.etaHours, saved.etaHours)
  assert.equal(deliveryStatus(result, saved), "delayed")
  const delivered = getPartStatus("controls", ["berlin-road"])
  assert.equal(deliveryStatus(delivered, savedFor("controls", [])), "delivered")
})
