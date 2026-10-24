import { expect, test } from "@playwright/test"
import { freshDeliveryDraft, type ChatResult } from "../src/lib/delivery-chat"
import {
  draftKey,
  endpointSignature,
} from "../components/procurement/plan-state"
import type { RoadRoute } from "../src/lib/procurement"

function proposal(): ChatResult {
  const draft = freshDeliveryDraft("optics", "UTC")
  draft.inputs.quantity = 2
  const route: RoadRoute = {
    id: "chat-test-route",
    label: "Road route",
    distanceKm: 270,
    durationSeconds: 10800,
    coordinates: [
      [10.213583, 53.5411468],
      [13.2376192, 52.5375121],
    ],
    avoidance: false,
  }
  draft.response = {
    version: 1,
    routes: [route],
    fetchedAt: new Date().toISOString(),
    provider: "Browser test route",
    sourceUrl: "https://example.com/route",
    attribution: "Test fixture",
    exclusions: [],
    warnings: [],
  }
  draft.baseline = route
  draft.selectedRouteId = route.id
  draft.routeEndpoints = endpointSignature(draft)
  return {
    reply:
      "Prepared two units and a road route. Review the draft changes before applying a decision.",
    activity: ["Calculated road routes and tradeoffs"],
    changes: [
      {
        componentId: "optics",
        draft,
        before: null,
        after: {
          distanceKm: 270,
          drivingMinutes: 180,
          reportedDelayMinutes: 0,
          transportEstimateEur: 315,
          productSubtotalEur: 2966.56,
          totalEstimateEur: 3281.56,
          emissionsKg: 46.6,
          arrival: null,
          bufferMinutes: null,
        },
      },
    ],
  }
}

test("overview chat prepares a draft, updates the planner, and leaves approval manual", async ({
  page,
}) => {
  const result = proposal()
  await page.route("**/api/delivery-chat", async (route) => {
    const request = route.request().postDataJSON()
    expect(request.componentId).toBe("optics")
    expect(request.messages.at(-1).content).toContain("two units")
    await route.fulfill({ json: result })
  })
  await page.goto("/?component=optics")
  await page.getByRole("button", { name: "Ask FORMA" }).first().click()
  await page
    .getByRole("textbox", { name: "Message FORMA" })
    .fill("Plan two units and calculate the road route.")
  await page.getByRole("button", { name: "Send message" }).click()
  await expect(
    page.getByRole("button", { name: "Update delivery draft" })
  ).toBeVisible()
  expect(
    await page.evaluate((key) => localStorage.getItem(key), draftKey("optics"))
  ).toBeNull()
  await page.getByRole("button", { name: "Update delivery draft" }).click()
  await expect(
    page.getByText("Draft updated · decision still needs review")
  ).toBeVisible()
  await page.getByRole("link", { name: "Review delivery", exact: true }).click()
  await expect(page).toHaveURL(/planning\?component=optics#decision/)
  await expect(
    page.getByRole("button", { name: "Apply route decision", exact: true })
  ).toBeVisible()
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).inputs.quantity,
      draftKey("optics")
    )
  ).toBe(2)
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).saved,
      draftKey("optics")
    )
  ).toBeNull()
})

test("chat synchronizes an open planner and Undo restores its previous draft", async ({
  page,
}) => {
  await page.route("**/api/delivery-chat", (route) =>
    route.fulfill({ json: proposal() })
  )
  await page.goto("/planning?component=optics")
  await expect(
    page.getByRole("button", { name: "Calculate road routes", exact: true })
  ).toBeVisible()
  const before = await page.evaluate(
    (key) => localStorage.getItem(key),
    draftKey("optics")
  )
  await page.getByRole("button", { name: "Ask FORMA" }).click()
  await page
    .getByRole("textbox", { name: "Message FORMA" })
    .fill("Set two units and calculate routes.")
  await page.getByRole("button", { name: "Send message" }).click()
  await page.getByRole("button", { name: "Update delivery draft" }).click()
  await expect(
    page.getByText("Draft updated · decision still needs review")
  ).toBeVisible()
  await page.getByRole("button", { name: "Undo draft changes" }).click()
  await expect(page.getByText("Draft changes undone")).toBeVisible()
  expect(
    await page.evaluate((key) => localStorage.getItem(key), draftKey("optics"))
  ).toBe(before)
  await page.getByRole("button", { name: "Close", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Calculate road routes", exact: true })
  ).toBeVisible()
})

test("a late chat proposal cannot overwrite a manual edit", async ({
  page,
}) => {
  await page.route("**/api/delivery-chat", (route) =>
    route.fulfill({ json: proposal() })
  )
  await page.goto("/?component=optics")
  await page.getByRole("button", { name: "Ask FORMA" }).first().click()
  await page
    .getByRole("textbox", { name: "Message FORMA" })
    .fill("Plan the delivery")
  await page.getByRole("button", { name: "Send message" }).click()
  await expect(
    page.getByRole("button", { name: "Update delivery draft" })
  ).toBeVisible()
  const manual = freshDeliveryDraft("optics", "UTC")
  manual.inputs.quantity = 9
  await page.evaluate(
    ({ key, draft }) => localStorage.setItem(key, JSON.stringify(draft)),
    { key: draftKey("optics"), draft: manual }
  )
  await page.getByRole("button", { name: "Update delivery draft" }).click()
  await expect(page.getByRole("alert")).toContainText(
    "changed while the assistant"
  )
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).inputs.quantity,
      draftKey("optics")
    )
  ).toBe(9)
})

test("provider errors remain visible without fabricated answers or draft changes", async ({
  page,
}) => {
  await page.route("**/api/delivery-chat", (route) =>
    route.fulfill({
      status: 503,
      json: {
        error: "OpenRouter rejected the server credential or model access.",
      },
    })
  )
  await page.goto("/?component=cooling")
  await page.getByRole("button", { name: "Ask FORMA" }).first().click()
  await expect(page.getByLabel("Delivery in focus")).toHaveValue("cooling")
  await page
    .getByRole("textbox", { name: "Message FORMA" })
    .fill("Check incidents")
  await page.getByRole("button", { name: "Send message" }).click()
  await expect(page.getByRole("alert")).toContainText("OpenRouter rejected")
  await expect(
    page.getByRole("button", { name: "Update delivery draft" })
  ).toHaveCount(0)
  await page.setViewportSize({ width: 390, height: 844 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true)
})
