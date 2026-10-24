import {
  dsxParts,
  disruptionEvents,
  shipmentRoutes,
  transportEdges,
  transportNodes,
  type DsxPart,
  type TransportMode,
} from "../data/dsx"

export type RouteAssessment = {
  id: string
  name: string
  componentId: string
  modeLabel: string
  nodeNames: string[]
  edgeIds: string[]
  cost: number
  etaHours: number
  delayHours: number
  bufferHours: number
  available: boolean
  issues: string[]
  eventIds: string[]
}
export type PartAssessment = {
  part: DsxPart
  route: RouteAssessment
  status: "blocked" | "delayed" | "on-track" | "delivered"
  reason: string
  eventIds: string[]
}

const modeLabels = {
  air: "Air",
  rail: "Rail",
  road: "Road",
  sea: "Sea",
} satisfies Record<TransportMode, string>

function findPart(partId: string): DsxPart {
  const part = dsxParts.find((item) => item.id === partId)
  if (!part) throw new RangeError(`Unknown DSX component: ${partId}`)
  return part
}

/**
 * Evaluate only the qualified shipment alternatives declared in the demo data.
 * Distinct incidents add their delays once each, even if an incident affects
 * multiple edges. A blocked edge makes a route unavailable, never merely late.
 * Unknown incident IDs are ignored for catalog-version tolerance; the feed
 * validates complete event records against its known catalogue separately.
 */
export function getPartRoutes(
  partId: string,
  activeEventIds: readonly string[]
): RouteAssessment[] {
  const part = findPart(partId)
  const activeIds = new Set(activeEventIds)
  const activeEvents = disruptionEvents.filter((event) =>
    activeIds.has(event.id)
  )
  return shipmentRoutes
    .filter((route) => route.componentId === partId)
    .map((route) => {
      const edges = route.edgeIds.map((id) => {
        const edge = transportEdges.find((item) => item.id === id)
        if (!edge)
          throw new Error(`Route ${route.id} references unknown edge ${id}`)
        return edge
      })
      const events = activeEvents.filter((event) =>
        event.affectedEdgeIds.some((id) => route.edgeIds.includes(id))
      )
      const delayHours = events.reduce(
        (sum, event) => sum + event.delayHours,
        0
      )
      const etaHours =
        route.readyHours +
        edges.reduce((sum, edge) => sum + edge.hours, 0) +
        delayHours
      const available = !events.some((event) => event.blocked)
      const nodeIds = [edges[0].from, ...edges.map((edge) => edge.to)]
      const nodeNames = nodeIds.map((id) => {
        const node = transportNodes.find((item) => item.id === id)
        if (!node)
          throw new Error(`Route ${route.id} references unknown node ${id}`)
        return node.name
      })
      return {
        id: route.id,
        name: route.name,
        componentId: partId,
        modeLabel: [
          ...new Set(edges.map((edge) => modeLabels[edge.mode])),
        ].join(" + "),
        nodeNames,
        edgeIds: [...route.edgeIds],
        cost: edges.reduce((sum, edge) => sum + edge.cost, 0),
        etaHours,
        delayHours,
        bufferHours: part.deadlineHours - etaHours,
        available,
        issues: events.map((event) =>
          event.blocked
            ? `${event.title}: route unavailable`
            : `${event.title}: +${event.delayHours}h`
        ),
        eventIds: events.map((event) => event.id),
      }
    })
}

/** The cheapest qualified route that is available and still meets the deadline. */
export function recommendedRoute(
  routes: readonly RouteAssessment[]
): RouteAssessment | undefined {
  return [...routes]
    .filter((route) => route.available && route.bufferHours >= 0)
    .sort(
      (a, b) =>
        a.cost - b.cost || a.etaHours - b.etaHours || a.id.localeCompare(b.id)
    )[0]
}

export function getPartStatus(
  partId: string,
  activeEventIds: readonly string[],
  routeId?: string
): PartAssessment {
  const part = findPart(partId)
  const route = getPartRoutes(partId, activeEventIds).find(
    (item) => item.id === (routeId ?? part.defaultRouteId)
  )
  if (!route)
    throw new RangeError(
      `Unknown route for ${partId}: ${routeId ?? part.defaultRouteId}`
    )
  if (part.deliveredAt) {
    return {
      part,
      route,
      status: "delivered",
      reason:
        "Delivered to the integration site in the seed scenario. Later transport alerts do not reopen this completed shipment.",
      eventIds: [],
    }
  }
  if (!route.available) {
    return {
      part,
      route,
      status: "blocked",
      reason: route.issues.join(". "),
      eventIds: route.eventIds,
    }
  }
  if (route.bufferHours < 0 || route.delayHours > 0) {
    const timing =
      route.bufferHours < 0
        ? `Delivery is ${-route.bufferHours}h beyond the required window.`
        : `Delivery retains ${route.bufferHours}h of deadline buffer.`
    return {
      part,
      route,
      status: "delayed",
      reason: `${route.delayHours > 0 ? `Transport or supplier disruption adds ${route.delayHours}h. ` : ""}${timing}`,
      eventIds: route.eventIds,
    }
  }
  return {
    part,
    route,
    status: "on-track",
    reason: `The selected shipment route meets the delivery window with ${route.bufferHours}h of buffer. Delivery is not yet confirmed.`,
    eventIds: route.eventIds,
  }
}
