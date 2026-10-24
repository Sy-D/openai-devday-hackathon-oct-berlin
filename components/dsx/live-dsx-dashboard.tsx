"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { useRef, useState } from "react"
import {
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Cuboid,
  Layers3,
  PackageSearch,
  RotateCcw,
  Search,
  X,
} from "lucide-react"
import { AppShell } from "@/components/dashboard/app-shell"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LiveIncidentFeed } from "@/components/incidents/live-incident-feed"
import { useLiveIncidents } from "@/components/incidents/use-live-incidents"
import { isCurrentIncident } from "@/components/incidents/incident-data"
import {
  partCatalog,
  getPartReference,
  type PartComponentId,
} from "@/src/data/part-catalog"
import { PartProvenance } from "./part-provenance"
import { useDeliveryOverview } from "@/components/procurement/use-delivery-overview"
import { DeliveryChatOverview } from "@/components/procurement/delivery-chat"
import type { AssemblyView, RackPart } from "./rack-geometry"
import styles from "./dsx.module.css"
import live from "./live-dsx.module.css"

const RackViewer = dynamic(() => import("./rack-viewer"), {
  ssr: false,
  loading: () => (
    <div className={styles.viewerLoading}>
      <Cuboid size={32} />
      <span>Preparing the interactive model…</span>
    </div>
  ),
})

const componentNames = {
  "compute-a": "Compute rack A",
  "compute-b": "Compute rack B",
  fabric: "Network fabric",
  storage: "Storage",
  power: "Power distribution",
  cooling: "Liquid cooling",
  manifold: "Cooling manifold",
  optics: "Optical interconnects",
  controls: "Monitoring and controls",
  enclosure: "Container and roof",
} satisfies Record<PartComponentId, string>
const references = Object.values(partCatalog)

export default function LiveDsxDashboard({
  initialComponent,
}: {
  initialComponent?: string
}) {
  const { snapshot } = useLiveIncidents()
  const deliveryStates = useDeliveryOverview(snapshot)
  const viewerParts: RackPart[] = references.map((part) => {
    const delivery = deliveryStates.find(
      (item) => item.componentId === part.componentId
    )
    const review =
      delivery?.status === "changed" ||
      delivery?.status === "exposed" ||
      (delivery?.status === "unplanned" && part.componentId === "optics")
    return {
      id: part.componentId,
      name: componentNames[part.componentId],
      status:
        delivery?.status === "reviewed"
          ? "on-track"
          : review
            ? "blocked"
            : "delayed",
      statusLabel:
        delivery?.status === "reviewed"
          ? "Delivery reviewed"
          : review
            ? "Review delivery"
            : "Plan delivery",
    }
  })
  const needsReview = deliveryStates.filter(
    (item) => item.status === "changed" || item.status === "exposed"
  )
  const plannedCount = deliveryStates.filter((item) => item.planned).length
  const actionOrder = ["changed", "exposed", "ready", "unplanned", "reviewed"]
  const actions = [...deliveryStates]
    .sort(
      (a, b) =>
        actionOrder.indexOf(a.status) - actionOrder.indexOf(b.status) ||
        Number(b.componentId === "optics") -
          Number(a.componentId === "optics") ||
        Number(b.componentId === "controls") -
          Number(a.componentId === "controls")
    )
    .slice(0, 3)
  const primaryComponent = needsReview[0]?.componentId ?? "optics"
  const [selectedId, setSelectedId] = useState<string | null>(
    getPartReference(initialComponent ?? "")?.componentId ?? null
  )
  const [query, setQuery] = useState("")
  const [mode, setMode] = useState<"solid" | "wireframe" | "schematic">("solid")
  const [assemblyView, setAssemblyView] = useState<AssemblyView>("cutaway")
  const [resetKey, setResetKey] = useState(0)
  const inspectionRef = useRef<HTMLDivElement>(null)
  const inspectionTrigger = useRef<HTMLElement | null>(null)
  const selected = getPartReference(selectedId ?? "")
  const filtered = references.filter((part) =>
    `${componentNames[part.componentId]} ${part.manufacturer} ${part.productName}`
      .toLowerCase()
      .includes(query.trim().toLowerCase())
  )
  const current = snapshot?.incidents.filter(isCurrentIncident).length
  function inspect(id: string) {
    inspectionTrigger.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    setSelectedId(id)
    setAssemblyView("cutaway")
    setQuery("")
    requestAnimationFrame(() => {
      inspectionRef.current?.focus({ preventScroll: true })
      inspectionRef.current?.scrollIntoView({
        block: "nearest",
        behavior: "instant",
      })
    })
  }
  function closeInspection() {
    setSelectedId(null)
    requestAnimationFrame(() => {
      if (inspectionTrigger.current?.isConnected)
        inspectionTrigger.current.focus()
    })
  }
  function reset() {
    setSelectedId(null)
    setQuery("")
    setMode("solid")
    setAssemblyView("cutaway")
    setResetKey((value) => value + 1)
  }

  return (
    <AppShell breadcrumb={["Workspace", "Overview"]}>
      <main id="main" className={styles.workspace} tabIndex={-1}>
        <h1 className="sr-only">Infrastructure overview</h1>
        <DeliveryChatOverview />
        <section className={live.actionArea} aria-label="Delivery actions">
          <Card
            className={live.nextAction}
            data-status={
              needsReview.some((item) => item.status === "changed")
                ? "changed"
                : needsReview.length
                  ? "exposed"
                  : "ready"
            }
          >
            {needsReview.length ? (
              <AlertTriangle size={24} aria-hidden />
            ) : (
              <PackageSearch size={24} aria-hidden />
            )}
            <div>
              <span className={live.actionEyebrow}>NEXT ACTION</span>
              <h2>
                {needsReview.length
                  ? `${needsReview.length} delivery ${needsReview.length === 1 ? "decision needs" : "decisions need"} review`
                  : plannedCount
                    ? "Keep your delivery decisions moving"
                    : "Start with optical interconnects"}
              </h2>
              <p>
                {needsReview.length
                  ? "Review changed evidence and nearby reports before committing to a route."
                  : plannedCount
                    ? "Compare the latest route evidence, then save the next decision."
                    : "Published NVIDIA optics offers, a dispatch point and live road reports are ready to compare."}
              </p>
            </div>
            <Link
              href={`/planning?component=${primaryComponent}`}
              className={buttonVariants({ size: "sm" })}
            >
              {needsReview.length ? "Review deliveries" : "Open delivery plan"}{" "}
              <ArrowRight size={14} />
            </Link>
          </Card>
          <div className={live.actionRail}>
            {actions.map((item) => (
              <Card
                key={item.componentId}
                size="sm"
                className={live.actionTile}
              >
                <Link
                  href={`/planning?component=${item.componentId}`}
                  className={live.actionCard}
                  data-status={item.status}
                >
                  <span className={live.actionIndicator}>
                    {item.status === "reviewed" ? (
                      <CheckCircle2 size={17} />
                    ) : item.status === "changed" ||
                      item.status === "exposed" ? (
                      <AlertTriangle size={17} />
                    ) : (
                      <ArrowRight size={17} />
                    )}
                  </span>
                  <span>
                    <strong>{componentNames[item.componentId]}</strong>
                    <small>{item.label}</small>
                  </span>
                  <ArrowRight size={15} aria-hidden />
                </Link>
              </Card>
            ))}
          </div>
        </section>
        <section className={live.metrics} aria-label="Workspace evidence">
          <Card size="sm">
            <CardHeader>
              <CardTitle>Components</CardTitle>
            </CardHeader>
            <CardContent className={live.metricContent}>
              <strong>{references.length}</strong>
              <span>Hardware references with manufacturer documentation</span>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardTitle>Current incidents</CardTitle>
            </CardHeader>
            <CardContent className={live.metricContent}>
              <strong>
                {current === undefined ? "—" : current.toLocaleString()}
              </strong>
              <span>Source-reported hazards and transport restrictions</span>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardTitle>Delivery plans</CardTitle>
            </CardHeader>
            <CardContent className={live.metricContent}>
              <strong>{plannedCount}</strong>
              <span>{needsReview.length} decisions need review</span>
            </CardContent>
          </Card>
        </section>
        <div className={`${styles.overviewGrid} ${live.overview}`}>
          <Card
            role="region"
            className={`${styles.modelCard} ${live.modelSurface}`}
            aria-label="Interactive DSX POD model"
          >
            <div className={styles.modelToolbar}>
              <span className={styles.modelTitle}>AI data center pod</span>
              <div className={styles.modelActions}>
                <div
                  className={styles.viewControls}
                  role="group"
                  aria-label="Model display mode"
                >
                  <Button
                    size="xs"
                    variant={mode === "solid" ? "secondary" : "ghost"}
                    aria-pressed={mode === "solid"}
                    onClick={() => setMode("solid")}
                  >
                    <Cuboid size={14} />
                    3D model
                  </Button>
                  <Button
                    size="xs"
                    variant={mode === "wireframe" ? "secondary" : "ghost"}
                    aria-pressed={mode === "wireframe"}
                    onClick={() => setMode("wireframe")}
                  >
                    <Layers3 size={14} />
                    Wireframe
                  </Button>
                  <Button
                    size="xs"
                    variant={mode === "schematic" ? "secondary" : "ghost"}
                    aria-pressed={mode === "schematic"}
                    onClick={() => setMode("schematic")}
                  >
                    2D
                  </Button>
                </div>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={reset}
                  title="Restore the 3D cutaway, camera, selection and filters"
                >
                  <RotateCcw size={14} />
                  Reset view
                </Button>
              </div>
            </div>
            <div className={styles.assemblyToolbar}>
              <div
                className={styles.viewControls}
                role="group"
                aria-label="Enclosure assembly view"
              >
                {(
                  [
                    ["cutaway", "Cutaway"],
                    ["enclosed", "Enclosed"],
                    ["exploded", "Exploded"],
                  ] as const
                ).map(([value, label]) => (
                  <Button
                    key={value}
                    size="xs"
                    variant={assemblyView === value ? "secondary" : "ghost"}
                    aria-pressed={assemblyView === value}
                    disabled={mode === "schematic"}
                    onClick={() => {
                      setSelectedId(null)
                      setAssemblyView(value)
                    }}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <details className={live.geometryNote}>
                <summary>Model basis</summary>
                <p>
                  Illustrative geometry; product dimensions and compatibility
                  are unverified.
                </p>
              </details>
            </div>
            <div
              className={styles.modelSearch}
              role="search"
              aria-label="Find hardware references"
            >
              <div className={styles.searchField}>
                <Search size={15} aria-hidden />
                <Input
                  type="search"
                  aria-label="Find a part or manufacturer"
                  placeholder="Find a part or manufacturer…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <span role="status">
                {filtered.length} of {references.length} parts
              </span>
            </div>
            <div className={styles.modelStage}>
              <RackViewer
                parts={viewerParts}
                visibleIds={filtered.map((part) => part.componentId)}
                selectedId={selected?.componentId ?? null}
                onSelect={inspect}
                mode={mode}
                resetKey={resetKey}
                assemblyView={assemblyView}
              />
            </div>
            <div className={styles.modelFooter}>
              <span>Drag to orbit · scroll to zoom · right-drag to pan</span>
              <span>
                Red: review delivery · Amber: plan delivery · Green: reviewed
              </span>
            </div>
          </Card>
          <Card
            role="complementary"
            ref={inspectionRef}
            tabIndex={-1}
            className={live.inspection}
            aria-label="Component inspection"
          >
            {selected ? (
              <section
                role="dialog"
                aria-modal="false"
                aria-label={`${componentNames[selected.componentId]} inspection`}
              >
                <div className={live.inspectionHeader}>
                  <h2>{componentNames[selected.componentId]}</h2>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Close component inspection"
                    onClick={closeInspection}
                  >
                    <X size={16} />
                  </Button>
                </div>
                <PartProvenance componentId={selected.componentId} compact />
                <details className={live.evidenceNote}>
                  <summary>Origin and delivery evidence</summary>
                  <p>
                    A manufacturer&apos;s country footprint is not the origin of
                    this order. Confirm the dispatch site and route before
                    assigning any incident to this component.
                  </p>
                  <Link href={`/incidents?component=${selected.componentId}`}>
                    Review source reports <ArrowRight size={13} />
                  </Link>
                </details>
                <Link
                  className={live.subtleLink}
                  href={`/planning?component=${selected.componentId}`}
                >
                  Plan this delivery <ArrowRight size={13} />
                </Link>
                <p className={live.caption}>
                  Compare sourced seller offers and real road routes; save a
                  planning decision.
                </p>
              </section>
            ) : (
              <div className={live.emptyInspection}>
                <h2>Inspect a dependency</h2>
                <p>
                  Select a marker or a component below to see real product
                  specifications, manufacturer sources and what is known about
                  its origin.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => inspect("cooling")}
                >
                  Inspect liquid cooling <ArrowRight size={14} />
                </Button>
                <p className={live.caption}>
                  Product candidates are research references, not an approved
                  bill of materials.
                </p>
              </div>
            )}
          </Card>
        </div>
        <section className={live.inventory} aria-label="Component inventory">
          <div className={live.sectionHeading}>
            <h2>Component inventory</h2>
            <span>{filtered.length} components</span>
          </div>
          <div className={live.cards}>
            {filtered.map((part) => {
              const delivery = deliveryStates.find(
                (item) => item.componentId === part.componentId
              )
              return (
                <Card
                  size="sm"
                  key={part.componentId}
                  className={live.part}
                  data-status={delivery?.status}
                >
                  <button
                    type="button"
                    className={live.partInspect}
                    aria-label={`Inspect ${componentNames[part.componentId]}`}
                    aria-pressed={selected?.componentId === part.componentId}
                    onClick={() => inspect(part.componentId)}
                  >
                    <span className={live.partCategory}>
                      {componentNames[part.componentId]}
                    </span>
                    <strong>{part.productName}</strong>
                    <span>{part.manufacturer}</span>
                  </button>
                  <Link
                    href={`/planning?component=${part.componentId}`}
                    className={live.partState}
                  >
                    {delivery?.label ?? "Plan delivery"}{" "}
                    <ArrowRight size={13} />
                  </Link>
                </Card>
              )
            })}
          </div>
          {!filtered.length && (
            <p className={live.caption}>
              No hardware references match this search.
            </p>
          )}
        </section>
        <LiveIncidentFeed />
      </main>
    </AppShell>
  )
}
