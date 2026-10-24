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
  await filter.selectOption("attention")
  await expect(page.getByRole("button", { name: /^Inspect / })).toHaveCount(3)
  await search.fill("Compute rack A")
  await expect(page.getByRole("button", { name: /^Inspect / })).toHaveCount(1)
  await expect(page.getByTestId("dsx-action-count")).toHaveText("3 of 10 parts")
  await page.getByRole("button", { name: "2D", exact: true }).click()
  await page.getByRole("button", { name: /^Inspect Compute rack A/ }).click()
  await expect(
    page.getByRole("dialog", { name: "Compute rack A" })
  ).toBeVisible()
  await search.fill("no matching component")
  await expect(page.getByText("No parts match these filters.")).toBeVisible()
  await expect(page.getByRole("button", { name: /^Inspect / })).toHaveCount(0)
  await page.getByRole("button", { name: "Reset view", exact: true }).click()
  await expect(search).toHaveValue("")
  await expect(filter).toHaveValue("all")
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
    page.getByRole("dialog", { name: "Compute rack A" })
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
    page.getByRole("heading", { name: "One pod. Every dependency." })
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
    page.getByRole("dialog", { name: "Compute rack A" })
  ).toBeVisible()
  await expect(
    page
      .getByRole("dialog")
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
    page.getByRole("dialog", { name: "Container and roof" })
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
    page.getByRole("dialog", { name: "Cooling manifold" })
  ).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Open recovery plan", exact: true })
  ).toHaveAttribute("href", "/planning?component=manifold")
})
