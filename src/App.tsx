"use client"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Box,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock3,
  Download,
  Factory as FactoryIcon,
  FlaskConical,
  LayoutDashboard,
  Leaf,
  Network,
  Package,
  Play,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Truck,
  X,
} from "lucide-react"
import NetworkMap from "./components/NetworkMap"
import AssistantDrawer from "./components/AssistantDrawer"
import ScenarioControls from "./components/ScenarioControls"
import NeedsAction from "./components/NeedsAction"
import { requiredActions } from "./lib/actions"
import { parseDemoState, STORAGE } from "./lib/demo-state"
import {
  scenarioOrders,
  scenarioChanged,
  validScenario,
  type ScenarioInputs,
} from "./lib/scenario"
import {
  arrivalLabel,
  duration,
  factories,
  money,
  orders as originalOrders,
  parts,
  type Order,
} from "./data/network"
import {
  assignmentReview,
  createPlans,
  orderStatus,
  recommendedPlan,
  siteById,
  type Plan,
  type PlanId,
} from "./lib/planner"

type View = "overview" | "orders" | "network" | "activity"
function loadState() {
  try {
    return parseDemoState(localStorage.getItem(STORAGE))
  } catch {
    return parseDemoState(null)
  }
}
const labels = {
  action: "Needs attention",
  production: "In production",
  transit: "In transit",
  planned: "Plan confirmed",
} satisfies Record<Order["state"], string>
export default function App() {
  const [initial] = useState(loadState)
  const [view, setView] = useState<View>("overview"),
    [orderId, setOrderId] = useState(originalOrders[0].id),
    [planId, setPlanId] = useState<PlanId>(
      () =>
        initial.assignments[originalOrders[0].id]?.planId ??
        recommendedPlan(
          createPlans(scenarioOrders(initial.scenarios)[0], initial.disrupted)
        )?.id ??
        "balanced"
    )
  const [assignments, setAssignments] = useState(initial.assignments),
    [disrupted, setDisrupted] = useState(initial.disrupted),
    [events, setEvents] = useState(initial.events),
    [scenarios, setScenarios] = useState(initial.scenarios)
  const orders = useMemo(() => scenarioOrders(scenarios), [scenarios])
  const currentFactories = useMemo(
    () =>
      factories.map((factory) =>
        factory.id === "dresden" && disrupted
          ? { ...factory, queueHours: factory.queueHours + 24 }
          : factory
      ),
    [disrupted]
  )
  const [filter, setFilterValue] = useState("all"),
    [query, setQueryValue] = useState(""),
    [page, setPage] = useState(0),
    [assistant, setAssistant] = useState(false),
    [confirm, setConfirm] = useState(false),
    [settings, setSettings] = useState(false),
    [toast, setToast] = useState(""),
    [lateConsent, setLateConsent] = useState(false),
    [partTab, setPartTab] = useState<"parts" | "timeline">("parts"),
    [tour, setTour] = useState(false)
  const scenarioRef = useRef<HTMLDivElement>(null),
    plannerRef = useRef<HTMLElement>(null),
    searchRef = useRef<HTMLInputElement>(null)
  const order = orders.find((o) => o.id === orderId)!
  const plans = useMemo(() => createPlans(order, disrupted), [order, disrupted])
  const plan = plans.find((p) => p.id === planId)!,
    recommended = recommendedPlan(plans)
  const actions = useMemo(
    () => requiredActions(orders, assignments, disrupted),
    [orders, assignments, disrupted]
  )
  const attention = actions.length
  const onTime =
    Math.round(((orders.length - attention) / orders.length) * 1000) / 10
  const totalParts = orders.reduce((sum, o) => sum + o.quantity * 4, 0)
  const filtered = orders.filter(
    (o) =>
      (filter === "all" || orderStatus(o, assignments, disrupted) === filter) &&
      `${o.id} ${o.name} ${o.customer}`
        .toLowerCase()
        .includes(query.toLowerCase())
  )
  const displayed = filtered.slice(page * 5, page * 5 + 5)
  const assigned = assignments[orderId],
    status = orderStatus(order, assignments, disrupted),
    isCurrent = assigned?.planId === planId && status === "planned"
  const reviewReasons = assigned
    ? assignmentReview(order, assigned, disrupted)
    : []
  const healthy = status !== "action"
  const riskTitle =
    status === "production" || status === "transit"
      ? `${order.id} is on track`
      : status === "planned"
        ? `${order.id} is back on track`
        : reviewReasons.length
          ? `${order.id} needs plan review`
          : scenarioChanged(order)
            ? `${order.id} scenario needs a plan`
            : `${order.id} needs a production plan`
  const riskDescription =
    status === "production" || status === "transit"
      ? `The current ${labels[status].toLowerCase()} forecast is ${order.dueHours - order.baselineEta}h ahead of the delivery target. Explore alternatives below.`
      : status === "planned"
        ? `${plans.find((p) => p.id === assigned?.planId)?.name} plan confirmed for ${order.quantity} kits.`
        : reviewReasons.length
          ? reviewReasons.join(" ")
          : scenarioChanged(order)
            ? "Simulated inputs changed. Compare the new costs, capacity and delivery times before confirming."
            : disrupted
              ? "Dresden’s queue increased by 24h. Review the available routes below."
              : `The current plan misses delivery by ${Math.max(0, order.baselineEta - order.dueHours)}h. Find a better route below.`
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE,
        JSON.stringify({ assignments, disrupted, events, scenarios })
      )
    } catch {
      /* The demo remains usable when browser storage is unavailable. */
    }
  }, [assignments, disrupted, events, scenarios])
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 5500)
      return () => clearTimeout(timer)
    }
  }, [toast])
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener("keydown", listener)
    return () => window.removeEventListener("keydown", listener)
  }, [])
  function setFilter(value: string) {
    setFilterValue(value)
    if (value !== filter) setPage(0)
  }
  function setQuery(value: string) {
    setQueryValue(value)
    if (value !== query) setPage(0)
  }
  function addEvent(text: string, detail: string) {
    setEvents((es) => [
      { id: crypto.randomUUID(), text, detail, time: new Date().toISOString() },
      ...es,
    ])
  }
  function selectOrder(o: Order, target: "inputs" | "plans" = "plans") {
    setOrderId(o.id)
    setPlanId(
      assignments[o.id]?.planId ??
        recommendedPlan(createPlans(o, disrupted))?.id ??
        "balanced"
    )
    setView("overview")
    requestAnimationFrame(() => {
      const section =
        target === "inputs" ? scenarioRef.current : plannerRef.current
      section?.scrollIntoView({ behavior: "instant", block: "start" })
      section?.focus({ preventScroll: true })
    })
  }
  function assign() {
    if (!plan.feasible || (plan.bufferHours < 0 && !lateConsent)) return
    setAssignments((a) => ({
      ...a,
      [orderId]: {
        orderId,
        planId,
        cost: plan.totalCost,
        etaHours: plan.etaHours,
        assignedAt: new Date().toISOString(),
        quantity: order.quantity,
        dueHours: order.dueHours,
      },
    }))
    addEvent(
      `${orderId} · ${plan.name} plan confirmed`,
      `${siteById(plan.assemblyId).city} assembly · ${money(plan.totalCost)} · ${duration(plan.etaHours)} to delivery`
    )
    setConfirm(false)
    setToast(
      `${plan.bufferHours >= 0 ? "Order back on track." : "Late plan recorded."} ${plan.name} plan confirmed for ${orderId}.`
    )
    setTour(false)
  }
  function reset() {
    setAssignments({})
    setScenarios({})
    setDisrupted(false)
    setEvents([])
    setOrderId(orders[0].id)
    setPlanId("balanced")
    setFilter("all")
    setQuery("")
    setView("overview")
    setSettings(false)
    setPartTab("parts")
    setToast("Demo reset. Your urgent order is ready to replan.")
  }
  function applyScenario(inputs: ScenarioInputs) {
    if (!validScenario(inputs)) return
    const original = originalOrders.find((item) => item.id === orderId)!
    setScenarios((previous) => {
      const next = { ...previous }
      if (
        inputs.quantity === original.quantity &&
        inputs.dueHours === original.dueHours
      )
        delete next[orderId]
      else next[orderId] = inputs
      return next
    })
    setConfirm(false)
    setLateConsent(false)
    addEvent(
      `${orderId} · simulated order inputs updated`,
      `${order.quantity} → ${inputs.quantity} kits · deadline ${order.dueHours}h → ${inputs.dueHours}h from demo start`
    )
    setToast("Scenario applied. Routes recalculated; review before confirming.")
  }
  function restoreScenario() {
    const original = originalOrders.find((item) => item.id === orderId)!
    applyScenario({ quantity: original.quantity, dueHours: original.dueHours })
  }
  function simulate() {
    setDisrupted((d) => !d)
    addEvent(
      disrupted
        ? "Dresden capacity restored"
        : "Dresden queue increased by 24 hours",
      disrupted
        ? "Normal production estimates are available again."
        : "Compare routes again. Munich can produce the metal fingers."
    )
    setToast(
      disrupted
        ? "Dresden capacity restored."
        : "Dresden queue delayed by 24h. Compare the Fastest plan."
    )
  }
  function exportPlan() {
    const body = JSON.stringify(
      { demo: true, order, plan, assigned: isCurrent },
      null,
      2
    )
    const url = URL.createObjectURL(
      new Blob([body], { type: "application/json" })
    )
    const a = document.createElement("a")
    a.href = url
    a.download = `forma-${order.id}-${plan.id}.json`
    a.click()
    URL.revokeObjectURL(url)
    setToast("Plan exported as JSON.")
  }
  const nav = (next: View) => {
    setView(next)
    setFilter("all")
    setQuery("")
  }
  return (
    <div className="forma-app">
      <div className="app-shell">
        <div className="main-shell">
          <header className="topbar">
            <nav className="planning-view-nav" aria-label="Main navigation">
              <Button
                variant="ghost"
                className={view === "overview" ? "active" : ""}
                aria-pressed={view === "overview"}
                onClick={() => nav("overview")}
              >
                <LayoutDashboard size={16} />
                Overview
              </Button>
              <Button
                variant="ghost"
                className={view === "orders" ? "active" : ""}
                aria-pressed={view === "orders"}
                onClick={() => nav("orders")}
              >
                <Box size={16} />
                Orders<span>{orders.length}</span>
              </Button>
              <Button
                variant="ghost"
                className={view === "network" ? "active" : ""}
                aria-pressed={view === "network"}
                onClick={() => nav("network")}
              >
                <Network size={16} />
                Production network
              </Button>
              <Button
                variant="ghost"
                className={view === "activity" ? "active" : ""}
                aria-pressed={view === "activity"}
                onClick={() => nav("activity")}
              >
                <Activity size={16} />
                Activity
              </Button>
            </nav>
            <div className="topbar-actions">
              <Button
                variant="ghost"
                className="size-11"
                aria-label="Workspace settings"
                onClick={() => setSettings(true)}
              >
                <Settings2 size={18} />
              </Button>
              <div className="search-field">
                <Search size={15} />
                <Input
                  className="h-11 pl-9"
                  ref={searchRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    if (view !== "overview" && view !== "orders")
                      setView("orders")
                  }}
                  placeholder="Search orders…"
                  aria-label="Search orders"
                />
              </div>
            </div>
          </header>
          <section className="workspace-content">
            <div className="page-heading">
              <div>
                <h1>
                  {view === "overview"
                    ? "Production planning"
                    : view === "orders"
                      ? "Orders"
                      : view === "network"
                        ? "Production network"
                        : "Planning activity"}
                </h1>
                <p>Demo workspace · 27 Oct 2026, 08:00 CET</p>
              </div>
              <div className="heading-actions">
                <Button
                  variant="outline"
                  className="h-11"
                  onClick={() => {
                    reset()
                    setTour(true)
                  }}
                >
                  <Play size={14} />
                  Run demo
                </Button>
                <Button
                  variant="default"
                  className="h-11"
                  onClick={() => setAssistant(true)}
                >
                  <Sparkles size={15} />
                  Ask copilot
                </Button>
              </div>
            </div>
            {tour && (
              <div className="tour-banner">
                <Play size={16} />
                <span>
                  <strong>Your 60-second demo:</strong> inspect the urgent
                  order, compare routes, then confirm a plan. Try a disruption
                  next.
                </span>
                <Button
                  variant="ghost"
                  aria-label="Dismiss demo guide"
                  onClick={() => setTour(false)}
                >
                  <X size={16} />
                </Button>
              </div>
            )}
            <NeedsAction
              actions={actions}
              onOpen={(action) => selectOrder(action.order, action.target)}
            />
            <section className="metric-grid" aria-label="Network metrics">
              <Button
                variant="ghost"
                className="metric-card"
                onClick={() => nav("orders")}
              >
                <span className="metric-label">Active orders</span>
                <span className="metric-value">{orders.length}</span>
                <span className="metric-foot">
                  Across your production network
                </span>
              </Button>
              <Button
                variant="ghost"
                className="metric-card"
                onClick={() => nav("orders")}
              >
                <span className="metric-label">Production volume</span>
                <span className="metric-value">
                  {totalParts.toLocaleString()}
                  <small>parts</small>
                </span>
                <span className="metric-foot">
                  {orders.reduce((s, o) => s + o.quantity, 0)} kits ·{" "}
                  {money(orders.reduce((s, o) => s + o.value, 0))} order value
                </span>
              </Button>
              <Button
                variant="ghost"
                className="metric-card"
                onClick={() => {
                  setView("orders")
                  setFilter("all")
                }}
              >
                <span className="metric-label">On-time forecast</span>
                <span className="metric-value">
                  {onTime}
                  <small>%</small>
                </span>
                <span className="metric-foot">
                  {orders.length - attention} of {orders.length} active orders
                  on track
                </span>
              </Button>
              <Button
                variant="ghost"
                className="metric-card attention-card"
                onClick={() => {
                  setView("orders")
                  setFilter("action")
                }}
              >
                <span className="metric-label">Needs attention</span>
                <span className="metric-value">
                  {attention.toString().padStart(2, "0")}
                </span>
                <span className="metric-foot">
                  Review at-risk delivery plans <ArrowRight size={14} />
                </span>
              </Button>
            </section>
            {(view === "overview" || view === "network") && (
              <>
                {view === "overview" && (
                  <div className={`risk-banner ${healthy ? "resolved" : ""}`}>
                    <div className="risk-icon">
                      {healthy ? (
                        <CircleCheck size={19} />
                      ) : (
                        <TriangleAlert size={19} />
                      )}
                    </div>
                    <div>
                      <strong>{riskTitle}</strong>
                      <span>{riskDescription}</span>
                    </div>
                    <span
                      className={`status-badge ${healthy ? "planned" : "action"}`}
                    >
                      {healthy ? (
                        <Check size={12} />
                      ) : (
                        <span className="tiny-dot" />
                      )}
                      {healthy
                        ? labels[status]
                        : reviewReasons.length
                          ? "Review required"
                          : "Priority order"}
                    </span>
                  </div>
                )}
                <div
                  ref={scenarioRef}
                  tabIndex={-1}
                  className="scenario-anchor"
                >
                  <ScenarioControls
                    key={`${orderId}:${order.quantity}:${order.dueHours}`}
                    order={order}
                    onApply={applyScenario}
                    onRestore={restoreScenario}
                  />
                </div>
                <section
                  ref={plannerRef}
                  tabIndex={-1}
                  className="planning-grid"
                  aria-label="Production route planner"
                >
                  <Card className="network-card gap-0 py-0">
                    <CardHeader className="flex flex-wrap items-center justify-between gap-3 p-5">
                      <div className="space-y-1">
                        <CardTitle>
                          <h2>Production network</h2>
                        </CardTitle>
                        <CardDescription>
                          Selected route to Berlin · {plan.name}
                        </CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        className="h-11"
                        onClick={simulate}
                      >
                        <FlaskConical size={15} />
                        {disrupted ? "Restore capacity" : "Simulate disruption"}
                      </Button>
                    </CardHeader>
                    <NetworkMap
                      plan={plan}
                      orderQuantity={order.quantity}
                      disrupted={disrupted}
                    />
                    <div className="map-footer">
                      <span>
                        <i className="legend-line" /> Selected production route
                      </span>
                      <span>
                        {plan.feasible ? (
                          <>
                            <ShieldCheck size={14} />
                            Capabilities checked
                          </>
                        ) : (
                          <>
                            <TriangleAlert size={14} />
                            Route infeasible
                          </>
                        )}
                      </span>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setPartTab(partTab === "parts" ? "timeline" : "parts")
                        }}
                      >
                        {partTab === "parts" ? "View timeline" : "View parts"}
                        <ArrowUpRight size={14} />
                      </Button>
                    </div>
                  </Card>
                  <Card className="plan-panel gap-4 p-5">
                    <div className="plan-panel-header">
                      <div className="eyebrow">ROUTE PLANNER</div>
                      <span className="order-id">{order.id}</span>
                    </div>
                    <CardTitle>
                      <h2>{order.name}</h2>
                    </CardTitle>
                    <div className="order-meta">
                      <span>
                        <Package size={14} />
                        {order.quantity} kits · {order.quantity * 4} parts
                      </span>
                      <span>
                        <Clock3 size={14} />
                        Due in {duration(order.dueHours)}
                      </span>
                    </div>
                    <div
                      className="plan-options"
                      role="group"
                      aria-label="Production route options"
                    >
                      {plans.map((p) => (
                        <Button
                          variant="ghost"
                          key={p.id}
                          data-testid={`plan-${p.id}`}
                          className={`plan-option ${p.id === planId ? "selected" : ""} ${!p.feasible ? "infeasible" : ""}`}
                          onClick={() => setPlanId(p.id)}
                          aria-pressed={p.id === planId}
                        >
                          <div className="plan-option-top">
                            <span className="radio-mark">
                              {p.id === planId && <span />}
                            </span>
                            <strong>{p.name}</strong>
                            {recommended?.id === p.id && (
                              <span className="recommended-label">
                                Recommended
                              </span>
                            )}
                          </div>
                          <div className="plan-option-values">
                            <span>{money(p.totalCost)}</span>
                            <span className="option-divider" />
                            <span>
                              {p.feasible
                                ? duration(p.etaHours)
                                : "No capacity"}
                            </span>
                            <small
                              className={p.bufferHours < 0 ? "late" : "on-time"}
                            >
                              {!p.feasible
                                ? "Unavailable"
                                : p.bufferHours < 0
                                  ? `${-p.bufferHours}h late`
                                  : `${p.bufferHours}h buffer`}
                            </small>
                          </div>
                        </Button>
                      ))}
                    </div>
                    {!recommended && (
                      <p className="route-availability" role="status">
                        <TriangleAlert size={14} />
                        {plans.some((item) => item.feasible)
                          ? "No feasible route meets this deadline. Extend it, or explicitly review a late plan."
                          : "No route has enough capacity. Reduce the simulated quantity to fit an available batch."}
                      </p>
                    )}
                    <div className="plan-confidence">
                      <span>
                        Estimated on-time confidence{" "}
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-11"
                                aria-label="About on-time confidence"
                              />
                            }
                          >
                            i
                          </TooltipTrigger>
                          <TooltipContent>
                            Illustrative score based on factory reliability and
                            deadline buffer. Not a calibrated probability.
                          </TooltipContent>
                        </Tooltip>
                      </span>
                      <strong>
                        {plan.feasible ? `${plan.confidence}%` : "Unavailable"}
                      </strong>
                      <div className="confidence-track">
                        <i
                          style={{
                            width: `${plan.feasible ? plan.confidence : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="plan-delivery">
                      <Truck size={16} />
                      <span>
                        {plan.feasible ? (
                          <>
                            Arrives{" "}
                            <strong>{arrivalLabel(plan.etaHours)}</strong>
                          </>
                        ) : (
                          "Cannot schedule this route"
                        )}
                      </span>
                    </div>
                    {!plan.feasible && (
                      <p className="infeasible-note">
                        {plan.issues.join(". ")}
                      </p>
                    )}
                    <Button
                      className="h-11 w-full"
                      data-testid="confirm-plan"
                      disabled={!plan.feasible || isCurrent}
                      onClick={() => {
                        setConfirm(true)
                        setLateConsent(false)
                      }}
                    >
                      {isCurrent ? (
                        <>
                          <CheckCheck size={17} />
                          Plan confirmed
                        </>
                      ) : (
                        <>
                          Review & confirm plan
                          <ArrowRight size={17} />
                        </>
                      )}
                    </Button>
                    <p className="plan-footnote">
                      {isCurrent
                        ? "Saved in this demo workspace"
                        : "Review costs and delivery before confirming"}
                    </p>
                  </Card>
                </section>
                <Card className="parts-card gap-0 py-0">
                  <div className="parts-tabs">
                    <Button
                      variant="ghost"
                      className={partTab === "parts" ? "active" : ""}
                      onClick={() => setPartTab("parts")}
                    >
                      Parts & assembly<span>3 components</span>
                    </Button>
                    <Button
                      variant="ghost"
                      className={partTab === "timeline" ? "active" : ""}
                      onClick={() => setPartTab("timeline")}
                    >
                      Delivery timeline
                    </Button>
                    <span className="parts-card-note">
                      <Leaf size={13} />
                      {plan.co2Kg} kg estimated CO₂
                    </span>
                  </div>
                  {partTab === "parts" ? (
                    <CardContent className="parts-flow">
                      {plan.legs.map((leg) => {
                        const part = parts.find((p) => p.id === leg.partId)!
                        return (
                          <div className="part-cell" key={leg.partId}>
                            <div>
                              <strong>{part.name}</strong>
                              <span>
                                {leg.quantity} × {part.material} <i>·</i>{" "}
                                {part.process === "Purchased"
                                  ? "Sourced"
                                  : part.process}
                              </span>
                              <small>
                                <span className="tiny-dot" />
                                {siteById(leg.factoryId).city}
                                <ArrowRight size={11} />
                                {siteById(plan.assemblyId).city}
                              </small>
                            </div>
                          </div>
                        )
                      })}
                      <div className="assembly-cell">
                        <div>
                          <strong>
                            Assemble in {siteById(plan.assemblyId).city}
                          </strong>
                          <span>
                            {plan.feasible
                              ? `Starts at ${plan.assemblyStart}h · ${plan.assemblyHours}h assembly`
                              : "Cannot schedule: capacity exceeded"}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  ) : (
                    <Timeline plan={plan} />
                  )}
                </Card>
              </>
            )}
            {(view === "overview" || view === "orders") && (
              <Card className="orders-card gap-0 py-0">
                <CardHeader className="flex flex-wrap items-center justify-between gap-3 p-5">
                  <div className="space-y-1">
                    <CardTitle>
                      <h2>
                        Active orders{" "}
                        <Badge variant="secondary">{orders.length}</Badge>
                      </h2>
                    </CardTitle>
                    <CardDescription>
                      Select an order to review its production routes.
                    </CardDescription>
                  </div>
                  <Button variant="ghost" className="h-11" onClick={exportPlan}>
                    <Download size={15} />
                    Export selected plan
                  </Button>
                </CardHeader>
                <div className="table-toolbar">
                  <div className="table-tabs">
                    {[
                      ["all", "All orders"],
                      ["action", "Needs attention"],
                      ["production", "In production"],
                      ["transit", "In transit"],
                    ].map(([key, label]) => (
                      <Button
                        variant="ghost"
                        key={key}
                        className={filter === key ? "active" : ""}
                        onClick={() => setFilter(key)}
                      >
                        {label}
                        {key === "action" && <span>{attention}</span>}
                      </Button>
                    ))}
                  </div>
                  <span className="table-sort">
                    <ArrowDown size={13} />
                    Most recent
                  </span>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Order / customer</th>
                        <th>Product</th>
                        <th>Quantity</th>
                        <th>Delivery target</th>
                        <th>Status</th>
                        <th aria-label="Open order" />
                      </tr>
                    </thead>
                    <tbody>
                      {displayed.map((o) => {
                        const status = orderStatus(o, assignments, disrupted)
                        return (
                          <tr
                            key={o.id}
                            className={o.id === orderId ? "selected-row" : ""}
                            onClick={() => selectOrder(o)}
                          >
                            <td>
                              <Button
                                variant="ghost"
                                className="order-link"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  selectOrder(o)
                                }}
                              >
                                {o.id}
                              </Button>
                              <small>{o.customer}</small>
                            </td>
                            <td>
                              <span className="table-product">{o.name}</span>
                            </td>
                            <td>{o.quantity} kits</td>
                            <td>
                              <span>
                                {arrivalLabel(o.dueHours).split(",")[0]}
                              </span>
                              <small>In {duration(o.dueHours)}</small>
                            </td>
                            <td>
                              <span className={`status-badge ${status}`}>
                                <span className="tiny-dot" />
                                {labels[status]}
                              </span>
                            </td>
                            <td>
                              <ArrowUpRight size={16} />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {!displayed.length && (
                    <div className="empty-state">
                      <Search size={26} />
                      <h3>No matching orders</h3>
                      <p>
                        Try a different order number or clear the current
                        filter.
                      </p>
                      <Button
                        variant="outline"
                        className="h-11"
                        onClick={() => {
                          setQuery("")
                          setFilter("all")
                        }}
                      >
                        Clear filters
                      </Button>
                    </div>
                  )}
                </div>
                <div className="table-footer">
                  <span>
                    {filtered.length
                      ? `${page * 5 + 1}–${Math.min(page * 5 + 5, filtered.length)}`
                      : "0"}{" "}
                    of {filtered.length} orders
                  </span>
                  <div>
                    <Button
                      variant="ghost"
                      aria-label="Previous orders"
                      disabled={page === 0}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft size={16} />
                    </Button>
                    <span>
                      Page {page + 1} of{" "}
                      {Math.max(1, Math.ceil(filtered.length / 5))}
                    </span>
                    <Button
                      variant="ghost"
                      aria-label="Next orders"
                      disabled={(page + 1) * 5 >= filtered.length}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight size={16} />
                    </Button>
                  </div>
                </div>
              </Card>
            )}
            {view === "network" && (
              <section className="factory-grid">
                {factories
                  .filter((f) => f.kind !== "customer")
                  .map((f) => (
                    <Card className="factory-card gap-3 p-5" key={f.id}>
                      <div>
                        <span className="factory-avatar">
                          <FactoryIcon size={20} />
                        </span>
                        <span className="tag neutral">{f.kind}</span>
                      </div>
                      <h3>{f.name}</h3>
                      <p>
                        {f.city}, {f.country}
                      </p>
                      <div className="tag-row">
                        {f.processes.length ? (
                          f.processes.map((p) => (
                            <span className="tag" key={p}>
                              {p}
                            </span>
                          ))
                        ) : (
                          <span className="tag">Assembly</span>
                        )}
                        {f.materials.map((m) => (
                          <span key={m} className="tag neutral">
                            {m}
                          </span>
                        ))}
                      </div>
                      <div className="utilization-label">
                        <span>Utilization</span>
                        <strong>{f.utilization}%</strong>
                      </div>
                      <div className="utilization-bar">
                        <i style={{ width: `${f.utilization}%` }} />
                      </div>
                      <div className="factory-footer">
                        <span>{f.capacity} parts / batch</span>
                        <span>
                          <ShieldCheck size={13} />
                          {f.qualification}
                        </span>
                      </div>
                    </Card>
                  ))}
              </section>
            )}
            {view === "activity" && (
              <section className="activity-card">
                <div className="card-header">
                  <div>
                    <h2>Network activity</h2>
                    <p>Your demo decisions are saved in this browser.</p>
                  </div>
                  <span className="tag neutral">{events.length} events</span>
                </div>
                {events.length ? (
                  events.map((event) => (
                    <div className="activity-item" key={event.id}>
                      <span className="event-icon">
                        <Activity size={18} />
                      </span>
                      <div>
                        <strong>{event.text}</strong>
                        <p>{event.detail}</p>
                      </div>
                      <time>
                        {new Date(event.time).toLocaleTimeString("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <Activity size={30} />
                    <h3>No planning activity yet</h3>
                    <p>
                      Confirm a production plan or simulate a capacity change to
                      see it here.
                    </p>
                    <Button
                      variant="default"
                      className="h-11"
                      onClick={() => nav("overview")}
                    >
                      Open route planner
                      <ArrowRight size={15} />
                    </Button>
                  </div>
                )}
              </section>
            )}
            <footer className="page-footer">
              Synthetic factories, costs and forecasts. Decisions are saved in
              this browser.
            </footer>
          </section>
        </div>
        <AssistantDrawer
          open={assistant}
          key={`${orderId}:${order.quantity}:${order.dueHours}:${disrupted}`}
          order={order}
          plans={plans}
          factories={currentFactories}
          selectedPlanId={planId}
          onSelect={(id) => {
            setPlanId(id)
            setView("overview")
            setToast(
              "Copilot suggestion selected. Review the route before confirming."
            )
          }}
          onClose={() => setAssistant(false)}
        />
        <Dialog open={confirm} onOpenChange={setConfirm}>
          <DialogContent
            className="forma-app max-h-[90dvh] overflow-y-auto sm:max-w-lg"
            showCloseButton={false}
            finalFocus={isCurrent ? plannerRef : undefined}
          >
            <DialogHeader>
              <DialogTitle>Review plan for {order.id}</DialogTitle>
              <DialogDescription>
                Confirm the {plan.name.toLowerCase()} plan for {order.quantity}{" "}
                {order.name.toLowerCase()}s.
              </DialogDescription>
            </DialogHeader>
            <DialogClose
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-3 right-3 size-11"
                  aria-label="Close plan review"
                />
              }
            >
              <X />
            </DialogClose>
            <div className="confirm-route">
              {plan.legs.slice(0, 2).map((l) => (
                <span key={l.partId}>{siteById(l.factoryId).city}</span>
              ))}
              <ArrowRight size={15} />
              <strong>{siteById(plan.assemblyId).city}</strong>
              <ArrowRight size={15} />
              <span>Berlin</span>
            </div>
            <div className="cost-breakdown">
              <div>
                <span>Production & purchased components</span>
                <strong>{money(plan.productionCost)}</strong>
              </div>
              <div>
                <span>Assembly</span>
                <strong>{money(plan.assemblyCost)}</strong>
              </div>
              <div>
                <span>Transport · {plan.legs.length + 1} legs</span>
                <strong>{money(plan.transportCost)}</strong>
              </div>
              <div className="cost-total">
                <span>Total plan cost</span>
                <strong>{money(plan.totalCost)}</strong>
              </div>
            </div>
            <div
              className={`arrival-callout ${plan.bufferHours < 0 ? "late" : ""}`}
            >
              <Clock3 size={20} />
              <div>
                <strong>{arrivalLabel(plan.etaHours)}</strong>
                <span>
                  {plan.bufferHours >= 0
                    ? `${plan.bufferHours} hours ahead of the delivery target`
                    : `${-plan.bufferHours} hours after the delivery target`}
                </span>
              </div>
            </div>
            {plan.bufferHours < 0 && (
              <label className="late-consent">
                <Checkbox
                  checked={lateConsent}
                  onCheckedChange={setLateConsent}
                />
                I understand this plan misses the deadline and keeps the order
                flagged.
              </label>
            )}
            <DialogFooter>
              <DialogClose
                render={<Button variant="outline" className="h-11" />}
              >
                Cancel
              </DialogClose>
              <Button
                variant="default"
                className="h-11"
                disabled={
                  !plan.feasible || (plan.bufferHours < 0 && !lateConsent)
                }
                onClick={assign}
              >
                Confirm production plan
                <Check size={17} />
              </Button>
            </DialogFooter>
            <p className="text-xs text-muted-foreground">
              Demo action only. No factories are contacted or orders placed.
            </p>
          </DialogContent>
        </Dialog>
        <Dialog open={settings} onOpenChange={setSettings}>
          <DialogContent
            className="forma-app sm:max-w-lg"
            showCloseButton={false}
          >
            <DialogClose
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-3 right-3 size-11"
                  aria-label="Close settings"
                />
              }
            >
              <X />
            </DialogClose>
            <DialogHeader>
              <DialogTitle>Demo workspace settings</DialogTitle>
              <DialogDescription>
                Plans account for compatibility, queues, transport and assembly
                dependencies.
              </DialogDescription>
            </DialogHeader>
            <dl className="settings-details">
              <div>
                <dt>Network</dt>
                <dd>6 print centers · 2 assembly hubs</dd>
              </div>
              <div>
                <dt>Planning clock</dt>
                <dd>27 Oct 2026 · 08:00 CET</dd>
              </div>
              <div>
                <dt>Forecast</dt>
                <dd>Illustrative, not calibrated</dd>
              </div>
              <div>
                <dt>Storage</dt>
                <dd>This browser only</dd>
              </div>
            </dl>
            <Button variant="outline" className="h-11" onClick={reset}>
              <RotateCcw size={16} />
              Reset demo workspace
            </Button>
            <p className="text-xs text-muted-foreground">
              Resets your demo assignments, scenarios, disruptions and activity.
            </p>
          </DialogContent>
        </Dialog>
        {toast && (
          <div className="toast" role="status">
            <CircleCheck size={19} />
            <span>{toast}</span>
            <Button
              variant="ghost"
              aria-label="Dismiss notification"
              onClick={() => setToast("")}
            >
              <X size={15} />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
function Timeline({ plan }: { plan: Plan }) {
  const max = Math.max(plan.deadlineHours, plan.etaHours) + 6
  return (
    <div className="timeline">
      {!plan.feasible && (
        <p className="infeasible-note">
          Illustrative timing only. This route cannot be scheduled because it
          exceeds the available capacity.
        </p>
      )}
      <div className="timeline-note">
        <Clock3 size={15} />
        Assembly begins only when every component has arrived.{" "}
        <span>Hours from demo start</span>
      </div>
      {plan.legs.map((leg) => (
        <div className="timeline-row" key={leg.partId}>
          <span>{parts.find((p) => p.id === leg.partId)!.name}</span>
          <div className="timeline-track">
            <div
              className="timeline-production"
              style={{ width: `${(leg.readyHours / max) * 100}%` }}
            >
              {leg.readyHours}h ready
            </div>
            <div
              className="timeline-shipping"
              style={{ width: `${(leg.transportHours / max) * 100}%` }}
              title={`${leg.transportHours}h transport`}
            >
              <Truck size={12} />
            </div>
            <i
              className="deadline-marker"
              style={{ left: `${(plan.deadlineHours / max) * 100}%` }}
            />
          </div>
          <strong>{leg.arrivalHours}h</strong>
        </div>
      ))}
      <div className="timeline-row">
        <span>Assembly & delivery</span>
        <div className="timeline-track">
          <div
            className="timeline-assembly"
            style={{
              marginLeft: `${(plan.assemblyStart / max) * 100}%`,
              width: `${(plan.assemblyHours / max) * 100}%`,
            }}
          >
            {plan.assemblyHours}h
          </div>
          <div
            className="timeline-final"
            style={{ width: `${(plan.finalTransportHours / max) * 100}%` }}
          >
            <Truck size={12} />
          </div>
          <i
            className="deadline-marker"
            style={{ left: `${(plan.deadlineHours / max) * 100}%` }}
          />
        </div>
        <strong>{plan.etaHours}h</strong>
      </div>
      <div className="timeline-scale">
        <span>0h</span>
        <span>Target: {plan.deadlineHours}h · dashed line</span>
      </div>
    </div>
  )
}
