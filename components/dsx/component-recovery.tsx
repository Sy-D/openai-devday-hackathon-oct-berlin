"use client"

import Link from "next/link"
import dynamic from "next/dynamic"
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  MapPin,
  Package,
  ShieldCheck,
  TriangleAlert,
  Truck,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { dsxParts, disruptionEvents } from "@/src/data/dsx"
import {
  getPartRoutes,
  getPartStatus,
  recommendedRoute,
  type RouteAssessment,
} from "@/src/lib/dsx-routing"
import { useDisruptions } from "./use-disruptions"
import { useConfirmedRoutes } from "./use-confirmed-routes"
import { deliveryStatus, needsRouteReview } from "@/src/lib/dsx-confirmation"
import { DisruptionFeed, FeedStatus, IncomingAlert } from "./disruption-feed"
import styles from "./dsx.module.css"

const RecoveryMap = dynamic(() => import("./recovery-map"), {
  ssr: false,
  loading: () => (
    <div className={styles.mapLoading} role="status">
      Loading route map…
    </div>
  ),
})

const money = (value: number) =>
  new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value)

export default function ComponentRecovery({
  componentId,
}: {
  componentId: string
}) {
  const { activeEventIds } = useDisruptions()
  const { assignments, confirm } = useConfirmedRoutes()
  const part = dsxParts.find((item) => item.id === componentId)!
  const routes = getPartRoutes(componentId, activeEventIds)
  const saved = assignments.find((item) => item.componentId === componentId)
  const assessment = getPartStatus(componentId, activeEventIds, saved?.routeId)
  const recommended = recommendedRoute(routes)
  const [chosenId, setChosenId] = useState<string | null>(null)
  const [reviewing, setReviewing] = useState<RouteAssessment | null>(null)
  const [notice, setNotice] = useState("")
  const selected =
    routes.find((route) => route.id === chosenId) ?? recommended ?? routes[0]
  const reviewRequired =
    assessment.status !== "delivered" &&
    needsRouteReview(saved, assessment.route)
  const status = deliveryStatus(assessment, saved)
  const needsAction = status === "blocked" || status === "delayed"
  const currentReview = routes.find((route) => route.id === reviewing?.id)
  const changedDuringReview =
    !!reviewing &&
    (!currentReview?.available ||
      currentReview.bufferHours < 0 ||
      currentReview.etaHours !== reviewing.etaHours ||
      currentReview.cost !== reviewing.cost)
  const canConfirm =
    selected.available &&
    selected.bufferHours >= 0 &&
    assessment.status !== "delivered"
  function savePlan() {
    if (!currentReview || changedDuringReview) return
    confirm(currentReview)
    setReviewing(null)
    setNotice(
      `${currentReview.name} saved. The pod overview now uses this delivery route.`
    )
  }
  return (
    <main id="main" className={styles.workspace} tabIndex={-1}>
      <Link href="/" className={styles.back}>
        <ArrowLeft size={15} />
        Back to pod overview
      </Link>
      <header className={styles.hero}>
        <div>
          <div className={styles.eyebrow}>POD 01 / COMPONENT RECOVERY</div>
          <h1>{part.name}</h1>
          <p>Review delivery routes from {part.supplierLocation} to Berlin.</p>
        </div>
        <FeedStatus />
      </header>
      <IncomingAlert />
      <section
        className={styles.actionBanner}
        data-status={needsAction ? "blocked" : "on-track"}
        aria-label="Component required action"
      >
        {needsAction ? <TriangleAlert size={23} /> : <CheckCircle2 size={23} />}
        <div>
          <h2>
            {reviewRequired
              ? "Your confirmed route needs review"
              : needsAction
                ? "This delivery needs a recovery plan"
                : saved
                  ? "Recovery route confirmed"
                  : assessment.status === "delivered"
                    ? "This part is already at site"
                    : "Delivery is on track"}
          </h2>
          <p>
            {reviewRequired
              ? "An incoming incident changed the saved route. Compare the updated alternatives before reconfirming."
              : assessment.reason}
          </p>
        </div>
        <Badge
          variant="secondary"
          className={styles.pill}
          data-status={needsAction ? "blocked" : "on-track"}
        >
          {needsAction
            ? "Action required"
            : assessment.status === "delivered"
              ? "Delivered"
              : "On track"}
        </Badge>
      </section>
      {notice && (
        <div role="status" className={styles.savedNotice}>
          <Check size={17} />
          {notice}
          <Link href="/">
            View updated pod <ArrowRight size={14} />
          </Link>
        </div>
      )}
      <section className={styles.shipmentSummary} aria-label="Shipment details">
        <div>
          <Package size={18} />
          <span>
            <small>SHIPMENT</small>
            <strong>
              {part.quantity} {part.unit}
            </strong>
          </span>
        </div>
        <div>
          <MapPin size={18} />
          <span>
            <small>SUPPLIER</small>
            <strong>{part.supplier}</strong>
            <em>{part.supplierLocation}</em>
          </span>
        </div>
        <div>
          <Clock3 size={18} />
          <span>
            <small>DELIVERY TARGET</small>
            <strong>{part.deadlineHours}h from dispatch</strong>
            <em>Fixed scenario clock</em>
          </span>
        </div>
        <div>
          <Truck size={18} />
          <span>
            <small>CURRENT ROUTE</small>
            <strong>{assessment.route.name}</strong>
            <em>
              {assessment.route.available
                ? `${assessment.route.etaHours}h forecast`
                : "Unavailable"}
            </em>
          </span>
        </div>
      </section>
      <div className={styles.recoveryGrid}>
        <Card
          className={`gap-0 py-0 ${styles.routeNetwork}`}
          aria-label="Selected delivery route"
        >
          <CardHeader className={styles.sectionHeading}>
            <div>
              <span className={styles.eyebrow}>SUPPLIER TO SITE</span>
              <CardTitle>
                <h2>{selected.name}</h2>
              </CardTitle>
              <p>
                {selected.modeLabel} · {selected.edgeIds.length} transport links
              </p>
            </div>
            <Badge
              variant="secondary"
              className={styles.pill}
              data-status={
                !selected.available
                  ? "blocked"
                  : selected.bufferHours < 0
                    ? "delayed"
                    : "on-track"
              }
            >
              {!selected.available
                ? "Route blocked"
                : selected.bufferHours < 0
                  ? "Misses target"
                  : "Meets target"}
            </Badge>
          </CardHeader>
          <CardContent className="px-0">
            <RecoveryMap key={selected.id} route={selected} />
            <ol className={styles.routeStops} aria-label="Route stops">
              {selected.nodeNames.map((name, index) => (
                <li key={`${name}-${index}`}>
                  <span>{index + 1}</span>
                  {name}
                </li>
              ))}
            </ol>
            <p className={styles.mapNote}>
              Transport links between scenario locations. Lines do not show
              exact road, rail, sea or flight paths.
            </p>
          </CardContent>
          <CardContent className={styles.routeNumbers}>
            <div>
              <small>FORECAST</small>
              <strong>
                {selected.available ? `${selected.etaHours}h` : "Unavailable"}
              </strong>
            </div>
            <div>
              <small>TRANSPORT COST</small>
              <strong>{money(selected.cost)}</strong>
            </div>
            <div>
              <small>DEADLINE BUFFER</small>
              <strong>
                {selected.available
                  ? `${selected.bufferHours > 0 ? "+" : ""}${selected.bufferHours}h`
                  : "Blocked"}
              </strong>
            </div>
          </CardContent>
          <CardContent className={styles.routeIssues}>
            {selected.eventIds.length ? (
              selected.eventIds.map((id) => {
                const event = disruptionEvents.find((item) => item.id === id)!
                return (
                  <div key={id}>
                    <TriangleAlert size={17} />
                    <span>
                      <strong>{event.title}</strong>
                      <p>{event.description}</p>
                      <small>{event.suggestedAction}</small>
                    </span>
                  </div>
                )
              })
            ) : (
              <div>
                <ShieldCheck size={18} />
                <span>
                  <strong>No active incidents on this route</strong>
                  <p>
                    All links are available in the current scenario. New alerts
                    can change this assessment.
                  </p>
                </span>
              </div>
            )}
          </CardContent>
        </Card>
        <Card
          className={styles.routeChoices}
          aria-label="Recovery route options"
        >
          <CardHeader className="px-0">
            <CardTitle>
              <h2>Recovery options</h2>
            </CardTitle>
            <CardDescription>
              Only available routes that meet the delivery target can be
              confirmed.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <div className={styles.routeOptions}>
              {routes.map((route) => (
                <Button
                  variant="outline"
                  key={route.id}
                  data-testid={`dsx-route-${route.id}`}
                  className={styles.routeOption}
                  aria-pressed={route.id === selected.id}
                  onClick={() => {
                    setChosenId(route.id)
                    setNotice("")
                  }}
                >
                  <div>
                    <span className={styles.radio}>
                      {route.id === selected.id && <i />}
                    </span>
                    <strong>{route.name}</strong>
                    {recommended?.id === route.id && (
                      <span className={styles.recommended}>Recommended</span>
                    )}
                  </div>
                  <small>{route.modeLabel}</small>
                  <div className={styles.optionMetrics}>
                    <b>{money(route.cost)}</b>
                    <span>
                      {route.available ? `${route.etaHours}h` : "Blocked"}
                    </span>
                    <em data-late={!route.available || route.bufferHours < 0}>
                      {!route.available
                        ? "Unavailable"
                        : route.bufferHours < 0
                          ? `${-route.bufferHours}h late`
                          : `${route.bufferHours}h spare`}
                    </em>
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
          {!recommended && (
            <p className={styles.noRoute} role="status">
              No available route meets the target. Resolve the incident or
              escalate the delivery commitment. No recovery is confirmed
              automatically.
            </p>
          )}
          <Button disabled={!canConfirm} onClick={() => setReviewing(selected)}>
            Review recovery plan <ArrowRight size={16} />
          </Button>
          <p className={styles.localNote}>
            Saves a planning decision in this browser. It does not book
            transport or mark the shipment delivered.
          </p>
          <Link className={styles.textLink} href="/suppliers">
            Open supplier intelligence <ArrowRight size={14} />
          </Link>
        </Card>
      </div>
      <DisruptionFeed />
      <Dialog
        open={!!reviewing}
        onOpenChange={(open) => {
          if (!open) setReviewing(null)
        }}
      >
        <DialogContent>
          <DialogTitle>Confirm recovery route</DialogTitle>
          <DialogDescription>
            Review the delivery estimate for {part.name}. This records a local
            plan, not a transport booking.
          </DialogDescription>
          {reviewing && (
            <>
              <dl className={styles.facts}>
                <div>
                  <dt>Route</dt>
                  <dd>{reviewing.name}</dd>
                </div>
                <div>
                  <dt>Transport cost</dt>
                  <dd>{money(reviewing.cost)}</dd>
                </div>
                <div>
                  <dt>Arrival forecast</dt>
                  <dd>{reviewing.etaHours}h from dispatch</dd>
                </div>
                <div>
                  <dt>Target buffer</dt>
                  <dd>{reviewing.bufferHours}h</dd>
                </div>
              </dl>
              {changedDuringReview && (
                <p role="alert" className={styles.noRoute}>
                  An incident changed this route while you were reviewing. Close
                  this dialog and review the updated options.
                </p>
              )}
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewing(null)}>
              Keep reviewing
            </Button>
            <Button
              disabled={changedDuringReview || !currentReview}
              onClick={savePlan}
            >
              Confirm recovery route
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <footer className={styles.pageFooter}>
        <p>
          Fictional supplier shipments and simulated incidents. Times are
          measured from the fixed scenario dispatch clock.
        </p>
      </footer>
    </main>
  )
}
