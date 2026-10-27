import { chatRequestSchema } from "@/src/lib/delivery-chat"
import {
  AgentError,
  agentModel,
  agentKey,
  agentProvider,
  providerCompletion,
  readBoundedBody,
  runDeliveryAgent,
} from "@/server/delivery-agent"
import { liveIncidentHub } from "@/server/live-incidents"
import { roadRouter } from "@/server/road-routing"
import { searchPlaces } from "@/server/place-search"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 90
const headers = { "Cache-Control": "no-store" }
let active = 0
let recent: number[] = []

export function GET() {
  return Response.json(
    {
      configured: Boolean(agentKey()),
      provider: agentProvider(),
      model: agentModel(),
    },
    { headers }
  )
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin")
  try {
    const target = new URL(request.url),
      host = request.headers.get("host")
    if (host) {
      if (/[\\/?#@,\s]/.test(host)) throw new Error()
      target.host = host
    }
    if (origin && origin !== target.origin) throw new Error()
  } catch {
    return Response.json(
      { error: "Only same-origin browser requests are allowed." },
      { status: 403, headers }
    )
  }
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return Response.json(
      { error: "Send application/json." },
      { status: 415, headers }
    )
  recent = recent.filter((time) => Date.now() - time < 60000)
  if (active >= 2 || recent.length >= 12)
    return Response.json(
      { error: "The assistant is busy. Try again shortly." },
      { status: 429, headers }
    )
  active++
  recent.push(Date.now())
  try {
    const raw = await readBoundedBody(
      request,
      2_000_000,
      AbortSignal.any([request.signal, AbortSignal.timeout(5000)])
    )
    const parsed = chatRequestSchema.safeParse(JSON.parse(raw))
    if (!parsed.success)
      throw new AgentError(
        "The chat or delivery context is invalid. Refresh the page and try again.",
        400
      )
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(80000)])
    const result = await runDeliveryAgent(
      parsed.data,
      {
        snapshot: () => liveIncidentHub.getSnapshot(),
        route: (input) => roadRouter.route(input),
        search: searchPlaces,
      },
      providerCompletion(),
      signal
    )
    return Response.json(result, { headers })
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof AgentError
            ? error.message
            : error instanceof SyntaxError
              ? "Send valid JSON."
              : "The assistant could not finish. No delivery changes were saved. Please retry.",
      },
      {
        status:
          error instanceof AgentError
            ? error.status
            : error instanceof SyntaxError
              ? 400
              : 502,
        headers,
      }
    )
  } finally {
    active--
  }
}
