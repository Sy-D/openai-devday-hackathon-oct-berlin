import { test, expect } from "@playwright/test"

test("video-inspired enclosure views reveal layers and preserve inspection and reset", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto("/")
  const viewer = page.getByTestId("rack-viewer")
  const assembly = page.getByRole("group", { name: "Enclosure assembly view" })
  await expect(viewer).toHaveAttribute("data-renderer", "webgl")
  for (const [label, value] of [
    ["Enclosed", "enclosed"],
    ["Exploded", "exploded"],
  ]) {
    await assembly.getByRole("button", { name: label, exact: true }).click()
    await expect(viewer).toHaveAttribute("data-assembly", value)
    await expect(viewer).toHaveAttribute("data-assembly-moving", "false")
    await expect(
      page.getByTestId("rack-viewer").getByRole("button", { name: /^Inspect / })
    ).toHaveCount(10)
  }
  await page.getByRole("button", { name: "Wireframe", exact: true }).click()
  await expect(viewer).toHaveAttribute("data-mode", "wireframe")
  await page
    .getByTestId("rack-viewer")
    .getByRole("button", { name: /^Inspect Compute rack A/ })
    .click()
  await expect(viewer).toHaveAttribute("data-assembly", "cutaway")
  await expect(
    page.getByRole("dialog", { name: "Compute rack A inspection" })
  ).toBeVisible()
  await assembly.getByRole("button", { name: "Exploded", exact: true }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await page.getByRole("button", { name: "2D", exact: true }).click()
  await expect(
    assembly.getByRole("button", { name: "Enclosed", exact: true })
  ).toBeDisabled()
  await page.getByRole("button", { name: "Reset view", exact: true }).click()
  await expect(viewer).toHaveAttribute("data-assembly", "cutaway")
  await expect(viewer).toHaveAttribute("data-mode", "solid")
  await expect(viewer).toHaveAttribute("data-assembly-moving", "false")
  await expect(
    assembly.getByRole("button", { name: "Cutaway", exact: true })
  ).toHaveAttribute("aria-pressed", "true")
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  await expect(viewer).toHaveAttribute("data-renderer", "webgl")
  for (const label of ["Enclosed", "Exploded"]) {
    await assembly.getByRole("button", { name: label, exact: true }).click()
    await expect(viewer).toHaveAttribute("data-assembly", label.toLowerCase())
    await expect(viewer).toHaveAttribute("data-assembly-moving", "false")
    await expect(
      page.getByTestId("rack-viewer").getByRole("button", { name: /^Inspect / })
    ).toHaveCount(10)
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true)
  expect(errors).toEqual([])
})

test("Reset view restores the full 3D model after camera movement and mode changes", async ({
  page,
}) => {
  await page.goto("/")
  const viewer = page.getByTestId("rack-viewer")
  await expect(viewer).toHaveAttribute("data-renderer", "webgl")
  const marker = page
    .getByTestId("rack-viewer")
    .getByRole("button", { name: /^Inspect Compute rack A/ })
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
    page.getByRole("dialog", { name: "Compute rack A inspection" })
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
  await expect(page.getByTestId("rack-viewer")).toHaveAttribute(
    "data-renderer",
    "fallback"
  )
  await page
    .getByTestId("rack-viewer")
    .getByRole("button", { name: /^Inspect Cooling manifold/ })
    .click()
  await expect(
    page.getByRole("dialog", { name: "Cooling manifold inspection" })
  ).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Plan this delivery", exact: true })
  ).toHaveAttribute("href", "/planning?component=manifold")
})
