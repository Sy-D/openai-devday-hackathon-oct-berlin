"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { useMemo, useState } from "react"
import {
  ArrowRight,
  Box,
  CheckCircle2,
  ChevronRight,
  Cuboid,
  Layers3,
  Package,
  RotateCcw,
  Search,
  ShieldCheck,
  Truck,
  X,
} from "lucide-react"
import { AppShell } from "@/components/dashboard/app-shell"
import { Button, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { dsxParts, disruptionEvents } from "@/src/data/dsx"
import {
  getPartStatus,
  getPartRoutes,
  recommendedRoute,
} from "@/src/lib/dsx-routing"
import { useDisruptions } from "./use-disruptions"
import { useConfirmedRoutes } from "./use-confirmed-routes"
import { deliveryStatus, needsRouteReview } from "@/src/lib/dsx-confirmation"
import { DisruptionFeed, FeedStatus, IncomingAlert } from "./disruption-feed"
import styles from "./dsx.module.css"

const RackViewer = dynamic(() => import("./rack-viewer"), {
  ssr: false,
  loading: () => (
    <div className={styles.viewerLoading}>
      <Cuboid size={32} />
      <span>Preparing the interactive model…</span>
    </div>
  ),
})
const statusLabels = {
  blocked: "Delivery blocked",
  delayed: "Delivery delayed",
  "on-track": "On track",
  delivered: "Delivered",
}
const euro = (value: number) =>
  new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value)

export default function DsxDashboard() {
  const { activeEventIds } = useDisruptions()
  const { assignments } = useConfirmedRoutes()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mode, setMode] = useState<"solid" | "wireframe" | "schematic">("solid")
  const [resetKey, setResetKey] = useState(0)
  const [partQuery, setPartQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const assessed = useMemo(
    () =>
      dsxParts.map((part) => {
        const saved = assignments.find((item) => item.componentId === part.id)
        const result = getPartStatus(part.id, activeEventIds, saved?.routeId)
        const review =
          result.status !== "delivered" && needsRouteReview(saved, result.route)
        return { ...result, review, status: deliveryStatus(result, saved) }
      }),
    [activeEventIds, assignments]
  )
  const attention = assessed.filter(
    (item) => item.status === "blocked" || item.status === "delayed"
  )
  const filteredParts = assessed.filter((item) => {
    const matchesQuery =
      `${item.part.name} ${item.part.category} ${item.part.supplier}`
        .toLowerCase()
        .includes(partQuery.trim().toLowerCase())
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "attention"
        ? item.status === "blocked" || item.status === "delayed"
        : item.status === statusFilter)
    return matchesQuery && matchesStatus
  })
  const visibleIds = filteredParts.map((item) => item.part.id)
  const selected = filteredParts.find((item) => item.part.id === selectedId)
  const selectedDecision = assignments.find(
    (item) => item.componentId === selected?.part.id
  )
  function inspectPart(id: string) {
    setPartQuery("")
    setStatusFilter("all")
    setSelectedId(id)
  }
  const alternative = selected
    ? recommendedRoute(getPartRoutes(selected.part.id, activeEventIds))
    : undefined
  const viewerParts = assessed.map((item) => ({
    id: item.part.id,
    name: item.part.name,
    status: item.status,
  }))

  return (
    <AppShell breadcrumb={["Workspace", "Overview"]}>
      <main id="main" className={styles.workspace} tabIndex={-1}>
        <header className={styles.hero}>
          <div>
            <div className={styles.eyebrow}>
              <span className={styles.greenDot} /> FORMA / INFRASTRUCTURE
              DELIVERY
            </div>
            <h1>One pod. Every dependency.</h1>
            <p>
              See what is holding your AI infrastructure back. Go from a part to
              a recovery plan.
            </p>
          </div>
          <div className={styles.heroActions}>
            <Badge variant="outline">Simulated workspace</Badge>
            <FeedStatus />
          </div>
        </header>
        <section className={styles.readiness} aria-label="Delivery overview">
          <div>
            <span className={styles.metricIcon}>
              <Cuboid size={20} />
            </span>
            <div>
              <small>DEPLOYMENT</small>
              <strong>Berlin · POD 01</strong>
              <span>DSX POD inspired reference</span>
            </div>
          </div>
          <div>
            <span className={styles.metricIcon} data-tone="red">
              <Package size={20} />
            </span>
            <div>
              <small>REQUIRES ACTION</small>
              <strong data-testid="dsx-action-count">
                {attention.length} <em>of {dsxParts.length} parts</em>
              </strong>
              <span>Delivery issues, not hardware failures</span>
            </div>
          </div>
          <div>
            <span className={styles.metricIcon} data-tone="green">
              <ShieldCheck size={20} />
            </span>
            <div>
              <small>DELIVERY READINESS</small>
              <strong>
                {
                  assessed.filter(
                    (item) =>
                      item.status === "on-track" || item.status === "delivered"
                  ).length
                }{" "}
                <em>on track or delivered</em>
              </strong>
              <span>Updated from current routes</span>
            </div>
          </div>
        </section>
        <IncomingAlert />
        <div className={styles.overviewGrid}>
          <section
            className={styles.modelCard}
            aria-label="Interactive DSX POD model"
          >
            <div className={styles.modelToolbar}>
              <div>
                <span className={styles.modelTitle}>
                  <Box size={15} /> POD 01 <small>/ DIGITAL OVERVIEW</small>
                </span>
              </div>
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
                  title="Restore the full 3D model and clear the selected part"
                  onClick={() => {
                    setMode("solid")
                    setSelectedId(null)
                    setPartQuery("")
                    setStatusFilter("all")
                    setResetKey((value) => value + 1)
                  }}
                >
                  <RotateCcw size={14} />
                  Reset view
                </Button>
              </div>
            </div>
            <div
              className={styles.modelSearch}
              role="search"
              aria-label="Find pod components"
            >
              <div className={styles.searchField}>
                <Search size={15} aria-hidden="true" />
                <Input
                  type="search"
                  aria-label="Find a part or supplier"
                  placeholder="Find a part or supplier…"
                  value={partQuery}
                  onChange={(event) => setPartQuery(event.target.value)}
                />
              </div>
              <select
                aria-label="Filter parts by delivery state"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">All delivery states</option>
                <option value="attention">Needs action</option>
                <option value="blocked">Delivery blocked</option>
                <option value="delayed">Delivery delayed</option>
                <option value="on-track">On track</option>
                <option value="delivered">Delivered</option>
              </select>
              <span role="status">
                {filteredParts.length} of {dsxParts.length} parts
              </span>
            </div>
            <div className={styles.modelStage}>
              <RackViewer
                parts={viewerParts}
                visibleIds={visibleIds}
                selectedId={selected?.part.id ?? null}
                onSelect={setSelectedId}
                mode={mode}
                resetKey={resetKey}
              />
            </div>
            <div className={styles.modelFooter}>
              <span>Drag to orbit · scroll to zoom · right-drag to pan</span>
              <div>
                <i data-status="blocked" />
                Blocked <i data-status="delayed" />
                Delayed <i data-status="on-track" />
                On track
              </div>
            </div>
          </section>
          <aside
            className={styles.inspection}
            aria-label="Component inspection"
          >
            {selected ? (
              <section
                role="dialog"
                aria-modal="false"
                aria-labelledby="inspection-title"
                className={styles.inspectionBody}
                key={selected.part.id}
              >
                <div className={styles.sectionHeading}>
                  <span className={styles.eyebrow}>PART INSPECTION</span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setSelectedId(null)}
                    aria-label="Close part inspection"
                  >
                    <X size={16} />
                  </Button>
                </div>
                <span className={styles.pill} data-status={selected.status}>
                  {selected.review
                    ? "Confirmation needs review"
                    : statusLabels[selected.status]}
                </span>
                <h2 id="inspection-title">{selected.part.name}</h2>
                <p>{selected.part.description}</p>
                <dl className={styles.facts}>
                  <div>
                    <dt>Supplier</dt>
                    <dd>
                      {selected.part.supplier}
                      <small>{selected.part.supplierLocation}</small>
                    </dd>
                  </div>
                  <div>
                    <dt>Shipment</dt>
                    <dd>
                      {selected.part.quantity} {selected.part.unit}
                    </dd>
                  </div>
                  <div>
                    <dt>Delivery forecast</dt>
                    <dd>
                      {selected.status === "delivered"
                        ? "Received at site"
                        : selected.route.available
                          ? `${selected.route.etaHours}h from dispatch`
                          : "Route unavailable"}
                      <small>Target: {selected.part.deadlineHours}h</small>
                    </dd>
                  </div>
                  <div>
                    <dt>Recovery decision</dt>
                    <dd>
                      {selected.review
                        ? "Needs review"
                        : selectedDecision
                          ? "Confirmed"
                          : selected.status === "blocked" ||
                              selected.status === "delayed"
                            ? "Awaiting decision"
                            : "No action needed"}
                    </dd>
                  </div>
                </dl>
                <div className={styles.cause} data-status={selected.status}>
                  <strong>What needs attention</strong>
                  <p>
                    {selected.review
                      ? "The route changed after confirmation. Review its current cost, ETA and availability."
                      : selected.reason}
                  </p>
                  {selected.eventIds.map((id) => (
                    <span key={id}>
                      {disruptionEvents.find((event) => event.id === id)?.title}
                    </span>
                  ))}
                </div>
                {selected.status !== "delivered" && (
                  <>
                    <div className={styles.recoveryHint}>
                      <Truck size={17} />
                      <div>
                        {alternative ? (
                          <>
                            <strong>{alternative.name}</strong>
                            <span>
                              {alternative.etaHours}h · {euro(alternative.cost)}{" "}
                              transport
                            </span>
                          </>
                        ) : (
                          <>
                            <strong>No on-time route available</strong>
                            <span>
                              Review the incident and delivery target.
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <Link
                      className={buttonVariants()}
                      href={`/planning?component=${selected.part.id}`}
                    >
                      Open recovery plan <ArrowRight size={16} />
                    </Link>
                  </>
                )}
                <Link className={styles.textLink} href="/suppliers">
                  Explore supplier intelligence <ChevronRight size={14} />
                </Link>
              </section>
            ) : (
              <div className={styles.inspectionBody}>
                <span className={styles.eyebrow}>YOUR NEXT MOVE</span>
                <h2>
                  {attention.length
                    ? "Start with the red dots."
                    : "Every delivery is on track."}
                </h2>
                <p>
                  Select a part to inspect its supplier, delivery route and
                  available recovery options.
                </p>
                <div className={styles.actionList}>
                  {attention.map((item) => (
                    <button
                      key={item.part.id}
                      onClick={() => inspectPart(item.part.id)}
                    >
                      <span
                        className={styles.statusDot}
                        data-status={item.status}
                      />
                      <div>
                        <strong>{item.part.name}</strong>
                        <small>
                          {item.review
                            ? "Confirmation needs review"
                            : statusLabels[item.status]}
                        </small>
                      </div>
                      <ChevronRight size={16} />
                    </button>
                  ))}
                </div>
                <div className={styles.inspectionNote}>
                  <CheckCircle2 size={18} />
                  <p>
                    All ten subsystems are selectable. A confirmed recovery
                    route updates this overview.
                  </p>
                </div>
              </div>
            )}
          </aside>
        </div>
        <section
          className={styles.partsSection}
          aria-label="Pod component inventory"
        >
          <div className={styles.sectionHeading}>
            <h2>Inside the pod</h2>
            <span>
              {filteredParts.length} of {dsxParts.length} tracked subsystems
            </span>
          </div>
          <div className={styles.partInventory}>
            {filteredParts.map((item) => (
              <button
                key={item.part.id}
                aria-pressed={selectedId === item.part.id}
                onClick={() => setSelectedId(item.part.id)}
              >
                <span className={styles.partNumber}>
                  {String(
                    dsxParts.findIndex((part) => part.id === item.part.id) + 1
                  ).padStart(2, "0")}
                </span>
                <span>
                  <strong>{item.part.name}</strong>
                  <small>
                    <i className={styles.statusDot} data-status={item.status} />
                    {item.review
                      ? "Review required"
                      : statusLabels[item.status]}
                  </small>
                </span>
              </button>
            ))}
          </div>
          {filteredParts.length === 0 && (
            <div className={styles.empty}>
              <Search size={20} />
              <span>No parts match these filters.</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPartQuery("")
                  setStatusFilter("all")
                }}
              >
                Clear part filters
              </Button>
            </div>
          )}
        </section>
        <DisruptionFeed />
        <footer className={styles.pageFooter}>
          <span>
            <strong>forma.</strong> Make the connection.
          </span>
          <p>
            Schematic inspired by{" "}
            <a
              href="https://www.nvidia.com/en-us/data-center/products/dsx/pod/"
              target="_blank"
              rel="noreferrer"
            >
              NVIDIA DSX POD
            </a>
            . Illustrative geometry; fictional suppliers, routes and incidents.
            No hardware telemetry or live incident provider connected.
          </p>
        </footer>
      </main>
    </AppShell>
  )
}
