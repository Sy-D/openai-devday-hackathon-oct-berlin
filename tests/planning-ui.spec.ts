import { test, expect } from "@playwright/test"

test.beforeEach(async ({ page }) => {
  await page.goto("/planning")
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test("geographic map has real controls, updates selected routes and exposes location capabilities", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  const map = page.getByTestId("planning-map")
  await expect(map.locator(".leaflet-container")).toBeVisible({
    timeout: 30000,
  })
  await expect(
    map.getByRole("button", { name: "Zoom in", exact: true })
  ).toBeVisible()
  await expect(
    map.getByRole("button", { name: "Enter fullscreen", exact: true })
  ).toBeVisible()
  await expect(map.locator(".leaflet-marker-icon")).toHaveCount(10)
  await expect(map.locator(".leaflet-control-attribution")).toContainText(
    "OpenStreetMap"
  )
  await expect(
    map.locator(
      '.leaflet-marker-icon[title="Inspect Elbe Additive, Dresden"] .selected'
    )
  ).toHaveCount(1)
  await page.getByTestId("plan-express").click()
  await expect(
    page.getByRole("list", { name: "Selected route assignments" })
  ).toContainText("Munich → Leipzig")
  await expect(
    map.locator(
      '.leaflet-marker-icon[title="Inspect Precision Hub, Munich"] .selected'
    )
  ).toHaveCount(1)
  await expect(
    map.locator(
      '.leaflet-marker-icon[title="Inspect Elbe Additive, Dresden"] .selected'
    )
  ).toHaveCount(0)
  await map
    .locator('.leaflet-marker-icon[title="Inspect Atelier 3D, Lyon"]')
    .click()
  await expect(map.locator(".leaflet-popup")).toContainText(
    "No compatible parts in this order"
  )
  await page.screenshot({ path: "/tmp/forma-planning-map.png", fullPage: true })
  expect(errors).toEqual([])
})

test("map background failures retain route assignments and independent location actions", async ({
  page,
}) => {
  await page.route("**/api/map-proxy/**", (route) =>
    route.fulfill({ status: 502, body: "tile fetch failed" })
  )
  await page.reload()
  await expect(
    page.getByTestId("planning-map").locator(".leaflet-container")
  ).toBeVisible({ timeout: 30000 })
  await expect(
    page.getByText(
      "Map background unavailable. Routes and location details remain available below."
    )
  ).toBeVisible({ timeout: 20000 })
  await expect(
    page.getByRole("list", { name: "Selected route assignments" })
  ).toContainText("Dresden → Leipzig")
  await expect(
    page.locator('img.leaflet-tile[src*="openstreetmap"]')
  ).toHaveCount(0)
  await page.getByText("Inspect network locations · 10").click()
  const inspect = page.getByRole("button", {
    name: "Inspect Elbe Additive, Dresden",
    exact: true,
  })
  await inspect.click()
  await expect(
    page.getByRole("dialog", { name: "Elbe Additive details" })
  ).toContainText("80 parts")
  await page.getByRole("button", { name: "Close facility details" }).click()
  await expect(inspect).toBeFocused()
})

test("library overlays trap focus, close with Escape and return focus without losing consent safety", async ({
  page,
}) => {
  await page.getByTestId("plan-economy").click()
  const review = page.getByTestId("confirm-plan")
  await review.click()
  const dialog = page.getByRole("dialog", { name: "Review plan for FM-2048" })
  const confirm = dialog.getByRole("button", {
    name: "Confirm production plan",
    exact: true,
  })
  await expect(confirm).toBeDisabled()
  await dialog.getByRole("checkbox").check()
  await expect(confirm).toBeEnabled()
  await dialog.getByRole("button", { name: "Cancel", exact: true }).focus()
  await page.keyboard.press("Shift+Tab")
  await expect(dialog.getByRole("checkbox")).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(review).toBeFocused()
  await review.click()
  await expect(confirm).toBeDisabled()
  await page.keyboard.press("Escape")
  const assistant = page.getByRole("button", {
    name: "Ask copilot",
    exact: true,
  })
  await assistant.click()
  await expect(
    page.getByRole("textbox", { name: "Ask the planning copilot" })
  ).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(assistant).toBeFocused()
  const settings = page.getByRole("button", { name: "Workspace settings" })
  await settings.click()
  await expect(
    page.getByRole("dialog", { name: "Demo workspace settings" })
  ).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(settings).toBeFocused()
})
