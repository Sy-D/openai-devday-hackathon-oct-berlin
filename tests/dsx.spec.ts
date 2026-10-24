import { test, expect } from "@playwright/test"

test("reference-style part search and status filters preserve global actions and reset", async ({
  page,
}) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Pause feed", exact: true }).click()
  const search = page.getByRole("searchbox", {
    name: "Find a part or supplier",
  })
  const filter = page.getByRole("combobox", {
    name: "Filter parts by delivery state",
  })
  await filter.click()
  await page.getByRole("option", { name: "Needs action", exact: true }).click()
  await expect(page.getByRole("button", { name: /^Inspect / })).toHaveCount(3)
  await search.fill("Compute rack A")
  await expect(page.getByRole("button", { name: /^Inspect / })).toHaveCount(1)
  await expect(page.getByTestId("dsx-action-count")).toHaveText("3 of 10 parts")
  await page.getByRole("button", { name: "2D", exact: true }).click()
  await page.getByRole("button", { name: /^Inspect Compute rack A/ }).click()
  await expect(
    page.getByRole("region", { name: "Compute rack A" })
  ).toBeVisible()
  await search.fill("no matching component")
  await expect(page.getByText("No parts match these filters.")).toBeVisible()
  await expect(page.getByRole("button", { name: /^Inspect / })).toHaveCount(0)
  await page.getByRole("button", { name: "Reset view", exact: true }).click()
  await expect(search).toHaveValue("")
  await expect(filter).toContainText("All delivery states")
  await expect(page.getByTestId("rack-viewer")).toHaveAttribute(
    "data-mode",
    "solid"
  )
  await expect(page.getByRole("button", { name: /^Inspect / })).toHaveCount(10)
  await expect(page.getByRole("dialog")).toHaveCount(0)
})

test("Reset view restores the full 3D model after camera movement and mode changes", async ({
  page,
}) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Pause feed", exact: true }).click()
  const viewer = page.getByTestId("rack-viewer")
  await expect(viewer).toHaveAttribute("data-renderer", "webgl")
  const marker = page.getByRole("button", { name: /^Inspect Compute rack A/ })
  await viewer.scrollIntoViewIfNeeded()
  const position = async () => {
    const box = await marker.boundingBox()
    const frame = await viewer.boundingBox()
    return box && frame ? { x: box.x - frame.x, y: box.y - frame.y } : null
  }
  const initial = await position()
  expect(initial).not.toBeNull()
  const canvas = viewer.locator("canvas")
  const bounds = (await canvas.boundingBox())!
  await page.mouse.move(
    bounds.x + bounds.width * 0.8,
    bounds.y + bounds.height * 0.8
  )
  await page.mouse.down()
  await page.mouse.move(
    bounds.x + bounds.width * 0.55,
    bounds.y + bounds.height * 0.65,
    { steps: 12 }
  )
  await page.mouse.up()
  await page.mouse.wheel(0, -300)
  await page.getByRole("button", { name: "Wireframe", exact: true }).click()
  await page.getByRole("button", { name: "Reset view", exact: true }).click()
  await expect(viewer).toHaveAttribute("data-mode", "solid")
  await expect
    .poll(async () => {
      const point = await position()
      return point
        ? Math.hypot(point.x - initial!.x, point.y - initial!.y)
        : Infinity
    })
    .toBeLessThan(3)
  await page.getByRole("button", { name: "2D", exact: true }).click()
  await marker.click()
  await expect(
    page.getByRole("region", { name: "Compute rack A" })
  ).toBeVisible()
  await page.getByRole("button", { name: "Reset view", exact: true }).click()
  await expect(viewer).toHaveAttribute("data-mode", "solid")
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(marker).toHaveAttribute("aria-pressed", "false")
  await expect
    .poll(async () => {
      const point = await position()
      return point
        ? Math.hypot(point.x - initial!.x, point.y - initial!.y)
        : Infinity
    })
    .toBeLessThan(3)
})

test("pod selection, camera views and recovery preserve the exact component", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto("/")
  await expect(
    page.getByRole("heading", { name: "POD 01 delivery" })
  ).toBeVisible()
  await page.getByRole("button", { name: "Pause feed", exact: true }).click()
  await expect(page.getByTestId("dsx-action-count")).toHaveText("3 of 10 parts")
  await expect(page.getByRole("button", { name: /^Inspect / })).toHaveCount(10)
  await page.getByRole("button", { name: "Wireframe", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Wireframe", exact: true })
  ).toHaveAttribute("aria-pressed", "true")
  await page.getByRole("button", { name: "2D", exact: true }).click()
  await page.getByRole("button", { name: /^Inspect Compute rack A/ }).click()
  await expect(
    page.getByRole("region", { name: "Compute rack A" })
  ).toBeVisible()
  await expect(
    page
      .getByRole("region", { name: "Compute rack A", exact: true })
      .getByText("Frankfurt cargo lane closed", { exact: true })
  ).toBeVisible()
  await page
    .getByRole("link", { name: "Open recovery plan", exact: true })
    .click()
  await expect(page).toHaveURL(/planning\?component=compute-a$/)
  await expect(
    page.getByRole("heading", { name: "Compute rack A", exact: true })
  ).toBeVisible()
  await page.getByTestId("dsx-route-compute-a-fra").click()
  await expect(
    page.getByRole("button", { name: "Review recovery plan" })
  ).toBeDisabled()
  await page.getByRole("button", { name: /Amsterdam air bridge/ }).click()
  await page.getByRole("button", { name: "Review recovery plan" }).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await page
    .getByRole("button", { name: "Confirm recovery route", exact: true })
    .click()
  await expect(
    page.getByRole("heading", { name: "Recovery route confirmed" })
  ).toBeVisible()
  await page.getByRole("link", { name: "Back to pod overview" }).click()
  await expect(page.getByTestId("dsx-action-count")).toHaveText("2 of 10 parts")
  await page.reload()
  await page.getByRole("button", { name: "Pause feed", exact: true }).click()
  await expect(page.getByTestId("dsx-action-count")).toHaveText("2 of 10 parts")
  expect(errors).toEqual([])
})

test("an incident reopens confirmed recovery and no-route state cannot be confirmed", async ({
  page,
}) => {
  await page.goto("/planning?component=cooling")
  await page.getByRole("button", { name: "Pause feed", exact: true }).click()
  await page.getByRole("button", { name: "Review recovery plan" }).click()
  await page
    .getByRole("button", { name: "Confirm recovery route", exact: true })
    .click()
  await expect(
    page.getByRole("heading", { name: "Recovery route confirmed" })
  ).toBeVisible()
  await page.getByText("Scenario controls", { exact: false }).click()
  await page.getByRole("checkbox", { name: /North Sea/ }).check()
  await expect(
    page.getByRole("heading", { name: "Your confirmed route needs review" })
  ).toBeVisible()
  await page.getByRole("link", { name: "Back to pod overview" }).click()
  await page.getByRole("button", { name: /03 Network fabric/ }).click()
  await page
    .getByRole("link", { name: "Open recovery plan", exact: true })
    .click()
  await page.getByText("Scenario controls", { exact: false }).click()
  await page.getByRole("checkbox", { name: /fabric/ }).check()
  await expect(
    page.getByText(/No available route meets the target/)
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Review recovery plan" })
  ).toBeDisabled()
})

test("real SSE adds an incident without a page reload", async ({ page }) => {
  test.setTimeout(40000)
  const streamResponses: number[] = []
  page.on("response", (response) => {
    if (response.url().includes("/api/disruptions"))
      streamResponses.push(response.status())
  })
  await page.goto("/")
  await expect(
    page.getByRole("heading", { name: /North Sea port departure/ })
  ).toHaveCount(0)
  await expect(
    page.getByRole("heading", { name: /North Sea port departure/ })
  ).toBeVisible({ timeout: 22000 })
  expect(streamResponses).toContain(200)
  await expect(page.getByText("Scenario feed connected").first()).toBeVisible()
  await page.getByRole("button", { name: "Pause feed", exact: true }).click()
  await expect(page.getByText("Scenario feed paused").first()).toBeVisible()
})

test("mobile pod remains usable and keeps Simon supplier navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/")
  await page.getByRole("button", { name: "Pause feed", exact: true }).click()
  await expect(page.getByTestId("dsx-action-count")).toBeVisible()
  await page.getByRole("button", { name: "2D", exact: true }).click()
  await page.getByRole("button", { name: /10 Container and roof/ }).click()
  await expect(
    page.getByRole("region", { name: "Container and roof" })
  ).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true)
  await page
    .getByRole("link", { name: "Open recovery plan", exact: true })
    .click()
  await expect(page).toHaveURL(/component=enclosure$/)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true)
  await page
    .getByRole("button", { name: "Toggle Sidebar", exact: true })
    .click()
  await page.getByRole("link", { name: "Suppliers", exact: true }).click()
  await expect(page).toHaveURL("/suppliers")
  await expect(
    page.getByRole("region", { name: "Portfolio facts" })
  ).toBeVisible()
})

test("a pushed event invalidates an open confirmation before it can be saved", async ({
  page,
}) => {
  test.setTimeout(40000)
  await page.goto("/planning?component=cooling")
  await page.getByRole("button", { name: "Review recovery plan" }).click()
  await expect(
    page.getByRole("button", { name: "Confirm recovery route", exact: true })
  ).toBeEnabled()
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "An incident changed this route" })
  ).toBeVisible({ timeout: 22000 })
  await expect(
    page.getByRole("button", { name: "Confirm recovery route", exact: true })
  ).toBeDisabled()
  await page.getByRole("button", { name: "Keep reviewing" }).click()
  await expect(
    page.getByRole("heading", { name: "This delivery needs a recovery plan" })
  ).toBeVisible()
})

test("2D fallback remains selectable when WebGL is unavailable", async ({
  page,
}) => {
  await page.addInitScript(`
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(kind, ...args) {
      if (kind === 'webgl' || kind === 'webgl2' || kind === 'experimental-webgl') return null;
      return original.call(this, kind, ...args);
    };
  `)
  await page.goto("/")
  await page.getByRole("button", { name: "Pause feed", exact: true }).click()
  await expect(page.getByTestId("rack-viewer")).toHaveAttribute(
    "data-renderer",
    "fallback"
  )
  await page.getByRole("button", { name: /^Inspect Cooling manifold/ }).click()
  await expect(
    page.getByRole("region", { name: "Cooling manifold" })
  ).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Open recovery plan", exact: true })
  ).toHaveAttribute("href", "/planning?component=manifold")
})

test("keyboard filters, empty reset and inline inspection stay usable", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto("/")
  await page.getByRole("button", { name: "Pause feed", exact: true }).click()
  const filter = page.getByRole("combobox", {
    name: "Filter parts by delivery state",
  })
  await filter.focus()
  await page.keyboard.press("Enter")
  await page.getByRole("option", { name: "Delivered", exact: true }).click()
  await expect(page.getByRole("button", { name: /^Inspect / })).toHaveCount(1)
  const search = page.getByRole("searchbox", {
    name: "Find a part or supplier",
  })
  await search.fill("unlisted supplier")
  await page.getByRole("button", { name: "Clear part filters" }).click()
  await expect(filter).toContainText("All delivery states")
  await expect(search).toHaveValue("")
  await expect(page.getByRole("button", { name: /^Inspect / })).toHaveCount(10)
  await page.getByRole("button", { name: /01 Compute rack A/ }).click()
  const inspection = page.getByRole("region", {
    name: "Compute rack A",
    exact: true,
  })
  await expect(inspection).toBeVisible()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await page.getByRole("button", { name: "Close part inspection" }).click()
  await expect(inspection).toHaveCount(0)
  await expect(
    page.getByRole("button", { name: /01 Compute rack A/ })
  ).toBeFocused()
  expect(errors).toEqual([])
})

test("recovery keeps route stops and review available when geographic tiles fail", async ({
  page,
}) => {
  const errors: string[] = []
  const rasterRequests: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  page.on("request", (request) => {
    if (request.url().includes("tile.openstreetmap.org"))
      rasterRequests.push(request.url())
  })
  await page.route("**/api/map-proxy/**", (route) =>
    route.fulfill({ status: 503, body: "Tile source unavailable" })
  )
  await page.goto("/planning?component=compute-a")
  await page.getByRole("button", { name: "Pause feed", exact: true }).click()
  await expect(page.getByTestId("recovery-map")).toHaveAttribute(
    "data-tile-status",
    "error",
    { timeout: 16000 }
  )
  await expect(
    page.getByText(
      "Map tiles unavailable. Route stops and delivery estimates remain available below."
    )
  ).toBeVisible()
  const stops = page.getByRole("list", { name: "Route stops" })
  await expect(stops).toContainText("Taoyuan air cargo")
  await expect(stops).toContainText("Amsterdam cargo hub")
  await page.getByTestId("dsx-route-compute-a-fra").click()
  await expect(stops).toContainText("Frankfurt cargo hub")
  await expect(
    page.getByRole("button", { name: "Review recovery plan" })
  ).toBeDisabled()
  await page.getByTestId("dsx-route-compute-a-ams").click()
  await page.getByRole("button", { name: "Review recovery plan" }).click()
  await expect(
    page.getByRole("dialog", { name: "Confirm recovery route" })
  ).toBeVisible()
  await page.getByRole("button", { name: "Keep reviewing" }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  expect(rasterRequests).toEqual([])
  expect(errors).toEqual([])
})

test.describe("reduced-motion recovery on touch", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  })

  test("dark theme keeps the confirmation centered and its actions reachable", async ({
    page,
  }) => {
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    await page.goto("/planning?component=compute-a")
    await page.getByRole("button", { name: "Pause feed", exact: true }).click()
    await page
      .getByRole("button", { name: "Toggle light and dark theme" })
      .click()
    await expect(page.locator("html")).toHaveClass(/dark/)
    await page.getByRole("button", { name: "Review recovery plan" }).click()
    const dialog = page.getByRole("dialog", { name: "Confirm recovery route" })
    await expect(dialog).toBeVisible()
    const box = (await dialog.boundingBox())!
    expect(Math.abs(box.x + box.width / 2 - 195)).toBeLessThan(2)
    expect(Math.abs(box.y + box.height / 2 - 422)).toBeLessThan(2)
    for (const name of ["Keep reviewing", "Confirm recovery route", "Close"]) {
      const action = dialog.getByRole("button", { name, exact: true })
      const hitArea = (await action.boundingBox())!
      expect(hitArea.height).toBeGreaterThanOrEqual(44)
      expect(hitArea.width).toBeGreaterThanOrEqual(44)
    }
    await dialog.getByRole("button", { name: "Keep reviewing" }).click()
    await expect(dialog).toHaveCount(0)
    expect(errors).toEqual([])
  })
})
