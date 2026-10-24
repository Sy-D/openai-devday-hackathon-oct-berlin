"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowUpRight,
  CircleAlert,
  Globe2,
  History,
  Radio,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react"
import { AppShell } from "@/components/dashboard/app-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { LiveIncident, LiveSourceStatus } from "@/src/lib/live-incidents"
import {
  formatIncidentTime,
  isCurrentIncident,
  kindLabels,
  sortIncidents,
  sourceNames,
  statusLabels,
} from "./incident-data"
import {
  ConnectionStatus,
  IncidentCard,
  SourceState,
} from "./incident-primitives"
import { useLiveIncidents } from "./use-live-incidents"
import styles from "./incidents.module.css"

type Filters = {
  search: string
  source: string
  kind: string
  severity: string
  status: string
  country: string
}
const emptyFilters: Filters = {
  search: "",
  source: "all",
  kind: "all",
  severity: "all",
  status: "all",
  country: "all",
}
const filterKeys = [
  "search",
  "source",
  "kind",
  "severity",
  "status",
  "country",
] satisfies (keyof Filters)[]
const currentStatuses = [
  "active",
  "scheduled",
  "unknown",
] satisfies LiveIncident["status"][]
const historicalStatuses = [
  "resolved",
  "historical",
] satisfies LiveIncident["status"][]
const PAGE_SIZE = 30
const severityOptions = ["critical", "high", "medium", "low", "unknown"].map(
  (value) => ({
    value,
    label:
      value === "unknown"
        ? "Not supplied"
        : value[0].toUpperCase() + value.slice(1),
  })
)
const kinds = Object.entries(kindLabels).map(([value, label]) => ({
  value,
  label,
}))
const sources = Object.entries(sourceNames).map(([value, label]) => ({
  value,
  label,
}))

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  const items = [
    { value: "all", label: `All ${label.toLowerCase()}` },
    ...options,
  ]
  return (
    <div className={styles.filterField}>
      <span className={styles.filterLabel}>{label}</span>
      <Select
        items={items}
        value={value}
        onValueChange={(value) => onChange(value ?? "all")}
      >
        <SelectTrigger aria-label={label} className="w-full min-w-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem value={item.value} key={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function SourceCard({ source }: { source: LiveSourceStatus }) {
  const interval =
    source.updateIntervalSeconds >= 60
      ? `${Math.round(source.updateIntervalSeconds / 60)} min`
      : `${source.updateIntervalSeconds} sec`
  return (
    <article className={styles.sourceCard}>
      <div className={styles.sourceHeading}>
        <h3>{source.name}</h3>
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${source.name} website`}
        >
          <ArrowUpRight size={15} aria-hidden />
        </a>
      </div>
      <SourceState state={source.state} />
      <p className={styles.sourceRecords}>
        {source.recordCount.toLocaleString()} records{" "}
        <span>· checked every {interval}</span>
      </p>
      <p className={styles.sourceMessage}>
        {source.message ||
          (source.state === "historical"
            ? "Historical evidence only; excluded from current events."
            : source.state === "live"
              ? "Latest provider records received."
              : "Waiting for a successful provider response.")}
      </p>
      <div className={styles.sourceTimes}>
        <span>
          Checked{" "}
          <time dateTime={source.checkedAt}>
            {formatIncidentTime(source.checkedAt)}
          </time>
        </span>
        <span>
          Last success{" "}
          <time dateTime={source.lastSuccessAt}>
            {formatIncidentTime(source.lastSuccessAt)}
          </time>
        </span>
      </div>
    </article>
  )
}

export function IncidentsDashboard({ componentId }: { componentId?: string }) {
  const { snapshot, connection, error, receivedAt, change } = useLiveIncidents()
  const [view, setView] = useState<"current" | "history">("current")
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const incidents = snapshot?.incidents
  const current = useMemo(
    () => incidents?.filter(isCurrentIncident) ?? [],
    [incidents]
  )
  const historical = useMemo(
    () => incidents?.filter((incident) => !isCurrentIncident(incident)) ?? [],
    [incidents]
  )
  const countries = useMemo(
    () =>
      [
        ...new Set(
          (incidents ?? []).map((incident) => incident.country).filter(Boolean)
        ),
      ]
        .sort()
        .map((value) => ({ value, label: value })),
    [incidents]
  )
  const providerStates = useMemo(
    () => new Map(snapshot?.sources.map((source) => [source.id, source.state])),
    [snapshot?.sources]
  )
  const filtered = useMemo(() => {
    const search = filters.search.trim().toLowerCase()
    return sortIncidents(
      (view === "current" ? current : historical).filter(
        (incident) =>
          (!search ||
            [
              incident.title,
              incident.description,
              incident.location,
              incident.country,
              sourceNames[incident.sourceId],
            ].some((value) => value.toLowerCase().includes(search))) &&
          (filters.source === "all" || incident.sourceId === filters.source) &&
          (filters.kind === "all" || incident.kind === filters.kind) &&
          (filters.severity === "all" ||
            incident.severity === filters.severity) &&
          (filters.status === "all" || incident.status === filters.status) &&
          (filters.country === "all" || incident.country === filters.country)
      )
    )
  }, [view, current, historical, filters])
  const activeFilters = filterKeys
    .map((key) => ({ key, value: filters[key] }))
    .filter(({ key, value }) =>
      key === "search" ? value.trim() : value !== "all"
    )
  const liveSources =
    snapshot?.sources.filter((source) => source.state === "live").length ?? 0
  const currentSources =
    snapshot?.sources.filter((source) => source.id !== "portwatch") ?? []
  const troubledSources = currentSources.filter(
    (source) => source.state === "stale" || source.state === "unavailable"
  )
  const urgent = current.filter(
    (incident) =>
      incident.severity === "critical" || incident.severity === "high"
  ).length
  const statusOptions = (
    view === "current" ? currentStatuses : historicalStatuses
  ).map((value) => ({ value, label: statusLabels[value] }))

  function updateFilter(key: keyof Filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }))
    setVisibleCount(PAGE_SIZE)
  }
  function changeView(value: "current" | "history") {
    setView(value)
    setFilters((current) => ({ ...current, status: "all" }))
    setVisibleCount(PAGE_SIZE)
  }
  function resetFilters() {
    setFilters(emptyFilters)
    setVisibleCount(PAGE_SIZE)
  }
  function filterLabel(key: keyof Filters, value: string) {
    if (key === "search") return `Search: ${value}`
    if (key === "source")
      return sources.find((source) => source.value === value)?.label ?? value
    if (key === "kind")
      return kinds.find((kind) => kind.value === value)?.label ?? value
    if (key === "status")
      return (
        statusOptions.find((status) => status.value === value)?.label ?? value
      )
    if (key === "severity") return `Severity: ${value}`
    return value
  }

  return (
    <AppShell breadcrumb={["Workspace", "Incidents"]}>
      <main
        id="main"
        className={`${styles.page} motion-safe:animate-detail-in`}
      >
        {componentId && (
          <Link
            href={`/planning?component=${encodeURIComponent(componentId)}`}
            className="mb-5 inline-flex text-xs underline underline-offset-4"
          >
            Return to this delivery plan
          </Link>
        )}
        <div className={styles.pageHeader}>
          <div>
            <p className={styles.eyebrow}>
              <Globe2 size={14} aria-hidden /> External intelligence
            </p>
            <h1>Incidents, in focus.</h1>
            <p className={styles.intro}>
              Follow reported hazards and transport restrictions as sources
              update. Inspect the evidence before deciding what affects a
              shipment.
            </p>
          </div>
          <div className={styles.connectionBlock}>
            <ConnectionStatus connection={connection} />
            <span>
              Last received {formatIncidentTime(receivedAt ?? undefined)}
            </span>
          </div>
        </div>

        <div className={styles.metrics} aria-label="Current incident overview">
          <div>
            <span>Current records</span>
            <strong>{snapshot ? current.length.toLocaleString() : "—"}</strong>
            <small>Active, scheduled or status unknown</small>
          </div>
          <div>
            <span>High & critical</span>
            <strong className={urgent ? styles.urgentNumber : undefined}>
              {snapshot ? urgent.toLocaleString() : "—"}
            </strong>
            <small>Provider severity, when supplied</small>
          </div>
          <div>
            <span>Sources current</span>
            <strong>
              {snapshot ? `${liveSources} / ${currentSources.length}` : "—"}
            </strong>
            <small>Historical datasets excluded</small>
          </div>
          <div>
            <span>History</span>
            <strong>
              {snapshot ? historical.length.toLocaleString() : "—"}
            </strong>
            <small>Resolved and historical records</small>
          </div>
        </div>

        {(error ||
          connection === "reconnecting" ||
          connection === "unavailable" ||
          troubledSources.length > 0) && (
          <div className={styles.notice} role="status">
            <CircleAlert size={18} aria-hidden />
            <div>
              <strong>
                {connection === "reconnecting" || connection === "unavailable"
                  ? "Updates are reconnecting."
                  : "Some source coverage is incomplete."}
              </strong>
              <p>
                {error ||
                  (connection !== "connected"
                    ? "The connection retries automatically. Previously received records stay visible; their status may have changed."
                    : `${troubledSources.map((source) => source.name).join(", ")} ${troubledSources.length === 1 ? "is" : "are"} stale or unavailable. This does not mean that there are no incidents.`)}
              </p>
            </div>
          </div>
        )}

        <details className={styles.sourcesPanel}>
          <summary>
            <span>
              <Radio size={16} aria-hidden />
              <strong>Source health & coverage</strong>
              <span className={styles.sourceSummary}>
                {snapshot
                  ? `${liveSources} current${troubledSources.length ? ` · ${troubledSources.length} need attention` : ""}`
                  : "Connecting"}
              </span>
            </span>
            <span className={styles.disclosureLabel}>Inspect sources</span>
          </summary>
          <p className={styles.coverageNote}>
            Coverage includes global natural hazards, selected German and Dutch
            road restrictions, and historical port events. It is not a complete
            global transport feed. A hazard report alone does not confirm that a
            route is closed.
          </p>
          <div className={styles.sourcesGrid}>
            {snapshot?.sources.map((source) => (
              <SourceCard key={source.id} source={source} />
            )) ?? (
              <p className={styles.loadingText}>Requesting source status…</p>
            )}
          </div>
        </details>

        <section
          className={styles.recordsSection}
          aria-label="Incident records"
        >
          <div className={styles.recordsHeader}>
            <div
              className={styles.viewTabs}
              role="group"
              aria-label="Incident timeframe"
            >
              <Button
                variant={view === "current" ? "secondary" : "ghost"}
                aria-pressed={view === "current"}
                onClick={() => changeView("current")}
              >
                <Radio size={14} />
                Current{" "}
                <span className={styles.tabCount}>{current.length}</span>
              </Button>
              <Button
                variant={view === "history" ? "secondary" : "ghost"}
                aria-pressed={view === "history"}
                onClick={() => changeView("history")}
              >
                <History size={14} />
                History{" "}
                <span className={styles.tabCount}>{historical.length}</span>
              </Button>
            </div>
            <span className={styles.providerControl}>
              Statuses come from the provider
            </span>
          </div>

          <div className={styles.filters}>
            <label className={styles.searchField}>
              <span className={styles.filterLabel}>Search incidents</span>
              <span className={styles.searchInput}>
                <Search size={16} aria-hidden />
                <Input
                  value={filters.search}
                  onChange={(event) =>
                    updateFilter("search", event.target.value)
                  }
                  placeholder="Event, location, road or source…"
                  aria-label="Search incidents"
                />
              </span>
            </label>
            <FilterSelect
              label="Sources"
              value={filters.source}
              onChange={(value) => updateFilter("source", value)}
              options={sources}
            />
            <FilterSelect
              label="Kinds"
              value={filters.kind}
              onChange={(value) => updateFilter("kind", value)}
              options={kinds}
            />
            <FilterSelect
              label="Severities"
              value={filters.severity}
              onChange={(value) => updateFilter("severity", value)}
              options={severityOptions}
            />
            <FilterSelect
              label="Statuses"
              value={filters.status}
              onChange={(value) => updateFilter("status", value)}
              options={statusOptions}
            />
            <FilterSelect
              label="Countries / regions"
              value={filters.country}
              onChange={(value) => updateFilter("country", value)}
              options={countries}
            />
          </div>
          {activeFilters.length > 0 && (
            <div className={styles.activeFilters}>
              <SlidersHorizontal size={14} aria-hidden />
              {activeFilters.map(({ key, value }) => (
                <Badge
                  variant="outline"
                  key={key}
                  className={styles.filterBadge}
                >
                  {filterLabel(key, value)}
                  <button
                    type="button"
                    aria-label={`Remove ${key} filter`}
                    onClick={() =>
                      updateFilter(key, key === "search" ? "" : "all")
                    }
                  >
                    <X size={12} aria-hidden />
                  </button>
                </Badge>
              ))}
              <Button variant="ghost" size="xs" onClick={resetFilters}>
                Reset filters
              </Button>
            </div>
          )}
          <div className={styles.resultSummary}>
            <p>
              {snapshot
                ? `${filtered.length.toLocaleString()} ${view === "current" ? "current" : "historical / resolved"} records${activeFilters.length ? " match your filters" : ""}`
                : "Loading source-reported incidents…"}
            </p>
            <span>Latest source update / fetch first · times in UTC</span>
          </div>
          <p
            className="sr-only"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {change
              ? `${change.added} new records and ${change.updated} updated records received.`
              : ""}
          </p>
          {view === "history" && (
            <p className={styles.historyNote}>
              These records provide context. They are not counted as current
              incidents or evidence of an ongoing restriction.
            </p>
          )}
          {!snapshot ? (
            <div
              className={styles.emptyState}
              aria-busy={
                connection === "connecting" || connection === "connected"
              }
            >
              <Radio size={28} aria-hidden className={styles.emptyIcon} />
              <h2>
                {connection === "unavailable"
                  ? "The incident service is unavailable"
                  : "Connecting to the incident sources"}
              </h2>
              <p>
                {connection === "unavailable"
                  ? "No verified snapshot has arrived. The connection retries automatically; missing records do not confirm that routes are clear."
                  : "Provider records and their freshness will appear here when verified. This can take a moment on the first request."}
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className={styles.emptyState}>
              <Search size={28} aria-hidden className={styles.emptyIcon} />
              <h2>
                {activeFilters.length
                  ? "No records match these filters"
                  : troubledSources.length
                    ? "No records available in this view"
                    : "No records reported in this view"}
              </h2>
              <p>
                {activeFilters.length
                  ? "Try another location, source or severity. Resetting filters leaves every incident unchanged."
                  : troubledSources.length
                    ? "Some sources are unavailable or stale. Check source health above; this is not confirmation that routes are clear."
                    : "New reports will appear automatically. Coverage is limited to the connected sources."}
              </p>
              {activeFilters.length > 0 && (
                <Button variant="outline" onClick={resetFilters}>
                  Reset filters
                </Button>
              )}
            </div>
          ) : (
            <div className={styles.incidentList}>
              {filtered.slice(0, visibleCount).map((incident) => (
                <IncidentCard
                  key={incident.id}
                  incident={incident}
                  sourceState={providerStates.get(incident.sourceId)}
                />
              ))}
            </div>
          )}
          {filtered.length > visibleCount && (
            <div className={styles.loadMore}>
              <Button
                variant="outline"
                onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
              >
                Show {Math.min(PAGE_SIZE, filtered.length - visibleCount)} more
                records
              </Button>
              <span>
                {visibleCount} of {filtered.length.toLocaleString()} shown
              </span>
            </div>
          )}
        </section>
        <p className={styles.pageFootnote}>
          Reports update automatically. Provider status and timestamps are
          preserved; FORMA does not mark incidents resolved or infer supplier
          delays from a nearby event.
        </p>
      </main>
    </AppShell>
  )
}
