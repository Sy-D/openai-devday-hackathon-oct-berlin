import { expect, test } from "@playwright/test"

test("delivery draft survives navigation and reload without introducing former planner styles", async ({
  page,
}) => {
  await page.goto("/planning?component=optics")
  await expect(
    page.getByRole("heading", { name: "Plan a delivery." })
  ).toBeVisible()
  await page.getByLabel("Order quantity", { exact: true }).fill("3")
  await page
    .getByLabel("Delivery deadline", { exact: true })
    .fill("2026-10-26T18:00")
  await page
    .getByRole("link", { name: "Back to this part", exact: true })
    .click()
  await expect(page).toHaveURL(/\/\?component=optics/)
  await expect(
    page.getByRole("dialog", { name: "Optical interconnects inspection" })
  ).toBeVisible()
  await expect(page.locator(".forma-app")).toHaveCount(0)
  await page
    .getByRole("link", { name: "Plan this delivery", exact: true })
    .click()
  await expect(page.getByLabel("Order quantity", { exact: true })).toHaveValue(
    "3"
  )
  await expect(
    page.getByLabel("Delivery deadline", { exact: true })
  ).toHaveValue("2026-10-26T18:00")
  await page.reload()
  await expect(page.getByLabel("Order quantity", { exact: true })).toHaveValue(
    "3"
  )
  await expect(
    page.getByLabel("Delivery deadline", { exact: true })
  ).toHaveValue("2026-10-26T18:00")
  await expect(
    page.getByRole("button", {
      name: /Apply scenario|Pause feed|Reset disruption|Clear scenario/,
    })
  ).toHaveCount(0)
})

test("mobile shared navigation opens the real delivery workspace", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/")
  await page
    .getByRole("button", { name: "Toggle Sidebar", exact: true })
    .click()
  await page
    .getByRole("link", { name: "Delivery planning", exact: true })
    .click()
  await expect(page).toHaveURL(/\/planning$/)
  await expect(
    page.getByRole("heading", { name: "Plan a delivery." })
  ).toBeVisible()
  await expect(
    page.getByLabel("Delivery deadline", { exact: true })
  ).toHaveValue("")
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true)
})

test("retired supplier routes lead to real delivery planning and scripted APIs are unavailable", async ({
  page,
  request,
}) => {
  for (const path of ["/suppliers", "/supplier/legacy", "/compare"]) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/planning$/)
    await expect(
      page.getByRole("heading", { name: "Plan a delivery." })
    ).toBeVisible()
  }
  expect((await request.get("/api/disruptions")).status()).toBe(410)
  expect((await request.post("/api/assistant", { data: {} })).status()).toBe(
    410
  )
})
