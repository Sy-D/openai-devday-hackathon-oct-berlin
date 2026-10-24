import { z } from "zod"
import {
  endpointSignature,
  type DeliveryDraft,
} from "../components/procurement/plan-state"
import { partCatalog } from "../src/data/part-catalog"
import {
  offersWithAssumptions,
  getAssumptionBases,
} from "../src/data/procurement-assumptions"
import { transportCostBasis } from "../src/data/transport-evidence"
import { emissionsBasis } from "../src/data/emissions-evidence"
import {
  calculateRouteMetrics,
  matchRouteIncidents,
  reportedRouteDelayMinutes,
} from "../src/lib/procurement-impact"
import {
  componentIdSchema,
  inTimeZone,
  zonedIso,
  freshDeliveryDraft,
  type ChatRequest,
  type DeliveryChange,
} from "../src/lib/delivery-chat"
import type { IncidentSnapshot, LiveIncident } from "../src/lib/live-incidents"
import type {
  RoadRoute,
  RoadRouteRequest,
  RoadRouteResponse,
} from "../src/lib/procurement"
import type { PlaceResult } from "./place-search"
import { parseRouteRequest } from "./road-routing"

const component = z.object({ componentId: componentIdSchema }).strict()
const offsetTime = z.string().datetime({ offset: true })
const schemas = {
  get_workspace: z.object({}).strict(),
  get_delivery: component,
  get_incidents: z
    .object({
      componentId: componentIdSchema.optional(),
      query: z.string().max(160).optional(),
    })
    .strict(),
  search_places: z.object({ query: z.string().min(3).max(160) }).strict(),
  update_delivery: component.extend({
    quantity: z.number().int().min(1).max(10000).optional(),
    handlingMinutes: z.number().min(0).max(10080).optional(),
    departure: offsetTime.optional(),
    deadline: offsetTime.optional(),
    offerId: z.string().max(160).optional(),
    originPlaceId: z.string().max(160).optional(),
    destinationPlaceId: z.string().max(160).optional(),
  }),
  calculate_routes: component.extend({
    avoidIncidentIds: z.array(z.string().max(160)).max(3).default([]),
    objective: z
      .enum(["fastest", "lowest-cost", "lowest-carbon"])
      .default("fastest"),
  }),
  select_route: component.extend({ routeId: z.string().max(160) }),
  reopen_review: component,
}
const descriptions = {
  get_workspace:
    "List real hardware references and the current delivery drafts. Read before answering workspace-wide questions.",
  get_delivery:
    "Get current offer, inputs, computed route metrics, baseline comparison, provenance and matched incidents for one component.",
  get_incidents:
    "Read the current incident feed, including source freshness and links. With componentId, return only reports matched to its route; without it, search global reports. Never invent incidents.",
  search_places:
    "Find actual addresses by name. Use a returned place ID in update_delivery; ask the user to disambiguate addresses when necessary.",
  update_delivery:
    "Prepare a draft update requested by the user, not an approval or booking. Dates must be ISO with explicit offset. Location IDs must come from search_places in this turn. Changing endpoints clears old routes. After changing inputs, calculate_routes to refresh the comparison.",
  calculate_routes:
    "Calculate actual road routes and deterministic timing, cost and emissions. Optional avoidance IDs must be fresh reported road restrictions matched to this component's existing route. Compare against original route; never promise an improvement or truck clearance. Prepares a draft pending user review.",
  select_route:
    "Select an already calculated route for the requested component. Prepares a draft; final Apply decision remains manual.",
  reopen_review:
    "Reopen a previously applied decision for review, retaining its previous calculations.",
} satisfies Record<keyof typeof schemas, string>
const toolNames = [
  "get_workspace",
  "get_delivery",
  "get_incidents",
  "search_places",
  "update_delivery",
  "calculate_routes",
  "select_route",
  "reopen_review",
] as const
export const deliveryTools = toolNames.map((name) => ({
  type: "function" as const,
  function: {
    name,
    description: descriptions[name],
    parameters: z.toJSONSchema(schemas[name]),
  },
}))
export type AgentDependencies = {
  snapshot: () => Promise<IncidentSnapshot>
  route: (request: RoadRouteRequest) => Promise<RoadRouteResponse>
  search: (query: string) => Promise<PlaceResult[]>
}

function incidentSummary(incident: LiveIncident) {
  return {
    id: incident.id,
    title: incident.title,
    description: incident.description.slice(0, 900),
    location: incident.location,
    status: incident.status,
    evidence: incident.evidence,
    sourceId: incident.sourceId,
    fetchedAt: incident.fetchedAt,
    updatedAt: incident.updatedAt,
    startedAt: incident.startedAt,
    endedAt: incident.endedAt,
    reportedDelayMinutes: incident.reportedDelayMinutes,
    url: incident.url,
  }
}
function routesFor(draft: DeliveryDraft) {
  const routes = draft.response?.routes ?? []
  return draft.baseline && !routes.some((r) => r.id === draft.baseline!.id)
    ? [draft.baseline, ...routes]
    : routes
}

/** Each request owns its proposals. Tools never write another user's state or approve a delivery. */
export function createDeliveryToolSession(
  input: ChatRequest,
  dependencies: AgentDependencies
) {
  const drafts = new Map(
    input.drafts.map((d) => [d.componentId, structuredClone(d)])
  )
  const originals = new Map(
    input.drafts.map((d) => [d.componentId, structuredClone(d)])
  )
  const changed = new Set<string>(),
    places = new Map<string, PlaceResult>(),
    activity: string[] = []
  let snapshotPromise: Promise<IncidentSnapshot> | undefined
  const snapshot = () => (snapshotPromise ??= dependencies.snapshot())
  function getDraft(id: string) {
    const draft = drafts.get(id) ?? freshDeliveryDraft(id, input.timeZone)
    drafts.set(id, draft)
    if (!originals.has(id)) originals.set(id, structuredClone(draft))
    return draft
  }
  const offerFor = (draft: DeliveryDraft) =>
    offersWithAssumptions(draft.componentId).find((o) => o.id === draft.offerId)
  const routeFor = (draft: DeliveryDraft) =>
    draft.routeEndpoints === endpointSignature(draft)
      ? routesFor(draft).find((r) => r.id === draft.selectedRouteId)
      : undefined
  function metrics(
    draft: DeliveryDraft,
    route: RoadRoute | undefined,
    feed: IncidentSnapshot
  ) {
    if (!route) return null
    const offer = offerFor(draft)
    if (!offer) return null
    const bases =
      offer?.dataMode === "assumed"
        ? getAssumptionBases(draft.componentId)
        : undefined
    const inputs = {
      ...draft.inputs,
      departure: zonedIso(draft.inputs.departure, input.timeZone),
      deadline: zonedIso(draft.inputs.deadline, input.timeZone),
    }
    const exposures = matchRouteIncidents(route, feed, inputs.departure)
    return calculateRouteMetrics(
      route,
      offer,
      inputs,
      bases?.costBasis ?? transportCostBasis,
      bases?.emissionsBasis ?? emissionsBasis,
      reportedRouteDelayMinutes(route, exposures, inputs.departure)
    )
  }
  function mark(draft: DeliveryDraft) {
    if (draft.saved) draft.saved = { ...draft.saved, reviewVersion: 1 }
    changed.add(draft.componentId)
  }
  async function detail(id: string) {
    const draft = getDraft(id),
      feed = await snapshot(),
      route = routeFor(draft)
    const bases =
      offerFor(draft)?.dataMode === "assumed"
        ? getAssumptionBases(id)
        : undefined
    const displayMetrics = (value: ReturnType<typeof metrics>) =>
      value
        ? {
            ...value,
            arrival: value.arrival
              ? `${inTimeZone(value.arrival, input.timeZone).replace("T", " ")} ${input.timeZone}`
              : null,
          }
        : null
    return {
      componentId: id,
      offer: offerFor(draft),
      offers: offersWithAssumptions(id),
      origin: draft.originLabel,
      destination: draft.destinationLabel,
      inputs: draft.inputs,
      timeZone: input.timeZone,
      selectedRouteId: draft.selectedRouteId,
      routes:
        draft.routeEndpoints === endpointSignature(draft)
          ? routesFor(draft).map((r) => ({
              id: r.id,
              label: r.label,
              avoidance: r.avoidance,
              metrics: displayMetrics(metrics(draft, r, feed)),
            }))
          : [],
      baseline: displayMetrics(
        metrics(draft, draft.baseline ?? undefined, feed)
      ),
      costBasis: {
        label: (bases?.costBasis ?? transportCostBasis).label,
        source: (bases?.costBasis ?? transportCostBasis).source,
        note: "Use the calculated transport estimate. Do not infer tariff multipliers or timing surcharges from the amount; this is not a carrier quote.",
      },
      carbonBasis: bases?.emissionsBasis ?? emissionsBasis,
      incidentInterpretation:
        "Matched reports establish proximity, not confirmed obstruction or an unaffected route. Zero reported delay means no usable quantified delay; actual impact may remain unknown.",
      proposedChange: changed.has(id),
      hasPreviousDecision: Boolean(draft.saved),
      finalApproval:
        "Only the user can apply the decision in the delivery planner",
      routeSource: draft.response
        ? {
            provider: draft.response.provider,
            fetchedAt: draft.response.fetchedAt,
            url: draft.response.sourceUrl,
            warnings: draft.response.warnings,
          }
        : null,
      incidents: route
        ? matchRouteIncidents(
            route,
            feed,
            zonedIso(draft.inputs.departure, input.timeZone)
          )
            .slice(0, 12)
            .map((e) => ({
              ...incidentSummary(e.incident),
              stale: e.stale,
              distanceKm: e.distanceKm,
            }))
        : [],
    }
  }
  async function execute(name: string, raw: string): Promise<object> {
    if (!Object.hasOwn(schemas, name))
      return { error: "Unknown tool. Use the supplied delivery tools only." }
    const toolName = toolNames.find((key) => key === name)!
    const schema = schemas[toolName]
    let value: object
    try {
      value = schema.parse(JSON.parse(raw))
    } catch {
      return { error: "Invalid tool arguments; check the supplied schema." }
    }
    try {
      switch (name) {
        case "get_workspace":
          activity.push("Checked the component workspace")
          return {
            components: Object.keys(partCatalog).map((id) => {
              const d = getDraft(id)
              return {
                componentId: id,
                product: offerFor(d)?.productName,
                seller: offerFor(d)?.seller,
                origin: d.originLabel,
                destination: d.destinationLabel,
                quantity: d.inputs.quantity,
                hasRoute: Boolean(routeFor(d)),
                hasPreviousDecision: Boolean(d.saved),
              }
            }),
          }
        case "get_delivery":
          activity.push("Checked delivery and calculated measures")
          return detail(component.parse(value).componentId)
        case "get_incidents": {
          const args = schemas.get_incidents.parse(value),
            feed = await snapshot()
          const draft = args.componentId ? getDraft(args.componentId) : null,
            route = draft ? routeFor(draft) : null
          const incidents = draft
            ? route
              ? matchRouteIncidents(
                  route,
                  feed,
                  zonedIso(draft.inputs.departure, input.timeZone)
                ).map((e) => e.incident)
              : []
            : feed.incidents.filter(
                (i) =>
                  !["resolved", "historical"].includes(i.status) &&
                  (!i.endedAt || Date.parse(i.endedAt) > Date.now())
              )
          const matches = incidents.filter(
            (i) =>
              !args.query ||
              `${i.title} ${i.description} ${i.location} ${i.country}`
                .toLowerCase()
                .includes(args.query.toLowerCase())
          )
          activity.push("Read current incident sources")
          return {
            generatedAt: feed.generatedAt,
            sources: feed.sources,
            total: matches.length,
            reports: matches.slice(0, 12).map(incidentSummary),
            note:
              draft && !route
                ? "Calculate a route before assessing this delivery's exposure."
                : "Proximity is screening, not proof of an obstruction. Check source freshness, direction and vehicle restrictions.",
          }
        }
        case "search_places": {
          const found = await dependencies.search(
            schemas.search_places.parse(value).query
          )
          found.forEach((place) => places.set(place.id, place))
          activity.push("Looked up named locations")
          return { places: found }
        }
        case "update_delivery": {
          const args = schemas.update_delivery.parse(value),
            draft = structuredClone(getDraft(args.componentId))
          if (args.offerId) {
            const offer = offersWithAssumptions(args.componentId).find(
              (o) => o.id === args.offerId
            )
            if (!offer)
              return { error: "Choose an offer returned by get_delivery." }
            draft.offerId = offer.id
            draft.originLabel = offer.dispatch?.label ?? ""
            draft.originLon = String(offer.dispatch?.coordinates[0] ?? "")
            draft.originLat = String(offer.dispatch?.coordinates[1] ?? "")
          }
          for (const side of ["origin", "destination"] as const) {
            const id = args[`${side}PlaceId`]
            if (!id) continue
            const place = places.get(id)
            if (!place)
              return {
                error:
                  "Use a location returned by search_places in this request.",
              }
            draft[`${side}Label`] = place.label
            draft[`${side}Lon`] = String(place.coordinates[0])
            draft[`${side}Lat`] = String(place.coordinates[1])
          }
          if (args.quantity !== undefined) draft.inputs.quantity = args.quantity
          if (args.handlingMinutes !== undefined)
            draft.inputs.handlingMinutes = args.handlingMinutes
          for (const key of ["departure", "deadline"] as const)
            if (args[key])
              draft.inputs[key] = inTimeZone(args[key], input.timeZone)
          if (
            draft.inputs.departure &&
            draft.inputs.deadline &&
            zonedIso(draft.inputs.deadline, input.timeZone) <=
              zonedIso(draft.inputs.departure, input.timeZone)
          )
            return { error: "The arrival deadline must be after departure." }
          if (
            draft.offerId !== getDraft(args.componentId).offerId ||
            endpointSignature(draft) !==
              endpointSignature(getDraft(args.componentId))
          ) {
            draft.response = null
            draft.baseline = null
            draft.selectedRouteId = ""
            draft.routeEndpoints = ""
            draft.avoidedIds = []
          }
          drafts.set(args.componentId, draft)
          mark(draft)
          activity.push("Prepared delivery input changes")
          return detail(args.componentId)
        }
        case "calculate_routes": {
          const args = schemas.calculate_routes.parse(value),
            draft = getDraft(args.componentId),
            feed = await snapshot(),
            oldRoute = routeFor(draft)
          if (
            [
              draft.originLon,
              draft.originLat,
              draft.destinationLon,
              draft.destinationLat,
            ].some((n) => !n.trim())
          )
            return {
              error: "Choose origin and destination by name before routing.",
            }
          const matches = oldRoute
            ? matchRouteIncidents(
                oldRoute,
                feed,
                zonedIso(draft.inputs.departure, input.timeZone)
              )
            : []
          const avoid = args.avoidIncidentIds.map((id) =>
            matches.find(
              (e) =>
                e.incident.id === id &&
                !e.stale &&
                e.kind === "reported-restriction"
            )
          )
          if (avoid.some((e) => !e))
            return {
              error:
                "Avoidance requires fresh road restrictions matched to the existing route. Read get_delivery first.",
            }
          const incidents = avoid.flatMap((e) => (e ? [e.incident] : []))
          const request = parseRouteRequest({
            origin: [Number(draft.originLon), Number(draft.originLat)],
            destination: [
              Number(draft.destinationLon),
              Number(draft.destinationLat),
            ],
            exclude: incidents.flatMap((i) =>
              !i.geometry && i.coordinates ? [i.coordinates] : []
            ),
            excludePaths: incidents.flatMap((i) =>
              i.geometry?.type === "LineString"
                ? [i.geometry.coordinates]
                : (i.geometry?.coordinates ?? [])
            ),
          })
          const response = await dependencies.route(request)
          const candidates = response.routes.filter(
            (r) => !incidents.length || r.avoidance
          )
          if (!candidates.length)
            return {
              error:
                "The router did not return an avoidance route. Your draft was not changed.",
            }
          const score = (r: RoadRoute) => {
            const m = metrics(draft, r, feed)!
            return args.objective === "lowest-cost"
              ? (m.transportEstimateEur ?? Infinity)
              : args.objective === "lowest-carbon"
                ? (m.emissionsKg ?? Infinity)
                : m.drivingMinutes + m.reportedDelayMinutes
          }
          const selected = [...candidates].sort(
            (a, b) => score(a) - score(b)
          )[0]
          if (!Number.isFinite(score(selected)))
            return {
              error:
                "That objective cannot be calculated with the current inputs. Set departure and a priced offer first.",
            }
          draft.baseline = incidents.length
            ? (draft.baseline ?? oldRoute ?? selected)
            : (response.routes.find((r) => !r.avoidance) ?? selected)
          draft.response = response
          draft.selectedRouteId = selected.id
          draft.routeEndpoints = endpointSignature(draft)
          draft.avoidedIds = args.avoidIncidentIds
          mark(draft)
          activity.push("Calculated road routes and tradeoffs")
          return detail(args.componentId)
        }
        case "select_route": {
          const args = schemas.select_route.parse(value),
            draft = getDraft(args.componentId)
          if (
            draft.routeEndpoints !== endpointSignature(draft) ||
            !routesFor(draft).some((r) => r.id === args.routeId)
          )
            return {
              error: "Choose a route from the current calculated alternatives.",
            }
          draft.selectedRouteId = args.routeId
          mark(draft)
          activity.push("Prepared a route selection")
          return detail(args.componentId)
        }
        case "reopen_review": {
          const draft = getDraft(component.parse(value).componentId)
          if (!draft.saved)
            return { error: "This delivery already awaits its first decision." }
          mark(draft)
          activity.push("Prepared to reopen the decision")
          return detail(draft.componentId)
        }
      }
    } catch {
      return {
        error:
          "This tool could not complete. Check inputs or retry the live source. Do not claim a successful change or invent missing values.",
      }
    }
    return { error: "Unknown tool" }
  }
  return {
    execute,
    activity,
    async changes(): Promise<DeliveryChange[]> {
      if (!changed.size) return []
      const feed = await snapshot()
      return [...changed].map((id) => {
        const draft = getDraft(id),
          before = originals.get(id)!
        return {
          componentId: id,
          draft,
          before: metrics(before, routeFor(before), feed),
          after: metrics(draft, routeFor(draft), feed),
        }
      })
    },
  }
}
