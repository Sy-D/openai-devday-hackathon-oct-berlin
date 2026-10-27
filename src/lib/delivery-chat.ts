import { z } from "zod"
import {
  draftSchema,
  metricsSchema,
  type DeliveryDraft,
} from "../../components/procurement/plan-state"
import { partCatalog } from "../data/part-catalog"
import { offersWithAssumptions } from "../data/procurement-assumptions"
import { defaultDeliveryLocation } from "../data/procurement-offers"
import type { RouteMetrics } from "./procurement"

export const componentIdSchema = z
  .string()
  .refine((id) => Object.hasOwn(partCatalog, id), "Unknown component")
export const chatRequestSchema = z
  .object({
    messages: z
      .array(
        z
          .object({
            role: z.enum(["user", "assistant"]),
            content: z.string().min(1).max(6000),
          })
          .strict()
      )
      .min(1)
      .max(14),
    componentId: componentIdSchema,
    timeZone: z
      .string()
      .max(80)
      .refine((zone) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: zone })
          return true
        } catch {
          return false
        }
      }),
    drafts: z.array(draftSchema).max(10),
  })
  .strict()
  .refine(
    (input) =>
      input.messages.at(-1)?.role === "user" &&
      input.messages.reduce((n, m) => n + m.content.length, 0) <= 30000 &&
      new Set(input.drafts.map((d) => d.componentId)).size ===
        input.drafts.length &&
      input.drafts.every(
        (d) => componentIdSchema.safeParse(d.componentId).success
      ),
    "Invalid conversation or delivery context"
  )
export type ChatRequest = z.infer<typeof chatRequestSchema>
export type ChatMessage = ChatRequest["messages"][number]
export type DeliveryChange = {
  componentId: string
  draft: DeliveryDraft
  before: RouteMetrics | null
  after: RouteMetrics | null
}
export type ChatResult = {
  reply: string
  activity: string[]
  changes: DeliveryChange[]
}
export const chatResultSchema = z.object({
  reply: z.string().max(24000),
  activity: z.array(z.string().max(160)).max(12),
  changes: z
    .array(
      z.object({
        componentId: componentIdSchema,
        draft: draftSchema,
        before: metricsSchema.nullable(),
        after: metricsSchema.nullable(),
      })
    )
    .max(10),
})

/** Convert an instant into the same local date/time fields used by the planner. */
export function inTimeZone(iso: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso))
  const field = (key: string) => parts.find((p) => p.type === key)?.value
  return `${field("year")}-${field("month")}-${field("day")}T${field("hour")}:${field("minute")}`
}

/** Browser-local dates must not be interpreted in the deployment server's timezone. */
export function zonedIso(local: string, zone: string) {
  if (!local) return ""
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))
    throw new Error("Use a valid local date and time")
  const nominal = Date.parse(`${local}Z`)
  let instant = nominal
  for (let i = 0; i < 3; i++)
    instant +=
      nominal -
      Date.parse(`${inTimeZone(new Date(instant).toISOString(), zone)}Z`)
  const result = new Date(instant).toISOString()
  if (inTimeZone(result, zone) !== local)
    throw new Error(
      "That local time does not exist; choose a time outside the daylight-saving change"
    )
  return result
}

export function freshDeliveryDraft(
  componentId: string,
  zone: string
): DeliveryDraft {
  const offer = offersWithAssumptions(componentId)[0]
  return {
    version: 1,
    componentId,
    offerId: offer?.id ?? "",
    originLabel: offer?.dispatch?.label ?? "",
    originLon: String(offer?.dispatch?.coordinates[0] ?? ""),
    originLat: String(offer?.dispatch?.coordinates[1] ?? ""),
    destinationLabel: defaultDeliveryLocation.label,
    destinationLon: String(defaultDeliveryLocation.coordinates[0]),
    destinationLat: String(defaultDeliveryLocation.coordinates[1]),
    inputs: {
      departure: inTimeZone(new Date().toISOString(), zone),
      deadline: "",
      handlingMinutes: 0,
      quantity: 1,
    },
    response: null,
    baseline: null,
    selectedRouteId: "",
    routeEndpoints: "",
    avoidedIds: [],
    saved: null,
  }
}
