"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { useMemo, useRef, useState } from "react"
import {
  ArrowRight,
  ChevronRight,
  Cuboid,
  Layers3,
  RotateCcw,
  Search,
  Truck,
  X,
} from "lucide-react"
import { AppShell } from "@/components/dashboard/app-shell"
import { Button, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import type { PartAssessment } from "@/src/lib/dsx-routing"
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
type StatusFilter = "all" | "attention" | PartAssessment["status"]
const filterOptions = [
  { value: "all", label: "All delivery states" },
  { value: "attention", label: "Needs action" },
  { value: "blocked", label: "Delivery blocked" },
  { value: "delayed", label: "Delivery delayed" },
  { value: "on-track", label: "On track" },
  { value: "delivered", label: "Delivered" },
] satisfies { value: StatusFilter; label: string }[]
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
  const selectionTrigger = useRef<HTMLElement | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mode, setMode] = useState<"solid" | "wireframe" | "schematic">("solid")
  const [resetKey, setResetKey] = useState(0)
  const [partQuery, setPartQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
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
  function selectPart(id: string) {
    selectionTrigger.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    setSelectedId(id)
  }
  function closeInspection() {
    setSelectedId(null)
    selectionTrigger.current?.focus()
  }
  function inspectPart(id: string) {
    setPartQuery("")
    setStatusFilter("all")
    selectPart(id)
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
            <h1>POD 01 delivery</h1>
            <p>
              Berlin integration site · {dsxParts.length} tracked subsystems ·{" "}
              {attention.length} require action
            </p>
          </div>
          <div className={styles.heroActions}>
            <Badge variant="outline">Simulated workspace</Badge>
            <FeedStatus />
          </div>
        </header>
        <section className={styles.readiness} aria-label="Delivery overview">
          <Card size="sm">
            <CardHeader>
              <CardTitle>Deployment</CardTitle>
            </CardHeader>
            <CardContent>
              <strong>Berlin · POD 01</strong>
              <span>DSX POD reference model</span>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardTitle>Requires action</CardTitle>
            </CardHeader>
            <CardContent>
              <strong data-testid="dsx-action-count">
                {attention.length} <em>of {dsxParts.length} parts</em>
              </strong>
              <span>Blocked or delayed deliveries</span>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardTitle>On track or delivered</CardTitle>
            </CardHeader>
            <CardContent>
              <strong>
                {
                  assessed.filter(
                    (item) =>
                      item.status === "on-track" || item.status === "delivered"
                  ).length
                }{" "}
                <em>of {dsxParts.length} parts</em>
              </strong>
              <span>Based on current delivery routes</span>
            </CardContent>
          </Card>
        </section>
        <IncomingAlert />
        <div className={styles.overviewGrid}>
          <Card
            className={`gap-0 py-0 ${styles.modelCard}`}
            role="region"
            aria-label="Interactive DSX POD model"
          >
            <CardHeader className={styles.modelToolbar}>
              <div>
                <CardTitle className={styles.modelTitle}>Pod model</CardTitle>
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
            </CardHeader>
            <CardContent
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
              <Select<StatusFilter>
                items={filterOptions}
                value={statusFilter}
                onValueChange={(value) => {
                  if (value) setStatusFilter(value)
                }}
              >
                <SelectTrigger aria-label="Filter parts by delivery state">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {filterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span role="status">
                {filteredParts.length} of {dsxParts.length} parts
              </span>
            </CardContent>
            <CardContent className={styles.modelStage}>
              <RackViewer
                parts={viewerParts}
                visibleIds={visibleIds}
                selectedId={selected?.part.id ?? null}
                onSelect={selectPart}
                mode={mode}
                resetKey={resetKey}
              />
            </CardContent>
            <CardFooter className={styles.modelFooter}>
              <span>Drag to orbit · scroll to zoom · right-drag to pan</span>
              <div>
                <i data-status="blocked" />
                Blocked <i data-status="delayed" />
                Delayed <i data-status="on-track" />
                On track
              </div>
            </CardFooter>
          </Card>
          <Card
            role="complementary"
            className={`py-0 ${styles.inspection}`}
            aria-label="Component inspection"
          >
            {selected ? (
              <CardContent
                role="region"
                aria-labelledby="inspection-title"
                className={styles.inspectionBody}
                key={selected.part.id}
              >
                <div className={styles.sectionHeading}>
                  <span className={styles.eyebrow}>PART INSPECTION</span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={closeInspection}
                    aria-label="Close part inspection"
                  >
                    <X size={16} />
                  </Button>
                </div>
                <Badge
                  variant="secondary"
                  className={styles.pill}
                  data-status={selected.status}
                >
                  {selected.review
                    ? "Confirmation needs review"
                    : statusLabels[selected.status]}
                </Badge>
                <CardTitle>
                  <h2 id="inspection-title">{selected.part.name}</h2>
                </CardTitle>
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
              </CardContent>
            ) : (
              <CardContent className={styles.inspectionBody}>
                <h2>
                  {attention.length
                    ? "Deliveries requiring action"
                    : "All deliveries on track"}
                </h2>
                <p>
                  Select a part to inspect its supplier, delivery route and
                  available recovery options.
                </p>
                <div className={styles.actionList}>
                  {attention.map((item) => (
                    <Button
                      variant="ghost"
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
                    </Button>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        </div>
        <section
          className={styles.partsSection}
          aria-label="Pod component inventory"
        >
          <div className={styles.sectionHeading}>
            <h2>Component inventory</h2>
            <span>
              {filteredParts.length} of {dsxParts.length} tracked subsystems
            </span>
          </div>
          <div className={styles.partInventory}>
            {filteredParts.map((item) => (
              <Button
                variant="outline"
                key={item.part.id}
                aria-pressed={selectedId === item.part.id}
                onClick={() => selectPart(item.part.id)}
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
              </Button>
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
