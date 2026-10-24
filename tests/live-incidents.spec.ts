import { expect, test } from "@playwright/test"
import type { IncidentSnapshot, LiveIncident } from "../src/lib/live-incidents"

declare global {
  interface Window {
    incidentStream?: EventTarget & { onerror: (() => void) | null }
  }
}

const timestamp = "2026-10-24T12:00:00.000Z"
const road: LiveIncident = {
  id: "autobahn:road-1",
  sourceId: "autobahn",
  providerId: "road-1",
  title: "A2 lane closure near Hannover",
  description: "A provider-reported lane restriction with a signed diversion.",
  kind: "road",
  severity: "high",
  status: "active",
  country: "Germany",
  location: "Hannover",
  fetchedAt: timestamp,
  updatedAt: timestamp,
  url: "https://autobahn.de/",
  evidence: "reported-restriction",
}
const flood: LiveIncident = {
  ...road,
  id: "gdacs:flood-1",
  sourceId: "gdacs",
  providerId: "flood-1",
  title: "Flood report in Taiwan",
  description: "A hazard observation; no route closure has been confirmed.",
  kind: "flood",
  severity: "medium",
  country: "Taiwan",
  location: "Kaohsiung",
  url: "https://gdacs.org/",
  evidence: "hazard",
}
const historic: LiveIncident = {
  ...road,
  id: "portwatch:port-1",
  sourceId: "portwatch",
  providerId: "port-1",
  title: "Historical Rotterdam port disruption",
  kind: "port",
  status: "historical",
  country: "Netherlands",
  location: "Rotterdam",
  url: "https://portwatch.imf.org/",
  evidence: "historical",
}
const fixture: IncidentSnapshot = {
  version: 1,
  revision: "first",
  generatedAt: timestamp,
  incidents: [road, flood, historic],
  sources: [
    {
      id: "gdacs",
      name: "GDACS",
      state: "live",
      checkedAt: timestamp,
      lastSuccessAt: timestamp,
      recordCount: 1,
      updateIntervalSeconds: 300,
      url: "https://gdacs.org/",
    },
    {
      id: "eonet",
      name: "NASA EONET",
      state: "unavailable",
      checkedAt: timestamp,
      recordCount: 0,
      updateIntervalSeconds: 300,
      url: "https://eonet.gsfc.nasa.gov/",
      message: "The provider is temporarily unavailable.",
    },
    {
      id: "autobahn",
      name: "Autobahn Germany",
      state: "live",
      checkedAt: timestamp,
      lastSuccessAt: timestamp,
      recordCount: 1,
      updateIntervalSeconds: 300,
      url: "https://autobahn.de/",
    },
    {
      id: "ndw",
      name: "NDW Netherlands",
      state: "live",
      checkedAt: timestamp,
      lastSuccessAt: timestamp,
      recordCount: 0,
      updateIntervalSeconds: 300,
      url: "https://ndw.nu/",
    },
    {
      id: "portwatch",
      name: "IMF PortWatch",
      state: "historical",
      checkedAt: timestamp,
      lastSuccessAt: timestamp,
      recordCount: 1,
      updateIntervalSeconds: 3600,
      url: "https://portwatch.imf.org/",
    },
  ],
}

test.beforeEach(async ({ page }) => {
  await page.route(/\/api\/incidents$/, (route) =>
    route.fulfill({ json: fixture })
  )
  await page.addInitScript(() => {
    class TestEventSource extends EventTarget {
      onopen: (() => void) | null = null
      onerror: (() => void) | null = null
      close() {}
      constructor() {
        super()
        window.incidentStream = this
        setTimeout(() => this.onopen?.(), 0)
      }
    }
    Object.defineProperty(window, "EventSource", { value: TestEventSource })
  })
})

test("filters live provider records and separates historical evidence", async ({
  page,
}) => {
  await page.goto("/incidents")
  await expect(page.getByRole("heading", { name: road.title })).toBeVisible()
  await expect(page.getByRole("heading", { name: flood.title })).toBeVisible()
  await expect(page.getByRole("heading", { name: historic.title })).toHaveCount(
    0
  )
  await expect(
    page.getByText("Some source coverage is incomplete.")
  ).toBeVisible()
  await expect(
    page.getByRole("button", {
      name: /clear (events|incidents)|reset scenario|resolve incident|simulate/i,
    })
  ).toHaveCount(0)
  await page.getByRole("combobox", { name: "Sources", exact: true }).click()
  await page.getByRole("option", { name: "GDACS", exact: true }).click()
  await expect(page.getByRole("heading", { name: flood.title })).toBeVisible()
  await expect(page.getByRole("heading", { name: road.title })).toHaveCount(0)
  await page.getByRole("button", { name: "Reset filters", exact: true }).click()
  await page.getByRole("textbox", { name: "Search incidents" }).fill("Hannover")
  await expect(page.getByRole("heading", { name: road.title })).toBeVisible()
  await expect(page.getByRole("heading", { name: flood.title })).toHaveCount(0)
  await page.getByRole("button", { name: "Reset filters", exact: true }).click()
  await page.getByRole("button", { name: /History 1/ }).click()
  await expect(
    page.getByRole("heading", { name: historic.title })
  ).toBeVisible()
  await expect(page.getByRole("heading", { name: road.title })).toHaveCount(0)
  await page.getByText("Source health & coverage").click()
  await expect(
    page.getByText("The provider is temporarily unavailable.")
  ).toBeVisible()
})

test("accepts source updates and preserves records during disconnects or invalid updates", async ({
  page,
}) => {
  await page.goto("/incidents")
  await expect(page.getByRole("heading", { name: road.title })).toBeVisible()
  const updated: IncidentSnapshot = {
    ...fixture,
    revision: "second",
    generatedAt: "2026-10-24T12:01:00.000Z",
    incidents: [
      { ...road, status: "resolved", updatedAt: "2026-10-24T12:01:00.000Z" },
      flood,
      historic,
    ],
  }
  await page.evaluate((payload) => {
    const stream = window.incidentStream
    if (!stream) throw new Error("Test incident stream has not connected")
    stream.dispatchEvent(
      new MessageEvent("snapshot", { data: JSON.stringify(payload) })
    )
  }, updated)
  await expect(page.getByRole("heading", { name: road.title })).toHaveCount(0)
  await expect(
    page.getByText("0 new records and 1 updated records received.")
  ).toHaveCount(1)
  // A repeated revision updates freshness, but must not create another event or record.
  await page.evaluate((payload) => {
    const stream = window.incidentStream
    if (!stream) throw new Error("Test incident stream has not connected")
    stream.dispatchEvent(
      new MessageEvent("snapshot", { data: JSON.stringify(payload) })
    )
    stream.onerror?.()
  }, updated)
  await expect(page.getByText("Updates are reconnecting.")).toBeVisible()
  await expect(page.getByRole("heading", { name: flood.title })).toBeVisible()
  await page.evaluate(() => {
    const stream = window.incidentStream
    if (!stream) throw new Error("Test incident stream has not connected")
    stream.dispatchEvent(
      new MessageEvent("snapshot", {
        data: JSON.stringify({ version: 9000, incidents: [] }),
      })
    )
  })
  await expect(
    page.getByText(
      "An update could not be verified. Keeping the last valid records."
    )
  ).toBeVisible()
  await expect(page.getByRole("heading", { name: flood.title })).toBeVisible()
  await page.getByRole("button", { name: /History 2/ }).click()
  await expect(page.getByRole("heading", { name: road.title })).toBeVisible()
  await expect(page.getByText("Resolved by source")).toBeVisible()
})

test("incident filters and reports fit a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/incidents")
  await expect(page.getByRole("heading", { name: road.title })).toBeVisible()
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth
  )
  expect(overflow).toBe(false)
  await page
    .getByRole("textbox", { name: "Search incidents" })
    .fill("no such incident")
  await expect(
    page.getByRole("heading", { name: "No records match these filters" })
  ).toBeVisible()
  // There are two clearly named filter reset buttons in the empty state.
  await page
    .getByRole("button", { name: "Reset filters", exact: true })
    .first()
    .click()
  await expect(page.getByRole("heading", { name: road.title })).toBeVisible()
})
