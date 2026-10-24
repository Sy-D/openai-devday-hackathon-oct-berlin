"use client"

import Link from "next/link"
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react"
import { NumberFlowGroup } from "@number-flow/react"
import { MetalFx } from "metal-fx"
import { useTheme } from "next-themes"
import type { BorderBeamColorVariant } from "border-beam"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AppShell } from "./app-shell"
import { RiskLandscape } from "@/components/dashboard/risk-landscape"
import { RiskBadge } from "@/components/dashboard/risk-badge"
import { CommandSearch } from "./command-search"
import { ChatDock } from "./chat-dock"
import { Toaster } from "sonner"
import {
  AnimatedNumber,
  deliveryFormat,
  exposureFormat,
} from "./animated-number"
import { SupplierSearch } from "./supplier-search"
import { SupplierDetail } from "./supplier-detail"
import { RiskBar } from "./risk-bar"
import {
  SupplierFiltersControl,
  defaultFilters,
  filtersActive,
  matchesFilters,
} from "./supplier-filters"
import type { Supplier } from "@/lib/supplier-data"

const featuredIds = ["SUPP_00731", "SUPP_00012", "SUPP_00450", "SUPP_00018"]
const riskItems = ["All risk levels", "Low", "Medium", "High", "Critical"]
type SortKey = "name" | "risk" | "level" | "delivery" | "exposure"
type SortState = { key: SortKey; direction: "asc" | "desc" } | null
const pageSize = 8

export function SupplierDashboard({
  suppliers,
}: {
  suppliers: Supplier[]
}) {
  const [search, setSearch] = useState("")
  const query = useDeferredValue(search.trim().toLowerCase())
  const [riskFilter, setRiskFilter] = useState("All risk levels")
  // Highest total risk first by default.
  const [sort, setSort] = useState<SortState>({ key: "risk", direction: "desc" })
  const [tableFilters, setTableFilters] = useState(defaultFilters)
  const [chartFilters, setChartFilters] = useState(defaultFilters)
  const [chartSearch, setChartSearch] = useState("")
  const chartQuery = useDeferredValue(chartSearch.trim().toLowerCase())
  const [chartRisk, setChartRisk] = useState("All risk levels")
  const [activeSupplier, setActiveSupplier] = useState<Supplier | null>(null)
  const [analystHover, setAnalystHover] = useState(false)
  // True on the client, false during SSR — gates the client-only MetalFx.
  const metalMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
  const [page, setPage] = useState(0)
  const [selectedIds, setSelectedIds] = useState(() => new Set<string>())
  const [notice, setNotice] = useState("")
  const [overlaySeed, setOverlaySeed] = useState<string | null>(null)
  const [chatSeed, setChatSeed] = useState<string | null>(null)
  const { resolvedTheme } = useTheme()
  useEffect(() => {
    function onType(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOverlaySeed("")
        return
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key.length !== 1) return
      const target = event.target
      if (
        target instanceof HTMLElement &&
        target.closest(
          "input, textarea, select, [contenteditable=true], [role=dialog]"
        )
      )
        return
      if (overlaySeed !== null || chatSeed !== null) return
      event.preventDefault()
      setOverlaySeed(event.key)
    }
    document.addEventListener("keydown", onType)
    return () => document.removeEventListener("keydown", onType)
  }, [overlaySeed, chatSeed])

  const filtered = useMemo(
    () =>
      suppliers.filter(
        (s) =>
          matchesFilters(s, tableFilters) &&
          (riskFilter === "All risk levels" || s.level === riskFilter) &&
          (!query ||
            s.id.toLowerCase().includes(query) ||
            s.name.toLowerCase().includes(query))
      ),
    [suppliers, query, riskFilter, tableFilters]
  )
  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        if (sort) {
          const comparison =
            sort.key === "name"
              ? a.name.localeCompare(b.name)
              : sort.key === "level"
                ? a.risk - b.risk
                : a[sort.key] - b[sort.key]
          return (
            (sort.direction === "asc" ? comparison : -comparison) ||
            a.id.localeCompare(b.id)
          )
        }
        const aIndex = featuredIds.indexOf(a.id)
        const bIndex = featuredIds.indexOf(b.id)
        return (
          (aIndex < 0 ? featuredIds.length : aIndex) -
            (bIndex < 0 ? featuredIds.length : bIndex) ||
          a.id.localeCompare(b.id)
        )
      }),
    [filtered, sort]
  )
  const selected = useMemo(
    () => suppliers.filter((s) => selectedIds.has(s.id)),
    [suppliers, selectedIds]
  )
  const chartBase = selected.length ? selected : filtered
  const chartSuppliers = useMemo(
    () =>
      chartBase.filter(
        (s) =>
          matchesFilters(s, chartFilters) &&
          (chartRisk === "All risk levels" || s.level === chartRisk) &&
          (!chartQuery ||
            `${s.id} ${s.name}`.toLowerCase().includes(chartQuery))
      ),
    [chartBase, chartFilters, chartRisk, chartQuery]
  )
  const summary = useMemo(() => {
    const totals = chartSuppliers.reduce(
      (acc, s) => ({
        risk: acc.risk + s.risk,
        flagged:
          acc.flagged + (s.level === "High" || s.level === "Critical" ? 1 : 0),
        exposure: acc.exposure + s.exposure,
      }),
      { risk: 0, flagged: 0, exposure: 0 }
    )
    return {
      count: chartSuppliers.length,
      average: chartSuppliers.length ? totals.risk / chartSuppliers.length : 0,
      flagged: totals.flagged,
      exposure: totals.exposure,
    }
  }, [chartSuppliers])
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  const currentPage = Math.min(page, pageCount - 1)
  const visible = sorted.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize
  )
  const hasFilters =
    search !== "" ||
    riskFilter !== "All risk levels" ||
    filtersActive(tableFilters)
  const hasChartFilters =
    chartSearch !== "" ||
    chartRisk !== "All risk levels" ||
    filtersActive(chartFilters)
  function sortColumn(key: SortKey) {
    setSort((previous) => ({
      key,
      direction:
        previous?.key === key && previous.direction === "asc" ? "desc" : "asc",
    }))
    setPage(0)
  }
  function resetTable() {
    setSearch("")
    setRiskFilter("All risk levels")
    setTableFilters(defaultFilters)
    setPage(0)
  }
  function resetChart() {
    setChartSearch("")
    setChartRisk("All risk levels")
    setChartFilters(defaultFilters)
  }

  function selectArea(ids: string[]) {
    setSelectedIds((previous) => {
      const next = new Set(previous)
      let added = 0
      for (const id of ids) {
        if (!next.has(id)) {
          next.add(id)
          added += 1
        }
      }
      setNotice(`${added} suppliers selected from the marked area.`)
      return next
    })
  }

  function toggleSupplier(id: string, checked: boolean) {
    setNotice("")
    setSelectedIds((previous) => {
      const next = new Set(previous)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  return (
    <AppShell
      breadcrumb={["Workspace", "Suppliers"]}
      overlay={
        <>
          <CommandSearch
            open={overlaySeed !== null}
            seed={overlaySeed ?? ""}
            suppliers={suppliers}
            onPick={(supplier) => {
              setActiveSupplier(supplier)
              setOverlaySeed(null)
            }}
            onAsk={(query) => {
              setOverlaySeed(null)
              setChatSeed(query)
            }}
            onClose={() => setOverlaySeed(null)}
          />
          <ChatDock
            open={chatSeed !== null}
            seed={chatSeed ?? ""}
            suppliers={suppliers}
            selected={selected}
            onClose={() => setChatSeed(null)}
            onOpenProfile={setActiveSupplier}
          />
          <Toaster position="bottom-right" />
        </>
      }
    >
          <div
            id="main"
            className="mx-auto flex w-full max-w-[1600px] flex-col gap-7 p-4 sm:p-6 lg:p-8"
          >
            <div className="flex flex-wrap items-center justify-end gap-5">
              {/* MetalFx mounts WebGL only on the client; render the plain
                  button during SSR so hydration does not mismatch. */}
              {metalMounted ? (
                <MetalFx
                  preset="chromatic"
                  theme={resolvedTheme === "light" ? "light" : "dark"}
                  strength={analystHover ? 1 : 0.9}
                  glowGain={analystHover ? 1 : 0.7}
                  scale={1.4}
                  className="cursor-pointer rounded-4xl"
                  onMouseEnter={() => setAnalystHover(true)}
                  onMouseLeave={() => setAnalystHover(false)}
                >
                  <Button
                    size="lg"
                    className="cursor-pointer text-inherit! transition-transform duration-150 active:scale-[0.97]"
                    onClick={() => setChatSeed("")}
                  >
                    <Sparkles data-icon="inline-start" />
                    Ask your analyst
                  </Button>
                </MetalFx>
              ) : (
                <Button size="lg" onClick={() => setChatSeed("")}>
                  <Sparkles data-icon="inline-start" />
                  Ask your analyst
                </Button>
              )}
            </div>
            <NumberFlowGroup>
              <section
                className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
                aria-label="Portfolio facts"
              >
                <MetricCard
                  label="Suppliers in view"
                  value={summary.count}
                  beam="ocean"
                  description={
                    selected.length
                      ? "Selected suppliers · chart filters applied"
                      : hasFilters || hasChartFilters
                        ? `of ${suppliers.length.toLocaleString("en-GB")} in the portfolio`
                        : "Complete portfolio · 46 attributes"
                  }
                />
                <MetricCard
                  label="Average risk index"
                  value={summary.average}
                  beam="forest"
                  decimals={1}
                  suffix=" / 100"
                  description={
                    summary.count ? "Lower is better" : "No matching suppliers"
                  }
                />
                <MetricCard
                  label="High & critical risk"
                  value={summary.flagged}
                  beam="candy"
                  description={
                    <>
                      <AnimatedNumber
                        value={
                          summary.count
                            ? (summary.flagged / summary.count) * 100
                            : 0
                        }
                        format={deliveryFormat}
                        suffix="%"
                      />{" "}
                      of suppliers in view
                    </>
                  }
                />
                <MetricCard
                  label="Purchase order exposure"
                  value={
                    summary.exposure /
                    (summary.exposure >= 1_000_000_000
                      ? 1_000_000_000
                      : summary.exposure >= 1_000_000
                        ? 1_000_000
                        : summary.exposure >= 1000
                          ? 1000
                          : 1)
                  }
                  decimals={2}
                  beam="gold"
                  prefix="€"
                  suffix={
                    summary.exposure >= 1_000_000_000
                      ? "bn"
                      : summary.exposure >= 1_000_000
                        ? "m"
                        : summary.exposure >= 1000
                          ? "k"
                          : ""
                  }
                  description="Total purchase order volume"
                />
              </section>
            </NumberFlowGroup>
            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
              <div className="min-w-0 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>The risk–reliability landscape</CardTitle>
                    <CardDescription>
                      Spot resilient suppliers. Investigate the outliers.
                    </CardDescription>
                    <CardAction>
                      {selected.length > 0 && (
                        <MetalFx
                          preset="silver"
                          theme={
                            resolvedTheme === "light" ? "light" : "dark"
                          }
                          strength={0.85}
                          className="rounded-4xl motion-safe:animate-detail-in"
                        >
                          <Button
                            variant="secondary"
                            size="sm"
                            className="text-inherit!"
                            onClick={() => {
                              setSelectedIds(new Set())
                              setNotice("Selection cleared.")
                            }}
                          >
                            Reset
                          </Button>
                        </MetalFx>
                      )}
                      <Badge
                        variant="secondary"
                        className="hidden font-normal sm:inline-flex"
                      >
                        {selected.length ? (
                        <>
                          <AnimatedNumber value={selected.length} /> selected
                        </>
                      ) : hasFilters ? (
                        "Filtered portfolio"
                      ) : (
                        "Full portfolio"
                      )}
                      </Badge>
                    </CardAction>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="min-w-48 flex-1">
                        <SupplierSearch
                          suppliers={chartBase}
                          value={chartSearch}
                          onChange={setChartSearch}
                          onPick={setActiveSupplier}
                          label="Search chart suppliers"
                        />
                      </div>
                      <Select
                        items={riskItems.map((value) => ({
                          value,
                          label: value,
                        }))}
                        value={chartRisk}
                        onValueChange={(v) =>
                          setChartRisk(v ?? "All risk levels")
                        }
                      >
                        <SelectTrigger
                          aria-label="Chart risk level"
                          className="h-10!"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {riskItems.map((v) => (
                            <SelectItem key={v} value={v}>
                              {v}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {hasChartFilters && (
                        <Button
                          variant="ghost"
                          className="h-10"
                          onClick={resetChart}
                        >
                          Reset chart
                        </Button>
                      )}
                    </div>
                    <SupplierFiltersControl
                      value={chartFilters}
                      onChange={setChartFilters}
                      scope="Chart"
                    />
                    <p className="text-xs text-muted-foreground" role="status">
                      <AnimatedNumber value={chartSuppliers.length} /> shown ·{" "}
                      {selected.length
                        ? "Selected suppliers only. Clear the selection to return to the portfolio."
                        : "Current table results. Select rows below to focus the chart."}
                    </p>
                    <RiskLandscape
                      suppliers={chartSuppliers}
                      activeId={activeSupplier?.id}
                      onSelect={(supplier) =>
                        setActiveSupplier((current) =>
                          current?.id === supplier.id ? null : supplier
                        )
                      }
                      onSelectArea={selectArea}
                    />
                    {chartSuppliers.length === 0 && (
                      <p className="py-4 text-center text-sm text-muted-foreground">
                        No suppliers in this chart. Adjust the chart filters or
                        clear your selection.
                      </p>
                    )}
                  </CardContent>
                </Card>
                <Card id="suppliers" className="scroll-mt-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      Explore suppliers{" "}
                      <Badge variant="secondary" className="font-normal">
                        <AnimatedNumber value={filtered.length} />
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      Filter, rank and select suppliers to focus the chart.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="min-w-52 flex-1">
                        <SupplierSearch
                          suppliers={suppliers}
                          value={search}
                          onChange={(value) => {
                            setSearch(value)
                            setPage(0)
                          }}
                          label="Search supplier name or ID"
                        />
                      </div>
                      <Select
                        items={riskItems.map((item) => ({
                          label: item,
                          value: item,
                        }))}
                        value={riskFilter}
                        onValueChange={(value) => {
                          setRiskFilter(value ?? "All risk levels")
                          setPage(0)
                        }}
                      >
                        <SelectTrigger
                          aria-label="Filter by risk level"
                          className="h-10! min-w-36"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {riskItems.map((item) => (
                            <SelectItem key={item} value={item}>
                              {item}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {hasFilters && (
                        <Button
                          variant="ghost"
                          size="icon-lg"
                          aria-label="Clear filters"
                          onClick={() => {
                            resetTable()
                          }}
                        >
                          <X />
                        </Button>
                      )}
                      {selected.length > 0 && (
                        <Button
                          variant="ghost"
                          className="h-10"
                          onClick={() => {
                            setSelectedIds(new Set())
                            setNotice("")
                          }}
                        >
                          Deselect all
                        </Button>
                      )}
                    </div>
                    <SupplierFiltersControl
                      value={tableFilters}
                      onChange={(value) => {
                        setTableFilters(value)
                        setPage(0)
                      }}
                      scope="Table"
                    />
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10 pl-1">
                            <div className="flex size-10 items-center justify-center">
                            <Checkbox
                              aria-label="Select all suppliers on this page"
                              checked={
                                visible.length > 0 &&
                                visible.every((s) => selectedIds.has(s.id))
                              }
                              indeterminate={
                                !visible.every((s) => selectedIds.has(s.id)) &&
                                visible.some((s) => selectedIds.has(s.id))
                              }
                              onCheckedChange={(checked) => {
                                setNotice("")
                                setSelectedIds((previous) => {
                                  const next = new Set(previous)
                                  if (checked) {
                                    for (const s of visible) {
                                      next.add(s.id)
                                    }
                                  } else {
                                    for (const s of visible) next.delete(s.id)
                                  }
                                  return next
                                })
                              }}
                            />
                            </div>
                          </TableHead>
                          {(
                            [
                              { key: "name", label: "Supplier", numeric: false },
                              { key: "risk", label: "Total risk", numeric: false },
                              { key: "level", label: "Risk level", numeric: false },
                              { key: "delivery", label: "Delivery", numeric: true },
                              { key: "exposure", label: "PO exposure", numeric: true },
                            ] as const
                          ).map((column) => (
                            <TableHead
                              key={column.key}
                              className={column.numeric ? "text-right" : undefined}
                              aria-sort={
                                sort?.key === column.key
                                  ? sort.direction === "asc"
                                    ? "ascending"
                                    : "descending"
                                  : "none"
                              }
                            >
                              <Button
                                variant="ghost"
                                className={`h-10 gap-2 whitespace-nowrap ${column.numeric ? "-mr-3" : "-ml-3"}`}
                                onClick={() => sortColumn(column.key)}
                                aria-label={`Sort by ${column.label}${sort?.key === column.key ? `, currently ${sort.direction === "asc" ? "ascending" : "descending"}` : ""}`}
                              >
                                {column.label}
                                {sort?.key === column.key ? (
                                  sort.direction === "asc" ? (
                                    <ArrowUp className="size-3.5" />
                                  ) : (
                                    <ArrowDown className="size-3.5" />
                                  )
                                ) : (
                                  <ArrowUpDown className="size-3.5 text-muted-foreground" />
                                )}
                              </Button>
                            </TableHead>
                          ))}
                          <TableHead className="w-10">
                            <span className="sr-only">View risk profile</span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visible.map((supplier, index) => (
                          <TableRow
                            key={supplier.id}
                            data-state={
                              selectedIds.has(supplier.id)
                                ? "selected"
                                : undefined
                            }
                            aria-selected={selectedIds.has(supplier.id)}
                            className="cursor-pointer motion-safe:animate-row-in"
                            style={{ animationDelay: `${index * 24}ms` }}
                            onClick={() =>
                              toggleSupplier(
                                supplier.id,
                                !selectedIds.has(supplier.id)
                              )
                            }
                          >
                            <TableCell className="py-4 pl-1">
                              <div
                                className="flex size-10 items-center justify-center"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <Checkbox
                                  aria-label={`Select ${supplier.id}`}
                                  checked={selectedIds.has(supplier.id)}
                                  onCheckedChange={(checked) =>
                                    toggleSupplier(supplier.id, checked)
                                  }
                                />
                              </div>
                            </TableCell>
                            <TableCell className="min-w-44 py-4">
                              <p className="font-medium">{supplier.name}</p>
                              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                                {supplier.id}
                                {supplier.lastModified &&
                                  ` · ${supplier.lastModified.slice(0, 10)}`}
                              </p>
                            </TableCell>
                            <TableCell>
                              <RiskBar value={supplier.risk} enter />
                            </TableCell>
                            <TableCell>
                              <RiskBadge level={supplier.level} />
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {supplier.researched ? (
                                "—"
                              ) : (
                                <AnimatedNumber
                                  value={supplier.delivery}
                                  format={deliveryFormat}
                                  suffix="%"
                                />
                              )}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {supplier.researched ? (
                                "—"
                              ) : (
                                <AnimatedNumber
                                  value={supplier.exposure}
                                  format={exposureFormat}
                                />
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon-lg"
                                nativeButton={false}
                                aria-label={`View ${supplier.id} risk profile`}
                                onClick={(event) => event.stopPropagation()}
                                render={
                                  <Link href={`/supplier/${supplier.id}`} />
                                }
                              >
                                <ArrowUpRight className="size-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {visible.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} className="h-52 text-center">
                              <p className="font-medium">
                                No suppliers match these filters.
                              </p>
                              <p className="mt-2 text-muted-foreground">
                                Try another name, supplier ID or risk level.
                              </p>
                              <Button
                                variant="outline"
                                className="mt-4"
                                onClick={() => {
                                  resetTable()
                                }}
                              >
                                Reset filters
                              </Button>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                  <CardFooter className="flex flex-wrap justify-between gap-3 border-t">
                    <p className="text-xs text-muted-foreground">
                      <AnimatedNumber
                        value={
                          filtered.length ? currentPage * pageSize + 1 : 0
                        }
                      />
                      –
                      <AnimatedNumber
                        value={Math.min(
                          (currentPage + 1) * pageSize,
                          filtered.length
                        )}
                      />{" "}
                      of <AnimatedNumber value={filtered.length} /> suppliers
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon-lg"
                        aria-label="Previous page"
                        disabled={currentPage === 0}
                        onClick={() => setPage(currentPage - 1)}
                      >
                        <ChevronLeft />
                      </Button>
                      <span className="min-w-20 text-center text-xs tabular-nums">
                        Page <AnimatedNumber value={currentPage + 1} /> of{" "}
                        <AnimatedNumber value={pageCount} />
                      </span>
                      <Button
                        variant="outline"
                        size="icon-lg"
                        aria-label="Next page"
                        disabled={currentPage + 1 >= pageCount}
                        onClick={() => setPage(currentPage + 1)}
                      >
                        <ChevronRight />
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              </div>
              <SupplierDetail
                supplier={activeSupplier}
                onClose={() => setActiveSupplier(null)}
                selected={
                  activeSupplier ? selectedIds.has(activeSupplier.id) : false
                }
                onToggle={() => {
                  if (activeSupplier)
                    toggleSupplier(
                      activeSupplier.id,
                      !selectedIds.has(activeSupplier.id)
                    )
                }}
              />
            </div>
            <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
              <Check className="mt-0.5 size-3.5 shrink-0" />
              {hasFilters
                ? "Table filters define the portfolio; cards reflect the visible chart. Selected rows focus the chart."
                : "Source: supplier_risk_dataset.csv."}{" "}
              Risk: 0 = no risk, 100 = maximum risk. Higher delivery ratings are
              better.
            </p>
            {notice && (
              <div
                role="status"
                className="flex items-start justify-between gap-4 rounded-xl border bg-muted p-4 text-sm"
              >
                <p>{notice}</p>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Dismiss notice"
                  onClick={() => setNotice("")}
                >
                  <X />
                </Button>
              </div>
            )}
          </div>
    </AppShell>
  )
}

const auroraColors = {
  colorful: { from: "#38bdf8", to: "#e879f9" },
  mono: { from: "#94a3b8", to: "#e2e8f0" },
  ocean: { from: "#38bdf8", to: "#8b5cf6" },
  sunset: { from: "#f59e0b", to: "#ef4444" },
  forest: { from: "#34d399", to: "#0ea5e9" },
  candy: { from: "#f472b6", to: "#a855f7" },
  ice: { from: "#67e8f9", to: "#38bdf8" },
  gold: { from: "#fbbf24", to: "#fb923c" },
} satisfies Record<BorderBeamColorVariant, { from: string; to: string }>

function MetricCard({
  label,
  value,
  description,
  beam,
  decimals = 0,
  prefix,
  suffix,
}: {
  label: string
  value: number
  description: React.ReactNode
  beam: BorderBeamColorVariant
  decimals?: number
  prefix?: string
  suffix?: string
}) {
  const { from, to } = auroraColors[beam]
  return (
    <div className="group/aurora relative">
      <Card size="sm" className="relative">
      <CardHeader>
        <CardDescription className="text-xs">{label}</CardDescription>
      </CardHeader>
      <CardContent className="-mt-1">
        <div className="flex h-12 items-center text-3xl font-medium tracking-tight tabular-nums">
          <AnimatedNumber
            className="[&::part(suffix)]:text-base [&::part(suffix)]:tracking-normal [&::part(suffix)]:text-muted-foreground"
            value={value}
            locales="en-GB"
            format={{
              minimumFractionDigits: decimals,
              maximumFractionDigits: decimals,
            }}
            prefix={prefix}
            suffix={suffix}
            trend={0}
            spinTiming={{
              duration: 720,
              easing: "cubic-bezier(0.19, 1, 0.22, 1)",
            }}
            transformTiming={{
              duration: 480,
              easing: "cubic-bezier(0.23, 1, 0.32, 1)",
            }}
            respectMotionPreference
          />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </CardContent>
      </Card>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
      >
        <div
          className="absolute -right-24 -bottom-28 size-56 rounded-full opacity-45 blur-2xl transition-all duration-500 ease-out motion-safe:animate-aurora group-hover/aurora:-right-14 group-hover/aurora:-bottom-20 group-hover/aurora:opacity-100"
          style={{
            background: `radial-gradient(closest-side, ${from}, ${to} 45%, transparent 75%)`,
          }}
        />
      </div>
    </div>
  )
}
