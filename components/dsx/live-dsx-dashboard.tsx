"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { useRef, useState } from "react"
import {
  ArrowRight,
  BookOpen,
  Cuboid,
  Layers3,
  PackageSearch,
  Radio,
  RotateCcw,
  Search,
  X,
} from "lucide-react"
import { AppShell } from "@/components/dashboard/app-shell"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LiveIncidentFeed } from "@/components/incidents/live-incident-feed"
import { useLiveIncidents } from "@/components/incidents/use-live-incidents"
import { isCurrentIncident } from "@/components/incidents/incident-data"
import {
  partCatalog,
  getPartReference,
  type PartComponentId,
} from "@/src/data/part-catalog"
import { PartProvenance } from "./part-provenance"
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
const viewerParts: RackPart[] = references.map((part) => ({
  id: part.componentId,
  name: componentNames[part.componentId],
  status: "unknown",
}))

export default function LiveDsxDashboard({
  initialComponent,
}: {
  initialComponent?: string
}) {
  const { snapshot } = useLiveIncidents()
  const [selectedId, setSelectedId] = useState<string | null>(
    getPartReference(initialComponent ?? "")?.componentId ?? null
  )
  const [query, setQuery] = useState("")
  const [mode, setMode] = useState<"solid" | "wireframe" | "schematic">("solid")
  const [assemblyView, setAssemblyView] = useState<AssemblyView>("cutaway")
  const [resetKey, setResetKey] = useState(0)
  const inspectionRef = useRef<HTMLElement>(null)
  const inspectionTrigger = useRef<HTMLElement | null>(null)
  const selected = getPartReference(selectedId ?? "")
  const filtered = references.filter((part) =>
    `${componentNames[part.componentId]} ${part.manufacturer} ${part.productName}`
      .toLowerCase()
      .includes(query.trim().toLowerCase())
  )
  const current = snapshot?.incidents.filter(isCurrentIncident).length
  const healthy = snapshot?.sources.filter(
    (source) => source.state === "live"
  ).length
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
        <header className={styles.hero}>
          <div>
            <div className={styles.eyebrow}>
              FORMA / INFRASTRUCTURE WORKSPACE
            </div>
            <h1>One pod. Every dependency.</h1>
            <p>
              Explore the hardware. Follow reported incidents. Verify the
              evidence before changing a delivery plan.
            </p>
          </div>
          <div className={`${styles.heroActions} ${live.heroActions}`}>
            <Badge variant="outline">
              Live observations · researched hardware
            </Badge>
            <Link href="/?mode=demo" className={live.subtleLink}>
              Try the recovery rehearsal <ArrowRight size={13} />
            </Link>
          </div>
        </header>
        <section className={live.nextAction} aria-label="Workspace next action">
          <PackageSearch size={22} aria-hidden />
          <div>
            <h2>Verify the shipment behind each part</h2>
            <p>
              Product references are ready. Orders, dispatch locations and
              carrier routes still need confirmation before incidents can be
              tied to deliveries.
            </p>
          </div>
          <Link
            href="/incidents"
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            Review incidents <ArrowRight size={14} />
          </Link>
        </section>
        <section className={styles.readiness} aria-label="Workspace evidence">
          <div>
            <span className={styles.metricIcon}>
              <Cuboid size={20} />
            </span>
            <div>
              <small>HARDWARE REFERENCES</small>
              <strong>
                {references.length} <em>subsystems</em>
              </strong>
              <span>Manufacturer documentation linked</span>
            </div>
          </div>
          <div>
            <span className={styles.metricIcon}>
              <Radio size={20} />
            </span>
            <div>
              <small>CURRENT INCIDENT RECORDS</small>
              <strong>
                {current === undefined
                  ? "Connecting…"
                  : current.toLocaleString()}
              </strong>
              <span>
                {healthy === undefined
                  ? "Checking sources"
                  : `${healthy} sources healthy at last update`}{" "}
                · coverage is limited
              </span>
            </div>
          </div>
          <div>
            <span className={styles.metricIcon}>
              <PackageSearch size={20} />
            </span>
            <div>
              <small>SHIPMENT STATUS</small>
              <strong>Not verified</strong>
              <span>No order or carrier data connected</span>
            </div>
          </div>
        </section>
        <div className={`${styles.overviewGrid} ${live.overview}`}>
          <section
            className={styles.modelCard}
            aria-label="Interactive DSX POD model"
          >
            <div className={styles.modelToolbar}>
              <span className={styles.modelTitle}>
                <Cuboid size={15} /> POD 01 <small>/ REFERENCE MODEL</small>
              </span>
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
              <span>
                Illustrative geometry; product dimensions and compatibility are
                unverified.
              </span>
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
              <span>Neutral markers = shipment not verified</span>
            </div>
          </section>
          <aside
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
                <div className={live.evidenceNote}>
                  <strong>Delivery impact not established</strong>
                  <p>
                    A manufacturer&apos;s country footprint is not the origin of
                    this order. Confirm the dispatch site and route before
                    assigning any incident to this component.
                  </p>
                  <Link href="/incidents">
                    Review source reports <ArrowRight size={13} />
                  </Link>
                </div>
                <Link
                  className={live.subtleLink}
                  href={`/planning?component=${selected.componentId}`}
                >
                  Rehearse a recovery decision <ArrowRight size={13} />
                </Link>
                <p className={live.caption}>
                  The rehearsal uses fictional shipments and prices.
                </p>
              </section>
            ) : (
              <div className={live.emptyInspection}>
                <BookOpen size={26} />
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
          </aside>
        </div>
        <section className={live.inventory} aria-label="Hardware references">
          <div className={live.sectionHeading}>
            <h2>Hardware references</h2>
            <span>{filtered.length} components</span>
          </div>
          <div className={live.cards}>
            {filtered.map((part) => (
              <button
                key={part.componentId}
                type="button"
                className={live.part}
                aria-label={`Inspect ${componentNames[part.componentId]}`}
                aria-pressed={selected?.componentId === part.componentId}
                onClick={() => inspect(part.componentId)}
              >
                <span className={live.partCategory}>
                  {componentNames[part.componentId]}
                </span>
                <strong>{part.productName}</strong>
                <span>{part.manufacturer}</span>
                <span className={live.partState}>
                  Shipment not verified <ArrowRight size={13} />
                </span>
              </button>
            ))}
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
