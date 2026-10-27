import { expect, test } from "@playwright/test"
import { z } from "zod"
import { draftKey, parseSavedDraft } from "../components/procurement/plan-state"
import type { IncidentSnapshot, LiveIncident } from "../src/lib/live-incidents"
import type { RoadRoute, RoadRouteResponse } from "../src/lib/procurement"

declare global {
  interface Window {
    procurementTestStream?: EventTarget
  }
}
const timestamp = new Date().toISOString()
const updatedTimestamp = new Date(Date.parse(timestamp) + 60_000).toISOString()
const baseline: RoadRoute = {
  id: "test-baseline",
  label: "Baseline road route",
  distanceKm: 267.4,
  durationSeconds: 10080,
  avoidance: false,
  coordinates: [
    [10.213583, 53.5411468],
    [12.7, 52.91],
    [12.74, 52.9],
    [12.78, 52.89],
    [13.2376192, 52.5375121],
  ],
}
const alternative: RoadRoute = {
  id: "test-avoidance",
  label: "Avoidance road route",
  distanceKm: 281.8,
  durationSeconds: 11220,
  avoidance: true,
  coordinates: [
    [10.213583, 53.5411468],
    [10.25, 52.45],
    [11.5, 52.48],
    [13.2376192, 52.5375121],
  ],
}
const report: LiveIncident = {
  id: "autobahn:delay-test",
  sourceId: "autobahn",
  providerId: "delay-test",
  title: "Reported A24 traffic delay",
  description: "Provider-reported traffic delay on the eastbound stretch.",
  kind: "road",
  severity: "unknown",
  status: "active",
  country: "Germany",
  location: "A24 eastbound",
  coordinates: [12.74, 52.9],
  geometry: {
    type: "LineString",
    coordinates: [
      [12.7, 52.91],
      [12.74, 52.9],
      [12.78, 52.89],
    ],
  },
  roadImpact: { road: "A24", scope: "traffic-warning", restriction: "warning" },
  reportedDelayMinutes: 20,
  fetchedAt: timestamp,
  updatedAt: timestamp,
  url: "https://verkehr.autobahn.de/",
  evidence: "reported-restriction",
}
const snapshot: IncidentSnapshot = {
  version: 1,
  revision: "test-first",
  generatedAt: timestamp,
  incidents: [report],
  sources: [
    {
      id: "autobahn",
      name: "Autobahn",
      state: "live",
      checkedAt: timestamp,
      lastSuccessAt: timestamp,
      recordCount: 1,
      updateIntervalSeconds: 60,
      url: "https://verkehr.autobahn.de/",
    },
  ],
}
const routing: RoadRouteResponse = {
  version: 1,
  routes: [baseline],
  fetchedAt: timestamp,
  provider: "Test routing fixture",
  attribution: "Test fixture only",
  sourceUrl: "https://valhalla.openstreetmap.de/",
  exclusions: [],
  warnings: [],
}
const requestSchema = z.object({
  origin: z.array(z.number()).length(2),
  destination: z.array(z.number()).length(2),
  exclude: z.array(z.array(z.number())).optional(),
  excludePaths: z.array(z.array(z.array(z.number()))).optional(),
})

test.beforeEach(async ({ page }) => {
  await page.route(/\/api\/incidents$/, (route) =>
    route.fulfill({ json: snapshot })
  )
  await page.addInitScript(() => {
    class TestStream extends EventTarget {
      onopen: (() => void) | null = null
      onerror: (() => void) | null = null
      close() {}
      constructor() {
        super()
        window.procurementTestStream = this
        setTimeout(() => this.onopen?.(), 0)
      }
    }
    Object.defineProperty(window, "EventSource", { value: TestStream })
  })
  await page.route(/\/api\/routes$/, (route) => {
    const body = requestSchema.parse(route.request().postDataJSON())
    const avoiding =
      (body.excludePaths?.length ?? 0) > 0 || (body.exclude?.length ?? 0) > 0
    return route.fulfill({
      json: {
        ...routing,
        routes: avoiding ? [baseline, alternative] : [baseline],
      },
    })
  })
})

test("sourced product to real route decision persists and relevant updates reopen review", async ({
  page,
}) => {
  await page.goto("/?component=optics")
  await page
    .getByRole("link", { name: "Plan this delivery", exact: true })
    .click()
  await expect(page).toHaveURL(/\/planning\?component=optics/)
  await expect(
    page.getByRole("heading", { name: "Plan a delivery." })
  ).toBeVisible()
  await expect(
    page.getByLabel("Delivery deadline", { exact: true })
  ).toHaveValue("")
  await expect(
    page.getByText("SKU MMA4Z00-NS400 / 980-9I51S-00NS00", { exact: true })
  ).toBeVisible()
  await expect(page.getByText("€1,483.28", { exact: false })).toBeVisible()
  await page
    .getByRole("button", { name: "Calculate road routes", exact: true })
    .click()
  await expect(
    page.getByRole("heading", {
      name: "Reported A24 traffic delay",
      exact: true,
    })
  ).toBeVisible()
  await expect(
    page.getByText("20 min reported delay", { exact: true })
  ).toBeVisible()
  const avoidanceRequest = page.waitForRequest(
    (request) =>
      request.url().endsWith("/api/routes") && request.method() === "POST"
  )
  await page
    .getByRole("button", { name: "Avoid reported area", exact: true })
    .click()
  const body = requestSchema.parse((await avoidanceRequest).postDataJSON())
  expect(body.excludePaths).toEqual([report.geometry?.coordinates])
  const chosen = page.getByRole("button", {
    name: /Avoidance candidate.*281\.8 km/,
  })
  await expect(chosen).toHaveAttribute("aria-pressed", "true")
  await page
    .getByRole("button", { name: "Apply route decision", exact: true })
    .click()
  await expect(
    page.getByRole("region", { name: "Saved delivery action" })
  ).toContainText("Saved delivery decision")
  await page
    .getByRole("button", { name: /Original road route.*267\.4 km/ })
    .click()
  await expect(
    page.getByRole("region", { name: "Saved delivery action" })
  ).toContainText("Saved decision needs review")
  await chosen.click()
  await expect(
    page.getByRole("region", { name: "Saved delivery action" })
  ).toContainText("Saved delivery decision")
  await page.reload()
  await expect(chosen).toHaveAttribute("aria-pressed", "true")
  await page
    .getByRole("link", { name: "Back to this part", exact: true })
    .click()
  await expect(
    page.getByRole("button", {
      name: "Inspect Optical interconnects: Delivery reviewed",
      exact: true,
    })
  ).toHaveAttribute("data-status", "on-track")
  await page
    .getByRole("link", { name: "Plan this delivery", exact: true })
    .click()
  await expect(
    page.getByLabel("Delivery deadline", { exact: true })
  ).toHaveValue("")
  await page
    .getByRole("link", { name: "All source reports", exact: true })
    .click()
  await expect(page).toHaveURL(/\/incidents\?component=optics/)
  await page
    .getByRole("link", { name: "Return to this delivery plan", exact: true })
    .click()
  await expect(chosen).toHaveAttribute("aria-pressed", "true")
  const changed: IncidentSnapshot = {
    ...snapshot,
    revision: "test-changed",
    generatedAt: updatedTimestamp,
    incidents: [
      report,
      {
        ...report,
        id: "autobahn:new-report",
        providerId: "new-report",
        title: "New report on chosen route",
        coordinates: [11.5, 52.48],
        geometry: undefined,
        reportedDelayMinutes: undefined,
        updatedAt: updatedTimestamp,
      },
    ],
  }
  await page.evaluate((payload) => {
    const stream = window.procurementTestStream
    if (!stream) throw new Error("Test stream is not connected")
    stream.dispatchEvent(
      new MessageEvent("snapshot", { data: JSON.stringify(payload) })
    )
  }, changed)
  await expect(
    page.getByRole("region", { name: "Saved delivery action" })
  ).toContainText("Saved decision needs review")
  await expect(
    page.getByRole("heading", {
      name: "Previously saved decision",
      exact: true,
    })
  ).toBeVisible()
  await page
    .getByRole("link", { name: "Back to this part", exact: true })
    .click()
  await expect(
    page.getByRole("button", {
      name: "Inspect Optical interconnects: Review delivery",
      exact: true,
    })
  ).toHaveAttribute("data-status", "blocked")
})

test("routing outage does not invent a route or permit a saved decision", async ({
  page,
}) => {
  await page.route(/\/api\/routes$/, (route) =>
    route.fulfill({ status: 503, json: { error: "Unavailable" } })
  )
  await page.goto("/planning?component=optics")
  await page
    .getByRole("button", { name: "Calculate road routes", exact: true })
    .click()
  await expect(
    page.getByRole("alert").filter({ hasText: "routing service" })
  ).toContainText("routing service could not calculate")
  await expect(
    page.getByRole("button", { name: "Apply route decision", exact: true })
  ).toHaveCount(0)
  await expect(
    page.getByRole("button", { name: /Original road route/ })
  ).toHaveCount(0)
})

test("delivery workspace fits320px and legacy mode cannot expose simulated controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await page.goto("/planning?component=optics")
  await page
    .getByRole("button", { name: "Calculate road routes", exact: true })
    .click()
  await expect(
    page.getByRole("button", { name: /Original road route/ })
  ).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true)
  await page.goto("/?mode=demo")
  await expect(
    page.getByRole("region", { name: "Delivery actions" })
  ).toBeVisible()
  await expect(
    page.getByRole("button", {
      name: /Pause feed|Clear scenario|Reset disruption|Apply scenario/i,
    })
  ).toHaveCount(0)
  await expect(page.getByRole("link", { name: /rehearsal/i })).toHaveCount(0)
})

test("changed route endpoints disable avoidance until a fresh baseline is calculated", async ({
  page,
}) => {
  let calls = 0
  await page.route(/\/api\/routes$/, (route) => {
    calls += 1
    const changed = calls > 1
    return route.fulfill({
      json: {
        ...routing,
        routes: [
          {
            ...baseline,
            id: changed ? "new-endpoint-route" : baseline.id,
            distanceKm: changed ? 302 : baseline.distanceKm,
          },
        ],
      },
    })
  })
  await page.goto("/planning?component=optics")
  await page
    .getByRole("button", { name: "Calculate road routes", exact: true })
    .click()
  const avoid = page.getByRole("button", {
    name: "Avoid reported area",
    exact: true,
  })
  await expect(avoid).toBeEnabled()
  await page
    .getByText("Advanced destination location details", { exact: true })
    .click()
  await page.getByLabel("Destination longitude", { exact: true }).fill("13.4")
  await expect(avoid).toBeDisabled()
  await page
    .getByRole("button", { name: "Calculate road routes", exact: true })
    .click()
  await expect(
    page.getByRole("button", { name: /Original road route.*302.0 km/ })
  ).toHaveAttribute("aria-pressed", "true")
  await expect(
    page.getByRole("button", { name: /Original road route.*267.4 km/ })
  ).toHaveCount(0)
})

test("a route response for locations edited during the request is discarded", async ({
  page,
}) => {
  let release = () => {}
  const waitForRelease = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route(/\/api\/routes$/, async (route) => {
    await waitForRelease
    await route.fulfill({ json: routing })
  })
  await page.goto("/planning?component=optics")
  const request = page.waitForRequest((request) =>
    request.url().endsWith("/api/routes")
  )
  await page
    .getByRole("button", { name: "Calculate road routes", exact: true })
    .click()
  await request
  await page
    .getByText("Advanced destination location details", { exact: true })
    .click()
  await page.getByLabel("Destination longitude", { exact: true }).fill("13.4")
  release()
  await expect(
    page.getByRole("alert").filter({ hasText: "changed during calculation" })
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: /Original road route/ })
  ).toHaveCount(0)
})

test("address search selects named endpoints and component picker retains navigation", async ({
  page,
}) => {
  await page.route(/\/api\/places\?/, (route) =>
    route.fulfill({
      json: {
        places: [
          {
            id: "berlin-site",
            label: "Berlin Hauptbahnhof, Europaplatz 1, Berlin",
            coordinates: [13.3694, 52.5251],
            kind: "railway station",
          },
        ],
        attribution: "OpenStreetMap",
        sourceUrl: "https://www.openstreetmap.org/copyright",
      },
    })
  )
  await page.goto("/planning?component=optics")
  await expect(
    page.getByLabel("Destination longitude", { exact: true })
  ).not.toBeVisible()
  await page
    .getByLabel("Destination address search", { exact: true })
    .fill("Berlin Hauptbahnhof")
  await page
    .getByRole("button", { name: "Search destination locations", exact: true })
    .click()
  await page
    .getByRole("button", { name: /Berlin Hauptbahnhof, Europaplatz 1, Berlin/ })
    .click()
  await expect(
    page.getByLabel("Selected destination location", { exact: true })
  ).toContainText("Berlin Hauptbahnhof")
  const request = page.waitForRequest((request) =>
    request.url().endsWith("/api/routes")
  )
  await page
    .getByRole("button", { name: "Calculate road routes", exact: true })
    .click()
  const body = requestSchema.parse((await request).postDataJSON())
  expect(body.destination).toEqual([13.3694, 52.5251])
  await page
    .getByRole("combobox", { name: "Component to plan", exact: true })
    .click()
  await page.getByRole("option", { name: /CoolChip CDU 600/ }).click()
  await expect(page).toHaveURL(/component=cooling/)
})

test("previous saved decisions require explicit apply and reopening preserves their history", async ({
  page,
}) => {
  await page.goto("/planning?component=optics")
  await page
    .getByRole("button", { name: "Calculate road routes", exact: true })
    .click()
  await page
    .getByRole("button", { name: "Apply route decision", exact: true })
    .click()
  const raw = await page.evaluate(
    (key) => localStorage.getItem(key),
    draftKey("optics")
  )
  const draft = parseSavedDraft(raw, "optics")
  if (!draft?.saved)
    throw new Error("Expected an applied decision for migration coverage")
  expect(draft.saved.reviewVersion).toBe(2)
  const savedRoute = draft.saved.route
  const savedAt = draft.saved.savedAt
  delete draft.saved.reviewVersion
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
    key: draftKey("optics"),
    value: JSON.stringify(draft),
  })
  await page.reload()
  await expect(
    page.getByRole("region", { name: "Saved delivery action" })
  ).toContainText("Saved decision needs review")
  await expect(
    page.getByRole("heading", {
      name: "Previously saved decision",
      exact: true,
    })
  ).toBeVisible()
  await page
    .getByRole("link", { name: "Back to this part", exact: true })
    .click()
  await expect(
    page.getByRole("button", {
      name: "Inspect Optical interconnects: Review delivery",
      exact: true,
    })
  ).toHaveAttribute("data-status", "blocked")
  await page
    .getByRole("link", { name: "Plan this delivery", exact: true })
    .click()
  await page
    .getByRole("button", { name: "Apply updated decision", exact: true })
    .click()
  await expect(
    page.getByRole("region", { name: "Saved delivery action" })
  ).toContainText("Saved delivery decision")
  await page
    .getByRole("button", { name: "Reopen for review", exact: true })
    .click()
  await expect(
    page.getByRole("region", { name: "Saved delivery action" })
  ).toContainText("Saved decision needs review")
  await page.reload()
  const reopened = parseSavedDraft(
    await page.evaluate((key) => localStorage.getItem(key), draftKey("optics")),
    "optics"
  )
  expect(reopened?.saved?.reviewVersion).toBe(1)
  expect(reopened?.saved?.route).toEqual(savedRoute)
  expect(Date.parse(reopened?.saved?.savedAt ?? "")).toBeGreaterThanOrEqual(
    Date.parse(savedAt)
  )
  await expect(
    page.getByRole("button", { name: "Apply updated decision", exact: true })
  ).toBeEnabled()
})
