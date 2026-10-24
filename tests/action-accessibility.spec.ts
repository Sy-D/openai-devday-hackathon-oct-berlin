import { test, expect } from "@playwright/test"
import { orders } from "../src/data/network"

test.beforeEach(async ({ page }) => {
  await page.goto("/planning")
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test("all required orders can be expanded by keyboard with an exposed disclosure state", async ({
  page,
}) => {
  const extra = orders.find((order) => order.state !== "action")!
  await page.evaluate((order) => {
    localStorage.setItem(
      "forma-demo-v1",
      JSON.stringify({
        scenarios: {
          [order.id]: {
            quantity: order.quantity + 1,
            dueHours: order.dueHours,
          },
        },
      })
    )
  }, extra)
  await page.reload()
  const toggle = page.getByRole("button", { name: "Show all 4 orders" })
  await expect(page.locator("#needs-action-orders article")).toHaveCount(3)
  await expect(toggle).toHaveAttribute("aria-expanded", "false")
  await expect(toggle).toHaveAttribute("aria-controls", "needs-action-orders")
  await toggle.focus()
  await page.keyboard.press("Enter")
  await expect(page.locator("#needs-action-orders article")).toHaveCount(4)
  const collapse = page.getByRole("button", { name: "Show fewer orders" })
  await expect(collapse).toHaveAttribute("aria-expanded", "true")
  await page.keyboard.press("Space")
  await expect(page.locator("#needs-action-orders article")).toHaveCount(3)
  await expect(toggle).toHaveAttribute("aria-expanded", "false")
})

test("action reasons and scenario guidance retain readable small-text contrast", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await expect(page.locator(".scenario-heading p")).toBeVisible()
  for (const theme of ["light", "dark"]) {
    await page.evaluate(
      (theme) =>
        document.documentElement.classList.toggle("dark", theme === "dark"),
      theme
    )
    const checks = await page
      .locator(
        [
          ".action-heading p",
          ".action-order > span",
          ".order-action p",
          ".action-live-label",
          ".scenario-heading p",
          ".scenario-badge",
          ".scenario-field > span",
          ".scenario-field > div > span",
          ".scenario-deadline > span",
          ".scenario-deadline > strong",
          ".scenario-help > span",
        ].join(",")
      )
      .evaluateAll((elements) => {
        // Let the browser convert modern CSS colors (including oklch/color-mix) to sRGB.
        const canvas = document.createElement("canvas")
        canvas.width = canvas.height = 1
        const context = canvas.getContext("2d", {
          colorSpace: "srgb",
          willReadFrequently: true,
        })
        if (!context)
          throw new Error(
            "A 2D canvas is required to measure rendered text contrast."
          )
        type Rgba = [number, number, number, number]
        const rgba = (css: string): Rgba => {
          context.clearRect(0, 0, 1, 1)
          context.fillStyle = css
          context.fillRect(0, 0, 1, 1)
          const pixel = context.getImageData(0, 0, 1, 1).data
          return [
            pixel[0] / 255,
            pixel[1] / 255,
            pixel[2] / 255,
            pixel[3] / 255,
          ]
        }
        const over = (front: Rgba, back: Rgba): Rgba => {
          const alpha = front[3] + back[3] * (1 - front[3])
          if (alpha === 0) return [0, 0, 0, 0]
          const channel = (index: number) =>
            (front[index] * front[3] + back[index] * back[3] * (1 - front[3])) /
            alpha
          return [channel(0), channel(1), channel(2), alpha]
        }
        const luminance = (color: Rgba) => {
          const values = color
            .slice(0, 3)
            .map((value) =>
              value <= 0.04045
                ? value / 12.92
                : ((value + 0.055) / 1.055) ** 2.4
            )
          return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2]
        }
        return elements.map((element) => {
          const ancestors: Element[] = []
          for (
            let parent: Element | null = element;
            parent;
            parent = parent.parentElement
          )
            ancestors.unshift(parent)
          const background = ancestors.reduce<Rgba>(
            (back, ancestor) =>
              over(rgba(getComputedStyle(ancestor).backgroundColor), back),
            [1, 1, 1, 1]
          )
          const foreground = luminance(
            over(rgba(getComputedStyle(element).color), background)
          )
          const backdrop = luminance(background)
          return {
            text: element.textContent,
            ratio:
              (Math.max(foreground, backdrop) + 0.05) /
              (Math.min(foreground, backdrop) + 0.05),
          }
        })
      })
    expect(checks.length).toBeGreaterThan(10)
    for (const check of checks)
      expect
        .soft(check.ratio, `${theme}: ${check.text ?? "Visible guidance"}`)
        .toBeGreaterThanOrEqual(4.5)
  }
})
