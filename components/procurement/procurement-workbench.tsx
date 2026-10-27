"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CircleAlert,
  MapPin,
  Package,
  Radio,
  Route,
  Save,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { AppShell } from "@/components/dashboard/app-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useLiveIncidents } from "@/components/incidents/use-live-incidents"
import {
  formatIncidentTime,
  sourceNames,
} from "@/components/incidents/incident-data"
import { partCatalog, type PartComponentId } from "@/src/data/part-catalog"
import { defaultDeliveryLocation } from "@/src/data/procurement-offers"
import {
  offersWithAssumptions,
  getAssumptionBases,
} from "@/src/data/procurement-assumptions"
import { transportCostBasis } from "@/src/data/transport-evidence"
import { emissionsBasis } from "@/src/data/emissions-evidence"
import {
  calculateRouteMetrics,
  exposureSignature,
  matchRouteIncidents,
  reportedRouteDelayMinutes,
} from "@/src/lib/procurement-impact"
import type {
  Coordinate,
  ProcurementOffer,
  RouteExposure,
  RouteMetrics,
} from "@/src/lib/procurement"
import {
  draftKey,
  REVIEW_VERSION,
  endpointSignature,
  inputSignature,
  localDateTime,
  parseRoadResponse,
  parseSavedDraft,
  toIso,
  type DeliveryDraft,
} from "./plan-state"
import { LocationSearch } from "./location-search"
import { persistDeliveryDraft } from "@/src/lib/delivery-store"
import { freshDeliveryDraft } from "@/src/lib/delivery-chat"
import styles from "./procurement.module.css"

const RouteMap = dynamic(() => import("./route-map"), {
  ssr: false,
  loading: () => <div className={styles.mapLoading}>Loading the road map…</div>,
})
const money = (value: number | null | undefined) =>
  value == null
    ? "Not established"
    : new Intl.NumberFormat("en-IE", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 2,
      }).format(value)
const duration = (minutes: number) =>
  `${Math.floor(minutes / 60)}h ${Math.round(minutes % 60)}m`

function initialDraft(
  componentId: PartComponentId,
  offer?: ProcurementOffer
): DeliveryDraft {
  return {
    version: 1,
    componentId,
    offerId: offer?.id ?? "",
    originLabel: offer?.dispatch?.label ?? "",
    originLon: offer?.dispatch?.coordinates[0].toString() ?? "",
    originLat: offer?.dispatch?.coordinates[1].toString() ?? "",
    destinationLabel: defaultDeliveryLocation.label,
    destinationLon: defaultDeliveryLocation.coordinates[0].toString(),
    destinationLat: defaultDeliveryLocation.coordinates[1].toString(),
    inputs: { departure: "", deadline: "", handlingMinutes: 0, quantity: 1 },
    response: null,
    baseline: null,
    selectedRouteId: "",
    routeEndpoints: "",
    avoidedIds: [],
    saved: null,
  }
}

function coordinate(lon: string, lat: string): Coordinate | null {
  if (!lon.trim() || !lat.trim()) return null
  const longitude = Number(lon),
    latitude = Number(lat)
  return Number.isFinite(longitude) &&
    Number.isFinite(latitude) &&
    Math.abs(longitude) <= 180 &&
    Math.abs(latitude) <= 90
    ? [longitude, latitude]
    : null
}

function Metric({
  label,
  value,
  note,
}: {
  label: string
  value: string
  note?: string
}) {
  return (
    <div className={styles.metric}>
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  )
}

function difference(
  before: number | null,
  after: number | null,
  unit: string,
  digits = 1
) {
  if (before === null || after === null) return "—"
  const change = after - before
  return `${change > 0 ? "+" : ""}${change.toFixed(digits)} ${unit}`
}
function MetricTable({
  baseline,
  selected,
}: {
  baseline: RouteMetrics
  selected: RouteMetrics
}) {
  const baselineTravel = baseline.drivingMinutes + baseline.reportedDelayMinutes
  const selectedTravel = selected.drivingMinutes + selected.reportedDelayMinutes
  const rows = [
    [
      "Road distance",
      `${baseline.distanceKm.toFixed(1)} km`,
      `${selected.distanceKm.toFixed(1)} km`,
      difference(baseline.distanceKm, selected.distanceKm, "km"),
    ],
    [
      "Driving + reported delay",
      duration(baselineTravel),
      duration(selectedTravel),
      difference(baselineTravel, selectedTravel, "min", 0),
    ],
    [
      "Source-reported nearby delay",
      `${baseline.reportedDelayMinutes} min`,
      `${selected.reportedDelayMinutes} min`,
      difference(
        baseline.reportedDelayMinutes,
        selected.reportedDelayMinutes,
        "min",
        0
      ),
    ],
    [
      "Transport estimate",
      money(baseline.transportEstimateEur),
      money(selected.transportEstimateEur),
      difference(
        baseline.transportEstimateEur,
        selected.transportEstimateEur,
        "EUR",
        2
      ),
    ],
    [
      "Vehicle emissions estimate",
      baseline.emissionsKg == null
        ? "Not established"
        : `${baseline.emissionsKg.toFixed(1)} kg CO₂e`,
      selected.emissionsKg == null
        ? "Not established"
        : `${selected.emissionsKg.toFixed(1)} kg CO₂e`,
      difference(baseline.emissionsKg, selected.emissionsKg, "kg CO₂e"),
    ],
    [
      "Calculated arrival",
      baseline.arrival ? formatIncidentTime(baseline.arrival) : "Set departure",
      selected.arrival ? formatIncidentTime(selected.arrival) : "Set departure",
      difference(
        baseline.arrival ? Date.parse(baseline.arrival) / 60000 : null,
        selected.arrival ? Date.parse(selected.arrival) / 60000 : null,
        "min",
        0
      ),
    ],
    [
      "Deadline margin",
      baseline.bufferMinutes === null
        ? "No deadline set"
        : `${Math.round(baseline.bufferMinutes)} min`,
      selected.bufferMinutes === null
        ? "No deadline set"
        : `${Math.round(selected.bufferMinutes)} min`,
      difference(baseline.bufferMinutes, selected.bufferMinutes, "min", 0),
    ],
  ]
  return (
    <div className={styles.tableScroll}>
      <table className={styles.comparison}>
        <thead>
          <tr>
            <th scope="col">Measure</th>
            <th scope="col">Original route</th>
            <th scope="col">Selected route</th>
            <th scope="col">Change</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, before, after, delta]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{before}</td>
              <td>{after}</td>
              <td>{delta}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const hydrationSubscribe = () => () => {}
const clientReady = () => true
const serverNotReady = () => false
export function ProcurementWorkbench({
  componentId,
}: {
  componentId: PartComponentId
}) {
  const hydrated = useSyncExternalStore(
    hydrationSubscribe,
    clientReady,
    serverNotReady
  )
  return hydrated ? (
    <ReadyProcurementWorkbench componentId={componentId} />
  ) : (
    <AppShell breadcrumb={["Workspace", "Delivery planning"]}>
      <main id="main" className={styles.page} role="status">
        Loading your delivery workspace…
      </main>
    </AppShell>
  )
}

function ReadyProcurementWorkbench({
  componentId,
}: {
  componentId: PartComponentId
}) {
  const router = useRouter()
  const offers = useMemo(
    () => offersWithAssumptions(componentId),
    [componentId]
  )
  const part = partCatalog[componentId]
  const [draft, setDraft] = useState<DeliveryDraft>(() => {
    try {
      const saved = parseSavedDraft(
        localStorage.getItem(draftKey(componentId)),
        componentId
      )
      if (saved && offers.some((offer) => offer.id === saved.offerId))
        return saved
    } catch {
      /* Storage may be disabled; the current tab still works. */
    }
    return {
      ...initialDraft(componentId, offers[0]),
      inputs: {
        departure: localDateTime(),
        deadline: "",
        handlingMinutes: 0,
        quantity: 1,
      },
    }
  })
  const currentDraftRef = useRef(draft)
  useEffect(() => {
    currentDraftRef.current = draft
  }, [draft])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [selectedIncident, setSelectedIncident] = useState<string | null>(null)
  const requestRef = useRef<AbortController | null>(null)
  const routeSection = useRef<HTMLElement>(null)
  const { snapshot } = useLiveIncidents()
  useEffect(() => () => requestRef.current?.abort(), [])
  useEffect(() => {
    try {
      persistDeliveryDraft(draft)
    } catch {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Surface an external browser storage failure, not derived render state.
      setNotice("Changes remain in this tab; browser storage is unavailable.")
    }
  }, [draft, componentId])
  useEffect(() => {
    function syncDraft() {
      try {
        const raw = localStorage.getItem(draftKey(componentId))
        const next =
          raw === null
            ? freshDeliveryDraft(
                componentId,
                Intl.DateTimeFormat().resolvedOptions().timeZone
              )
            : parseSavedDraft(raw, componentId)
        if (
          next &&
          JSON.stringify(next) !== JSON.stringify(currentDraftRef.current)
        ) {
          requestRef.current?.abort()
          currentDraftRef.current = next
          setDraft(next)
          setBusy(false)
          setNotice(
            "Delivery draft updated. Review the route before applying the decision."
          )
        }
      } catch {
        /* Keep the current draft if storage is unavailable. */
      }
    }
    window.addEventListener("forma:delivery-updated", syncDraft)
    window.addEventListener("storage", syncDraft)
    return () => {
      window.removeEventListener("forma:delivery-updated", syncDraft)
      window.removeEventListener("storage", syncDraft)
    }
  }, [componentId])
  const offer = offers.find((item) => item.id === draft.offerId)
  const sellerDispatchSelected =
    offer?.dispatch &&
    Number(draft.originLon) === offer.dispatch.coordinates[0] &&
    Number(draft.originLat) === offer.dispatch.coordinates[1]
  const exampleDestinationSelected =
    Number(draft.destinationLon) === defaultDeliveryLocation.coordinates[0] &&
    Number(draft.destinationLat) === defaultDeliveryLocation.coordinates[1]
  const planningBases =
    offer?.dataMode === "assumed" ? getAssumptionBases(componentId) : undefined
  const costBasis = planningBases?.costBasis ?? transportCostBasis
  const carbonBasis = planningBases?.emissionsBasis ?? emissionsBasis
  const routes = useMemo(() => {
    const list = draft.response?.routes ?? []
    return draft.baseline &&
      !list.some((route) => route.id === draft.baseline?.id)
      ? [draft.baseline, ...list]
      : list
  }, [draft.response, draft.baseline])
  const selectedRoute =
    routes.find((route) => route.id === draft.selectedRouteId) ?? routes[0]
  const inputs = {
    ...draft.inputs,
    departure: toIso(draft.inputs.departure),
    deadline: toIso(draft.inputs.deadline),
  }
  const exposures = useMemo(
    () =>
      selectedRoute && snapshot
        ? matchRouteIncidents(
            selectedRoute,
            snapshot,
            toIso(draft.inputs.departure)
          ).sort(
            (a, b) =>
              (b.incident.reportedDelayMinutes ?? 0) -
                (a.incident.reportedDelayMinutes ?? 0) ||
              a.distanceKm - b.distanceKm
          )
        : [],
    [selectedRoute, snapshot, draft.inputs.departure]
  )
  const mapExposures = useMemo(() => {
    const unique = new Map<string, RouteExposure>()
    if (snapshot)
      for (const route of routes)
        for (const exposure of matchRouteIncidents(
          route,
          snapshot,
          toIso(draft.inputs.departure)
        ))
          unique.set(exposure.incident.id, exposure)
    return [...unique.values()]
  }, [routes, snapshot, draft.inputs.departure])
  const reportedDelay = selectedRoute
    ? reportedRouteDelayMinutes(selectedRoute, exposures, inputs.departure)
    : 0
  const baselineExposures = useMemo(
    () =>
      draft.baseline && snapshot
        ? matchRouteIncidents(
            draft.baseline,
            snapshot,
            toIso(draft.inputs.departure)
          )
        : [],
    [draft.baseline, snapshot, draft.inputs.departure]
  )
  const baselineDelay = draft.baseline
    ? reportedRouteDelayMinutes(
        draft.baseline,
        baselineExposures,
        inputs.departure
      )
    : 0
  const metrics =
    selectedRoute && offer
      ? calculateRouteMetrics(
          selectedRoute,
          offer,
          inputs,
          costBasis,
          carbonBasis,
          reportedDelay
        )
      : null
  const baselineMetrics =
    draft.baseline && offer
      ? calculateRouteMetrics(
          draft.baseline,
          offer,
          inputs,
          costBasis,
          carbonBasis,
          baselineDelay
        )
      : null
  const endpointsChanged =
    !!draft.response && draft.routeEndpoints !== endpointSignature(draft)
  const savedExposures =
    draft.saved && snapshot
      ? matchRouteIncidents(
          draft.saved.route,
          snapshot,
          toIso(draft.inputs.departure)
        )
      : []
  const evidencePending = !!draft.saved && !snapshot
  const reviewRequired =
    !!draft.saved &&
    (draft.saved.reviewVersion !== REVIEW_VERSION ||
      draft.saved.route.id !== selectedRoute?.id ||
      draft.saved.inputSignature !== inputSignature(draft) ||
      draft.saved.offerObservedAt !== offer?.observedAt ||
      (snapshot !== null &&
        draft.saved.exposureSignature !== exposureSignature(savedExposures)))
  const incompleteSources =
    snapshot?.sources.filter(
      (source) => source.state === "unavailable" || source.state === "stale"
    ) ?? []
  const currentSelectedIncident = mapExposures.find(
    (exposure) => exposure.incident.id === selectedIncident
  )

  function updateField(
    key:
      | "originLabel"
      | "originLon"
      | "originLat"
      | "destinationLabel"
      | "destinationLon"
      | "destinationLat",
    value: string
  ) {
    setDraft((previous) => ({ ...previous, [key]: value }))
    setNotice("")
  }
  function chooseOffer(id: string) {
    const next = offers.find((offer) => offer.id === id)
    if (!next) return
    requestRef.current?.abort()
    setBusy(false)
    setDraft((previous) => ({
      ...previous,
      offerId: id,
      originLabel: next.dispatch?.label ?? "",
      originLon: next.dispatch?.coordinates[0].toString() ?? "",
      originLat: next.dispatch?.coordinates[1].toString() ?? "",
      response: null,
      baseline: null,
      selectedRouteId: "",
      avoidedIds: [],
    }))
    setNotice("")
    setError("")
  }
  async function calculate(avoidId?: string) {
    if (avoidId && endpointsChanged) {
      setError(
        "Delivery locations changed. Calculate new road routes before requesting an avoidance."
      )
      return
    }
    const capturedEndpoints = endpointSignature(draft)
    const capturedOffer = draft.offerId
    const origin = coordinate(draft.originLon, draft.originLat),
      destination = coordinate(draft.destinationLon, draft.destinationLat)
    if (
      !Number.isInteger(draft.inputs.quantity) ||
      draft.inputs.quantity < 1 ||
      draft.inputs.quantity > 10000 ||
      !Number.isFinite(draft.inputs.handlingMinutes) ||
      draft.inputs.handlingMinutes < 0 ||
      draft.inputs.handlingMinutes > 10080
    ) {
      setError(
        "Enter a whole quantity from 1 to 10,000 and a handling allowance from 0 to 10,080 minutes."
      )
      return
    }
    if (!origin || !destination) {
      setError(
        "Enter valid origin and destination coordinates before calculating routes."
      )
      return
    }
    if (!offer) {
      setError("Choose a sourced seller offer first.")
      return
    }
    const avoidedIds = avoidId
      ? [...new Set([...draft.avoidedIds, avoidId])]
      : []
    const avoidedReports = avoidedIds.flatMap((id) => {
      const incident = snapshot?.incidents.find(
        (incident) => incident.id === id
      )
      return incident ? [incident] : []
    })
    const exclude = avoidedReports.flatMap((incident) =>
      !incident.geometry && incident.coordinates ? [incident.coordinates] : []
    )
    const excludePaths = avoidedReports.flatMap((incident) =>
      incident.geometry?.type === "LineString"
        ? [incident.geometry.coordinates]
        : incident.geometry?.type === "MultiLineString"
          ? incident.geometry.coordinates
          : []
    )
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    setBusy(true)
    setError("")
    setNotice("")
    try {
      const response = await fetch("/api/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin, destination, exclude, excludePaths }),
        signal: controller.signal,
      })
      if (!response.ok)
        throw new Error(
          "The road routing service could not calculate this journey. Check the locations or retry."
        )
      const parsed = parseRoadResponse(await response.json())
      if (!parsed)
        throw new Error(
          "The routing service returned an incomplete response. Your previous route is unchanged."
        )
      if (controller.signal.aborted) return
      if (
        endpointSignature(currentDraftRef.current) !== capturedEndpoints ||
        currentDraftRef.current.offerId !== capturedOffer
      ) {
        setError(
          "Delivery locations or source changed during calculation. Recalculate the current journey."
        )
        return
      }
      const next =
        parsed.routes.find((route) => route.avoidance) ?? parsed.routes[0]
      setDraft((previous) => ({
        ...previous,
        response: parsed,
        baseline:
          avoidId &&
          previous.baseline &&
          previous.routeEndpoints === capturedEndpoints
            ? previous.baseline
            : (parsed.routes.find((route) => !route.avoidance) ??
              parsed.routes[0]),
        selectedRouteId: next.id,
        avoidedIds,
        routeEndpoints: capturedEndpoints,
      }))
      setNotice(
        avoidId
          ? "A new road calculation is ready. Compare its geometry and exposure before saving."
          : "Road routes calculated. Review live reports and compare the options."
      )
      requestAnimationFrame(() => {
        routeSection.current?.focus({ preventScroll: true })
        routeSection.current?.scrollIntoView({
          behavior: "instant",
          block: "start",
        })
      })
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(
          cause instanceof Error
            ? cause.message
            : "Routing is unavailable. Your previous route is unchanged."
        )
    } finally {
      if (!controller.signal.aborted) setBusy(false)
    }
  }
  function saveDecision() {
    if (
      !selectedRoute ||
      !draft.baseline ||
      !metrics ||
      !offer ||
      !snapshot ||
      endpointsChanged
    )
      return
    setDraft((previous) => ({
      ...previous,
      saved: {
        reviewVersion: REVIEW_VERSION,
        savedAt: new Date().toISOString(),
        route: selectedRoute,
        baseline: previous.baseline ?? selectedRoute,
        metrics,
        exposureSignature: exposureSignature(exposures),
        inputSignature: inputSignature(previous),
        offerId: offer.id,
        offerObservedAt: offer.observedAt,
      },
    }))
    setNotice(
      "Route decision applied to your plan in this browser. No order, payment or transport booking was made."
    )
  }

  return (
    <AppShell breadcrumb={["Workspace", "Delivery planning"]}>
      <main id="main" className={styles.page}>
        <Link className={styles.back} href={`/?component=${componentId}`}>
          <ArrowLeft size={14} />
          Back to this part
        </Link>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>
              SOURCED PRODUCT → DELIVERY DECISION
            </p>
            <h1>Plan a delivery.</h1>
            <p>
              Choose a source, define the journey, then compare roads against
              reported incidents.
            </p>
          </div>
        </header>
        <section
          className={styles.actionBanner}
          data-state={
            reviewRequired
              ? "attention"
              : draft.saved && !evidencePending
                ? "reviewed"
                : "pending"
          }
          aria-label="Next delivery action"
        >
          {draft.saved && !reviewRequired && !evidencePending ? (
            <Check size={22} />
          ) : (
            <CircleAlert size={22} />
          )}
          <div>
            <strong>
              {reviewRequired
                ? "Review the changed delivery decision"
                : !selectedRoute
                  ? "Calculate routes for this delivery"
                  : draft.saved && !evidencePending
                    ? "Delivery decision reviewed"
                    : exposures.length
                      ? `Review ${exposures.length} nearby route reports`
                      : "Review and apply your route"}
            </strong>
            <p>
              {reviewRequired
                ? draft.saved?.reviewVersion !== REVIEW_VERSION
                  ? "Your previous plan is preserved. Review it and apply the decision when ready."
                  : "Inputs or relevant evidence changed since the saved plan."
                : !selectedRoute
                  ? "Check the dispatch point and timing, then calculate the road options."
                  : draft.saved && !evidencePending
                    ? "Your planning decision is saved. Live evidence continues to be checked."
                    : exposures.length
                      ? "Inspect source evidence and compare alternatives before choosing a route."
                      : "Compare distance, time, cost and emissions before recording a decision."}
            </p>
          </div>
          <a
            href={
              reviewRequired || draft.saved
                ? "#decision"
                : !selectedRoute
                  ? "#delivery"
                  : exposures.length
                    ? "#routes"
                    : "#decision"
            }
          >
            {reviewRequired
              ? "Review decision"
              : !selectedRoute
                ? "Define delivery"
                : draft.saved
                  ? "View decision"
                  : exposures.length
                    ? "Review reports"
                    : "Compare options"}
            <ArrowRight size={15} />
          </a>
        </section>
        <nav className={styles.steps} aria-label="Delivery workflow">
          <a href="#source">
            01 <span>Choose source</span>
          </a>
          <a href="#delivery">
            02 <span>Define delivery</span>
          </a>
          <a href="#routes">
            03 <span>Review exposure</span>
          </a>
          <a href="#decision">
            04 <span>Apply decision</span>
          </a>
        </nav>
        {draft.saved && (
          <section
            className={styles.savedBanner}
            data-review={reviewRequired}
            aria-label="Saved delivery action"
          >
            <CircleAlert size={20} />
            <div>
              <strong>
                {reviewRequired
                  ? "Saved decision needs review"
                  : evidencePending
                    ? "Checking the saved decision against current reports"
                    : "Saved delivery decision"}
              </strong>
              <p>
                {reviewRequired
                  ? draft.saved.reviewVersion !== REVIEW_VERSION
                    ? "This plan awaits your approval. The previous route and calculations remain available below."
                    : "Delivery inputs or relevant incident evidence changed. The original decision remains below for comparison."
                  : `${draft.saved.route.label} · saved ${formatIncidentTime(draft.saved.savedAt)} · in this browser`}
              </p>
            </div>
            <a href="#decision">
              Review decision <ArrowRight size={14} />
            </a>
            {!reviewRequired && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDraft((previous) => ({
                    ...previous,
                    saved: previous.saved
                      ? { ...previous.saved, reviewVersion: 1 }
                      : null,
                  }))
                  setNotice(
                    "Decision reopened for review. The previous route and calculations are preserved."
                  )
                }}
              >
                Reopen for review
              </Button>
            )}
          </section>
        )}
        {error && (
          <div className={styles.error} role="alert">
            <CircleAlert size={17} />
            {error}
          </div>
        )}
        {notice && (
          <p className={styles.notice} role="status">
            {notice}
          </p>
        )}
        <section
          id="source"
          className={styles.section}
          aria-labelledby="source-title"
        >
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>01 / SOURCE</p>
              <h2 id="source-title">Start with the exact product.</h2>
            </div>
            <div className={styles.componentPicker}>
              <span>Component</span>
              <Select
                value={componentId}
                onValueChange={(value) => {
                  if (value && Object.hasOwn(partCatalog, value))
                    router.push(
                      `/planning?component=${encodeURIComponent(value)}`
                    )
                }}
              >
                <SelectTrigger
                  aria-label="Component to plan"
                  className={styles.componentTrigger}
                >
                  <Package size={16} />
                  <SelectValue>{part.category}</SelectValue>
                </SelectTrigger>
                <SelectContent
                  align="end"
                  alignItemWithTrigger={false}
                  className={styles.componentMenu}
                >
                  {Object.values(partCatalog).map((item) => (
                    <SelectItem
                      key={item.componentId}
                      value={item.componentId}
                      className={styles.componentOption}
                    >
                      <span>
                        <strong>{item.category}</strong>
                        <small>{item.productName}</small>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className={styles.muted}>
            {part.productName} · {part.manufacturer}
          </p>
          {!offers.length && (
            <div className={styles.empty}>
              <h3>No seller offer has been verified for this component yet.</h3>
              <p>
                Use the manufacturer documentation to request an exact SKU,
                quote and dispatch location. No price or stock is inferred.
              </p>
              {part.sources.map((source) => (
                <a
                  key={source.url}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {source.title}
                  <ArrowUpRight size={14} />
                </a>
              ))}
            </div>
          )}
          <div className={styles.offerGrid}>
            {offers.map((item) => (
              <article
                key={item.id}
                className={styles.offer}
                data-selected={item.id === offer?.id}
              >
                <div className={styles.offerTop}>
                  <Badge variant="outline">
                    {item.dataMode === "assumed"
                      ? "Planning estimate"
                      : item.condition === "not-specified"
                        ? "Condition not supplied"
                        : item.condition}
                  </Badge>
                  <span>{item.seller}</span>
                </div>
                <h3>{item.productName}</h3>
                <p className={styles.sku}>SKU {item.sku}</p>
                <div className={styles.offerPrice}>
                  {item.price ? money(item.price.amount) : "Quote required"}
                  <small>
                    {item.price
                      ? `per unit · VAT ${item.price.vat}`
                      : "No published price verified"}
                  </small>
                </div>
                <p>{item.availability}</p>
                <small>
                  {item.dataMode === "assumed" ? "Prepared" : "Observed"}{" "}
                  {formatIncidentTime(item.observedAt)}
                </small>
                <div className={styles.offerActions}>
                  <Button
                    variant={item.id === offer?.id ? "secondary" : "outline"}
                    size="sm"
                    aria-pressed={item.id === offer?.id}
                    onClick={() => chooseOffer(item.id)}
                  >
                    {item.id === offer?.id ? (
                      <Check size={14} />
                    ) : (
                      <Package size={14} />
                    )}
                    {item.id === offer?.id
                      ? "Selected source"
                      : "Use this source"}
                  </Button>
                  <a
                    href={item.orderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {item.orderMode === "purchase"
                      ? "Open seller"
                      : "Request seller quote"}
                    <ArrowUpRight size={14} />
                  </a>
                </div>
                <details className={styles.evidence}>
                  <summary>Basis and evidence</summary>
                  <p className={styles.offerNote}>{item.note}</p>
                  {item.assumptions?.map((assumption) => (
                    <p key={assumption} className={styles.offerNote}>
                      {assumption}
                    </p>
                  ))}
                  {item.sources.map((source) => (
                    <a
                      key={source.url}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {source.title}
                      <ArrowUpRight size={12} />
                    </a>
                  ))}
                </details>
              </article>
            ))}
          </div>
        </section>
        <section
          id="delivery"
          tabIndex={-1}
          className={styles.section}
          aria-labelledby="delivery-title"
        >
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>02 / DELIVERY</p>
              <h2 id="delivery-title">Define the journey.</h2>
            </div>
            <div className={styles.timingTools}>
              <Badge variant="outline">Editable planning inputs</Badge>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const now = new Date()
                  setDraft((previous) => ({
                    ...previous,
                    inputs: {
                      ...previous.inputs,
                      departure: localDateTime(now),
                      deadline: localDateTime(
                        new Date(now.getTime() + 6 * 3600000)
                      ),
                      handlingMinutes: 15,
                    },
                  }))
                  setNotice(
                    "Planning timing applied: departure now, a six-hour target and15 minutes handling. Adjust these inputs to your delivery requirements."
                  )
                }}
              >
                Use planning timing
              </Button>
            </div>
          </div>
          <div className={styles.locationGrid}>
            <div className={styles.locationCard}>
              <h3>
                <MapPin size={15} /> Dispatch
              </h3>
              <LocationSearch
                name="Dispatch"
                selectedLabel={draft.originLabel}
                onSelect={(label, coordinates) =>
                  setDraft((previous) => ({
                    ...previous,
                    originLabel: label,
                    originLon: String(coordinates[0]),
                    originLat: String(coordinates[1]),
                  }))
                }
              />
              <details className={styles.locationAdvanced}>
                <summary>Advanced dispatch location details</summary>
                <div className={styles.coordinateInputs}>
                  <label>
                    Longitude
                    <Input
                      type="number"
                      step="any"
                      aria-label="Dispatch longitude"
                      value={draft.originLon}
                      onChange={(event) =>
                        updateField("originLon", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    Latitude
                    <Input
                      type="number"
                      step="any"
                      aria-label="Dispatch latitude"
                      value={draft.originLat}
                      onChange={(event) =>
                        updateField("originLat", event.target.value)
                      }
                    />
                  </label>
                </div>
              </details>
              <p>
                {sellerDispatchSelected
                  ? offer?.dispatch?.note
                  : "Selected planning dispatch point. Confirm the pickup address with the seller before booking."}
              </p>
              {sellerDispatchSelected &&
                offer?.dispatch &&
                offer.dispatch.status !== "assumed" && (
                  <a
                    href={offer.dispatch.source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Dispatch location evidence <ArrowUpRight size={12} />
                  </a>
                )}
            </div>
            <div className={styles.locationCard}>
              <h3>
                <MapPin size={15} /> Destination
              </h3>
              <LocationSearch
                name="Destination"
                selectedLabel={draft.destinationLabel}
                onSelect={(label, coordinates) =>
                  setDraft((previous) => ({
                    ...previous,
                    destinationLabel: label,
                    destinationLon: String(coordinates[0]),
                    destinationLat: String(coordinates[1]),
                  }))
                }
              />
              <details className={styles.locationAdvanced}>
                <summary>Advanced destination location details</summary>
                <div className={styles.coordinateInputs}>
                  <label>
                    Longitude
                    <Input
                      type="number"
                      step="any"
                      aria-label="Destination longitude"
                      value={draft.destinationLon}
                      onChange={(event) =>
                        updateField("destinationLon", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    Latitude
                    <Input
                      type="number"
                      step="any"
                      aria-label="Destination latitude"
                      value={draft.destinationLat}
                      onChange={(event) =>
                        updateField("destinationLat", event.target.value)
                      }
                    />
                  </label>
                </div>
              </details>
              <p>
                {exampleDestinationSelected
                  ? defaultDeliveryLocation.note
                  : "Selected delivery location. Confirm access and the exact unloading point before booking."}
              </p>
              {exampleDestinationSelected && defaultDeliveryLocation.source && (
                <a
                  href={defaultDeliveryLocation.source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Public site source <ArrowUpRight size={12} />
                </a>
              )}
            </div>
          </div>
          <div className={styles.inputGrid}>
            <label>
              Units
              <Input
                type="number"
                min={1}
                max={10000}
                aria-label="Order quantity"
                value={draft.inputs.quantity}
                onChange={(event) =>
                  setDraft((previous) => ({
                    ...previous,
                    inputs: {
                      ...previous.inputs,
                      quantity: Math.max(1, Number(event.target.value)),
                    },
                  }))
                }
              />
            </label>
            <label>
              Departure · local time
              <Input
                type="datetime-local"
                aria-label="Planned departure"
                value={draft.inputs.departure}
                onChange={(event) =>
                  setDraft((previous) => ({
                    ...previous,
                    inputs: {
                      ...previous.inputs,
                      departure: event.target.value,
                    },
                  }))
                }
              />
            </label>
            <label>
              Delivery deadline · optional
              <Input
                type="datetime-local"
                aria-label="Delivery deadline"
                value={draft.inputs.deadline}
                onChange={(event) =>
                  setDraft((previous) => ({
                    ...previous,
                    inputs: {
                      ...previous.inputs,
                      deadline: event.target.value,
                    },
                  }))
                }
              />
            </label>
            <label>
              Handling allowance · minutes
              <Input
                type="number"
                min={0}
                max={10080}
                aria-label="Handling allowance minutes"
                value={draft.inputs.handlingMinutes}
                onChange={(event) =>
                  setDraft((previous) => ({
                    ...previous,
                    inputs: {
                      ...previous.inputs,
                      handlingMinutes: Math.max(0, Number(event.target.value)),
                    },
                  }))
                }
              />
            </label>
          </div>
          <div className={styles.calculateRow}>
            <Button disabled={busy || !offer} onClick={() => void calculate()}>
              <Route size={15} />
              {busy ? "Calculating roads…" : "Calculate road routes"}
            </Button>
            <p>
              Routes use these coordinates. Departure and handling are your
              assumptions; stock does not confirm dispatch readiness.
            </p>
          </div>
        </section>
        <section
          id="routes"
          ref={routeSection}
          tabIndex={-1}
          className={styles.section}
          aria-labelledby="routes-title"
        >
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>03 / LIVE EXPOSURE</p>
              <h2 id="routes-title">
                Compare roads, then inspect the evidence.
              </h2>
            </div>
            <Link
              href={`/incidents?component=${componentId}`}
              className={styles.textLink}
            >
              All source reports <ArrowUpRight size={14} />
            </Link>
          </div>
          {endpointsChanged && (
            <p className={styles.error}>
              Locations changed. Calculate routes again before saving a
              decision.
            </p>
          )}
          {!draft.response ? (
            <div className={styles.empty}>
              <Route size={30} />
              <h3>Your route starts with the delivery inputs.</h3>
              <p>
                Calculate roads to see real geometry, driving time and nearby
                source reports.
              </p>
            </div>
          ) : (
            <>
              <p className={styles.muted}>
                {draft.response.provider} · fetched{" "}
                {formatIncidentTime(draft.response.fetchedAt)} ·{" "}
                <a
                  href={draft.response.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Routing source
                </a>
              </p>
              {draft.response.warnings.length > 0 && (
                <details className={styles.assumptions}>
                  <summary>Routing method and limits</summary>
                  {draft.response.warnings.map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </details>
              )}
              <div className={styles.routeChoices}>
                {routes.map((route) => (
                  <button
                    key={route.id}
                    className={styles.routeChoice}
                    aria-pressed={route.id === selectedRoute?.id}
                    onClick={() =>
                      setDraft((previous) => ({
                        ...previous,
                        selectedRouteId: route.id,
                      }))
                    }
                  >
                    <span>
                      {route.avoidance
                        ? "Avoidance candidate"
                        : route.id === draft.baseline?.id
                          ? "Original road route"
                          : "Alternative road route"}
                    </span>
                    <strong>{route.distanceKm.toFixed(1)} km</strong>
                    <small>
                      {duration(route.durationSeconds / 60)} driving ·{" "}
                      {route.label}
                    </small>
                  </button>
                ))}
              </div>
              <RouteMap
                routes={routes}
                selectedId={selectedRoute?.id ?? ""}
                exposures={mapExposures}
                avoidDisabled={busy || endpointsChanged}
                onSelect={(id) =>
                  setDraft((previous) => ({ ...previous, selectedRouteId: id }))
                }
                onAvoid={(id) => {
                  setSelectedIncident(id)
                  void calculate(id)
                }}
              />
              <div className={styles.exposureHeading}>
                <h3>
                  <Radio size={16} />
                  {exposures.length} nearby reports on selected route
                </h3>
              </div>
              {(!snapshot || incompleteSources.length > 0) && (
                <p className={styles.warning}>
                  {!snapshot
                    ? "Incident sources are still connecting. Exposure has not been checked."
                    : `${incompleteSources.map((source) => source.name).join(", ")} have incomplete freshness. Missing reports do not confirm a clear route.`}
                </p>
              )}
              {snapshot && exposures.length === 0 && (
                <p className={styles.muted}>
                  No matching nearby reports in the connected coverage. This is
                  not a guarantee that the road is clear.
                </p>
              )}
              <div className={styles.exposures}>
                {exposures.slice(0, 30).map((exposure) => (
                  <article
                    key={exposure.incident.id}
                    data-selected={selectedIncident === exposure.incident.id}
                  >
                    <div>
                      <Badge variant="outline">
                        {exposure.kind === "hazard"
                          ? "Hazard proximity"
                          : "Reported restriction nearby"}
                      </Badge>
                      {exposure.stale && (
                        <Badge variant="outline">Stale source</Badge>
                      )}
                      {exposure.incident.reportedDelayMinutes !== undefined && (
                        <Badge variant="secondary">
                          {exposure.incident.reportedDelayMinutes} min reported
                          delay
                        </Badge>
                      )}
                      <h4>{exposure.incident.title}</h4>
                      <p>
                        {sourceNames[exposure.incident.sourceId]} ·{" "}
                        {exposure.distanceKm.toFixed(1)} km from route ·{" "}
                        {formatIncidentTime(exposure.incident.updatedAt)}
                      </p>
                      <a
                        href={exposure.incident.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Inspect source <ArrowUpRight size={12} />
                      </a>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={
                        busy ||
                        endpointsChanged ||
                        !exposure.incident.coordinates ||
                        draft.avoidedIds.includes(exposure.incident.id)
                      }
                      onClick={() => {
                        setSelectedIncident(exposure.incident.id)
                        void calculate(exposure.incident.id)
                      }}
                    >
                      {draft.avoidedIds.includes(exposure.incident.id)
                        ? "Avoidance requested"
                        : "Avoid reported area"}
                      <ArrowRight size={13} />
                    </Button>
                  </article>
                ))}
              </div>
              {currentSelectedIncident && (
                <p className={styles.muted}>
                  Avoidance request: {currentSelectedIncident.incident.title}.
                  The routing service avoids the reported line area when
                  supplied, otherwise the point. Compare the returned road
                  geometry and remaining exposure; the full hazard boundary may
                  be unknown.
                </p>
              )}
            </>
          )}
        </section>
        <section
          id="decision"
          tabIndex={-1}
          className={styles.section}
          aria-labelledby="decision-title"
        >
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>04 / DECISION</p>
              <h2 id="decision-title">Make the tradeoff visible.</h2>
            </div>
            <Badge variant="outline">Local planning record</Badge>
          </div>
          {metrics && baselineMetrics ? (
            <>
              <div className={styles.metrics}>
                <Metric
                  label={
                    offer?.dataMode === "assumed"
                      ? "Product planning estimate"
                      : "Product subtotal"
                  }
                  value={money(metrics.productSubtotalEur)}
                  note={
                    offer?.price
                      ? `${offer.dataMode === "assumed" ? "Planning unit estimate" : "Seller price"} × ${draft.inputs.quantity}; VAT ${offer.price.vat}`
                      : "Seller quote required"
                  }
                />
                <Metric
                  label="Selected transport estimate"
                  value={money(metrics.transportEstimateEur)}
                  note="Tariff model; not a carrier quote"
                />
                <Metric
                  label="Vehicle emissions estimate"
                  value={
                    metrics.emissionsKg == null
                      ? "Not established"
                      : `${metrics.emissionsKg.toFixed(1)} kg CO₂e`
                  }
                  note="Vehicle benchmark, not measured shipment emissions"
                />
                <Metric
                  label="Deadline margin"
                  value={
                    metrics.bufferMinutes == null
                      ? "No deadline set"
                      : `${metrics.bufferMinutes < 0 ? "Late by" : "Margin"} ${duration(Math.abs(metrics.bufferMinutes))}`
                  }
                  note="Driving + reported delay + entered handling"
                />
              </div>
              <MetricTable baseline={baselineMetrics} selected={metrics} />
              <details className={styles.assumptions}>
                <summary>Cost, timing and emissions assumptions</summary>
                <p>
                  Driving time excludes carrier scheduling, traffic not present
                  in routing data, stops and seller preparation. Arrival uses
                  your departure, handling allowance and the largest nearby
                  provider-reported delay (overlapping reports are not added).
                  Direction and road restrictions still need review. It is not a
                  delivery commitment.
                </p>
                <p>{costBasis.note}</p>
                <a
                  href={
                    costBasis.source.url.startsWith("http")
                      ? costBasis.source.url
                      : "#decision"
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {costBasis.source.title}
                  <ArrowUpRight size={13} />
                </a>
                <p>{carbonBasis.note}</p>
                <a
                  href={
                    carbonBasis.source.url.startsWith("http")
                      ? carbonBasis.source.url
                      : "#decision"
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {carbonBasis.source.title}
                  <ArrowUpRight size={13} />
                </a>
              </details>
              {draft.saved && (
                <div className={styles.previousDecision}>
                  <h3>Previously saved decision</h3>
                  <p>
                    {draft.saved.route.label} ·{" "}
                    {draft.saved.route.distanceKm.toFixed(1)} km ·{" "}
                    {duration(draft.saved.metrics.drivingMinutes)} · transport
                    estimate {money(draft.saved.metrics.transportEstimateEur)}
                  </p>
                  <p>
                    Saved {formatIncidentTime(draft.saved.savedAt)}.{" "}
                    {reviewRequired
                      ? "Review the changed inputs and current evidence before applying the decision again."
                      : "Original evidence baseline preserved."}
                  </p>
                </div>
              )}
              <div className={styles.saveRow}>
                <Button
                  disabled={busy || endpointsChanged || !snapshot}
                  onClick={saveDecision}
                >
                  <Save size={15} />
                  {draft.saved
                    ? "Apply updated decision"
                    : "Apply route decision"}
                </Button>
                <p>
                  Stores a decision in this browser. It does not purchase stock,
                  book transport or change an incident.
                </p>
              </div>
            </>
          ) : (
            <p className={styles.muted}>
              Calculate a route to compare its distance, driving time and
              supported estimates.
            </p>
          )}
        </section>
      </main>
    </AppShell>
  )
}
