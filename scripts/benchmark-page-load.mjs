// Production bundle measurement with a fixed feed and no stored drafts.
// Run against a production server; this does not submit a paid model request.
import { chromium } from "@playwright/test"
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
  headless: true,
})
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1080 },
  })
  await page.route("**/api/incidents", (route) =>
    route.fulfill({
      json: {
        version: 1,
        revision: "benchmark",
        generatedAt: new Date().toISOString(),
        incidents: [],
        sources: [],
      },
    })
  )
  await page.addInitScript(() => {
    window.EventSource = class extends EventTarget {
      close() {}
    }
  })
  await page.goto(process.env.PERF_URL || "http://127.0.0.1:3000/")
  await page.getByRole("region", { name: "Delivery actions" }).waitFor()
  // Include eagerly loaded dynamic chunks, not only the initial HTML scripts.
  await page.waitForTimeout(2000)
  const measure = () =>
    page.evaluate(() => {
      const scripts = performance
        .getEntriesByType("resource")
        .filter(
          (x) =>
            x.name.includes("/_next/") && x.name.split("?")[0].endsWith(".js")
        )
      return {
        scripts: scripts.length,
        encodedBytes: scripts.reduce((n, x) => n + x.encodedBodySize, 0),
        decodedBytes: scripts.reduce((n, x) => n + x.decodedBodySize, 0),
      }
    })
  const initial = await measure()
  await page.getByRole("button", { name: "Ask FORMA", exact: true }).click()
  await page.getByRole("dialog").waitFor()
  const afterChatOpen = await measure()
  console.log(JSON.stringify({ initial, afterChatOpen }, null, 2))
} finally {
  await browser.close()
}
