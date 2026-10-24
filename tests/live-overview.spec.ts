import { expect, test } from "@playwright/test"
import type { IncidentSnapshot } from "../src/lib/live-incidents"

const snapshot: IncidentSnapshot = {
  version: 1,
  revision: "overview-fixture",
  generatedAt: "2026-10-24T12:00:00.000Z",
  incidents: [
    {
      id: "gdacs:reported-flood",
      sourceId: "gdacs",
      providerId: "reported-flood",
      title: "Source-reported flood observation",
      description: "A reported hazard, not a confirmed shipment interruption.",
      kind: "flood",
      severity: "medium",
      status: "active",
      country: "Taiwan",
      location: "Kaohsiung",
      fetchedAt: "2026-10-24T12:00:00.000Z",
      updatedAt: "2026-10-24T11:30:00.000Z",
      url: "https://gdacs.org/",
      evidence: "hazard",
    },
  ],
  sources: [
    {
      id: "gdacs",
      name: "GDACS",
      state: "live",
      recordCount: 1,
      updateIntervalSeconds: 300,
      checkedAt: "2026-10-24T12:00:00.000Z",
      lastSuccessAt: "2026-10-24T12:00:00.000Z",
      url: "https://gdacs.org/",
    },
  ],
}

test.beforeEach(async ({ page }) => {
  await page.route(/\/api\/incidents$/, (route) =>
    route.fulfill({ json: snapshot })
  )
  await page.addInitScript(() => {
    class QuietEventSource extends EventTarget {
      onopen: (() => void) | null = null
      onerror: (() => void) | null = null
      close() {}
      constructor() {
        super()
        setTimeout(() => this.onopen?.(), 0)
      }
    }
    Object.defineProperty(window, "EventSource", { value: QuietEventSource })
  })
})

test("default overview shows documented products and actionable planning markers", async ({
  page,
}) => {
  await page.goto("/")
  await expect(
    page.getByRole("heading", { name: "A modular AI data center." })
  ).toBeVisible()
  const hardware = page.getByRole("region", {
    name: "Hardware references",
    exact: true,
  })
  await expect(hardware.getByRole("button")).toHaveCount(10)
  await expect(
    hardware.getByText("SuperServer SRS-GB300-NVL72", { exact: true })
  ).toBeVisible()
  await expect(
    hardware.getByText("CoolChip CDU 600", { exact: true })
  ).toBeVisible()
  await expect(
    hardware.getByText("RackChiller Rack Manifold (RCM42001)", { exact: true })
  ).toBeVisible()
  await expect(
    hardware.getByRole("link", {
      name: "Calculate delivery route",
      exact: true,
    })
  ).toHaveCount(10)
  const viewer = page.getByTestId("rack-viewer")
  await expect(viewer).toHaveAttribute("data-renderer", /webgl|fallback/)
  await expect(viewer.locator('button[data-status="blocked"]')).toHaveCount(1)
  await expect(viewer.locator('button[data-status="delayed"]')).toHaveCount(9)
  await expect(
    viewer.getByRole("button", {
      name: "Inspect Optical interconnects: Review delivery",
    })
  ).toBeVisible()
  await expect(
    page.getByText(
      "Red: review delivery · Amber: plan delivery · Green: reviewed",
      { exact: true }
    )
  ).toBeVisible()
  await expect(
    page.getByRole("link", { name: /Source-reported flood observation/ })
  ).toBeVisible()
  await expect(
    page.getByRole("button", {
      name: /clear |pause feed|resume feed|reset disruption|simulate|confirm recovery/i,
    })
  ).toHaveCount(0)
  await expect(
    page.getByRole("combobox", { name: "Filter parts by delivery state" })
  ).toHaveCount(0)
  await expect(
    page.getByRole("link", { name: "Plan a delivery" })
  ).toHaveAttribute("href", "/planning?component=optics")
})

test("component query opens the exact researched hardware with source evidence", async ({
  page,
}) => {
  await page.goto("/?component=optics")
  const dialog = page.getByRole("dialog", {
    name: "Optical interconnects inspection",
  })
  await expect(dialog).toBeVisible()
  await expect(
    dialog.getByRole("heading", { name: "LinkX MMA4Z00-NS400", exact: true })
  ).toBeVisible()
  await dialog
    .getByText("Origin and delivery evidence", { exact: true })
    .click()
  await expect(
    dialog.getByText(
      /A manufacturer's country footprint is not the origin of this order/
    )
  ).toBeVisible()
  await expect(
    dialog.getByText("Manufacturing origin unverified", { exact: true })
  ).toBeVisible()
  await expect(
    dialog.getByRole("link", { name: "Review source reports" })
  ).toHaveAttribute("href", "/incidents?component=optics")
  await expect(
    dialog.getByText(
      "Reference research. No confirmed purchase, allocation or shipment.",
      { exact: true }
    )
  ).toBeVisible()
  await dialog
    .getByText("Specifications and manufacturer sources", { exact: true })
    .click()
  const sources = dialog.getByRole("list", { name: "Manufacturer sources" })
  await expect(sources.getByRole("link").first()).toHaveAttribute(
    "href",
    /^https:\/\/docs\.nvidia\.com\/mma4z00-ns400/
  )
  await expect(
    dialog.getByRole("link", { name: "Plan this delivery" })
  ).toHaveAttribute("href", "/planning?component=optics")
})

test("mobile component selection reveals and focuses inspection, and reset restores the base view", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/")
  const viewer = page.getByTestId("rack-viewer")
  await expect(viewer).toHaveAttribute("data-renderer", /webgl|fallback/)
  await page.getByRole("button", { name: "Exploded", exact: true }).click()
  await page.getByRole("button", { name: "Wireframe", exact: true }).click()
  await expect(viewer).toHaveAttribute("data-assembly", "exploded")
  await expect(viewer).toHaveAttribute("data-mode", "wireframe")
  const hardware = page.getByRole("region", {
    name: "Hardware references",
    exact: true,
  })
  const card = hardware.getByRole("button", {
    name: "Inspect Cooling manifold",
    exact: true,
  })
  await card.click()
  const inspection = page.getByRole("complementary", {
    name: "Component inspection",
    exact: true,
  })
  await expect(inspection).toBeFocused()
  await expect(
    inspection.getByRole("heading", { name: "Cooling manifold", exact: true })
  ).toBeInViewport()
  await expect(
    page.getByRole("dialog", { name: "Cooling manifold inspection" })
  ).toBeVisible()
  await expect(viewer).toHaveAttribute("data-assembly", "cutaway")
  const search = page.getByRole("searchbox", {
    name: "Find a part or manufacturer",
    exact: true,
  })
  await search.fill("Vertiv")
  await expect(hardware.getByRole("button")).toHaveCount(2)
  await page.getByRole("button", { name: "2D", exact: true }).click()
  await expect(viewer).toHaveAttribute("data-mode", "schematic")
  await page.getByRole("button", { name: "Reset view", exact: true }).click()
  await expect(search).toHaveValue("")
  await expect(viewer).toHaveAttribute("data-mode", "solid")
  await expect(viewer).toHaveAttribute("data-assembly", "cutaway")
  await expect(
    page.getByRole("button", { name: "3D model", exact: true })
  ).toHaveAttribute("aria-pressed", "true")
  await expect(
    page.getByRole("button", { name: "Cutaway", exact: true })
  ).toHaveAttribute("aria-pressed", "true")
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(hardware.getByRole("button")).toHaveCount(10)
  await expect(viewer.locator('button[aria-pressed="true"]')).toHaveCount(0)
})

for (const width of [320, 390, 768, 1440]) {
  test(`default overview has no horizontal overflow at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto("/")
    await expect(
      page.getByRole("heading", { name: "A modular AI data center." })
    ).toBeVisible()
    await expect(page.getByTestId("rack-viewer")).toHaveAttribute(
      "data-renderer",
      /webgl|fallback/
    )
    await expect(
      page.getByRole("link", { name: /Source-reported flood observation/ })
    ).toBeVisible()
    expect(
      await page.evaluate(() => ({
        document: document.documentElement.scrollWidth,
        viewport: innerWidth,
      }))
    ).toEqual({ document: width, viewport: width })
    const evidenceBadge = page.getByText(
      "Live observations · researched hardware",
      { exact: true }
    )
    expect(
      await evidenceBadge.evaluate(
        (element) => element.scrollHeight <= element.clientHeight + 1
      )
    ).toBe(true)
  })
}
