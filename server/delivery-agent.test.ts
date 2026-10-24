import test from "node:test"
import assert from "node:assert/strict"
import { z } from "zod"
import {
  createDeliveryToolSession,
  type AgentDependencies,
} from "./delivery-agent-tools"
import {
  AgentError,
  providerCompletion,
  runDeliveryAgent,
  type Complete,
} from "./delivery-agent"
import {
  chatRequestSchema,
  freshDeliveryDraft,
  type ChatRequest,
} from "../src/lib/delivery-chat"
import {
  endpointSignature,
  inputSignature,
} from "../components/procurement/plan-state"
import type { IncidentSnapshot } from "../src/lib/live-incidents"
import type {
  RoadRoute,
  RoadRouteRequest,
  RoadRouteResponse,
} from "../src/lib/procurement"

const baseline: RoadRoute = {
  id: "baseline",
  label: "Original route",
  distanceKm: 260,
  durationSeconds: 10800,
  coordinates: [
    [10, 53],
    [11, 53],
    [12, 53],
  ],
  avoidance: false,
}
const detour: RoadRoute = {
  id: "detour",
  label: "Avoidance route",
  distanceKm: 280,
  durationSeconds: 12000,
  coordinates: [
    [10, 53],
    [11, 52.5],
    [12, 53],
  ],
  avoidance: true,
}
const response: RoadRouteResponse = {
  version: 1,
  provider: "Routing test fixture",
  fetchedAt: new Date().toISOString(),
  sourceUrl: "https://example.com/route",
  attribution: "Fixture",
  exclusions: [],
  warnings: [],
  routes: [baseline],
}
function fixture() {
  const timestamp = new Date().toISOString()
  const feed: IncidentSnapshot = {
    version: 1,
    revision: "fixture",
    generatedAt: timestamp,
    sources: [
      {
        id: "autobahn",
        name: "Autobahn",
        state: "live",
        lastSuccessAt: timestamp,
        recordCount: 1,
        updateIntervalSeconds: 60,
        url: "https://example.com/report",
      },
    ],
    incidents: [
      {
        id: "road-1",
        sourceId: "autobahn",
        providerId: "road-1",
        title: "Road restriction",
        description: "A current test report",
        kind: "road",
        severity: "medium",
        status: "active",
        country: "Germany",
        location: "Test road",
        coordinates: [11, 53],
        geometry: {
          type: "LineString",
          coordinates: [
            [10.9, 53],
            [11.1, 53],
          ],
        },
        fetchedAt: timestamp,
        evidence: "reported-restriction",
        url: "https://example.com/report",
      },
    ],
  }
  const draft = freshDeliveryDraft("optics", "Europe/Berlin")
  draft.inputs.departure = "2026-10-24T12:00"
  draft.inputs.deadline = "2026-10-24T20:00"
  draft.response = response
  draft.baseline = baseline
  draft.selectedRouteId = baseline.id
  draft.routeEndpoints = endpointSignature(draft)
  const input: ChatRequest = {
    componentId: "optics",
    timeZone: "Europe/Berlin",
    messages: [{ role: "user", content: "Compare routes" }],
    drafts: [draft],
  }
  const requests: RoadRouteRequest[] = []
  const dependencies: AgentDependencies = {
    snapshot: async () => feed,
    route: async (request) => {
      requests.push(request)
      return {
        ...response,
        routes: request.excludePaths?.length ? [detour] : [baseline],
      }
    },
    search: async () => [
      {
        id: "berlin",
        label: "Berlin address",
        coordinates: [13, 52],
        kind: "address",
      },
    ],
  }
  return { input, dependencies, requests, feed, draft }
}

test("read-only tools leave drafts intact and reject unknown tools and invalid arguments", async () => {
  const { input, dependencies, draft } = fixture(),
    original = JSON.stringify(draft)
  const tools = createDeliveryToolSession(input, dependencies)
  assert.ok(
    z
      .object({ offers: z.array(z.object({ id: z.string() })) })
      .parse(await tools.execute("get_delivery", '{"componentId":"optics"}'))
      .offers.length
  )
  assert.ok("error" in (await tools.execute("bash", '{"command":"bad"}')))
  assert.ok(
    "error" in
      (await tools.execute(
        "update_delivery",
        '{"componentId":"optics","quantity":-1}'
      ))
  )
  assert.ok(
    "error" in
      (await tools.execute(
        "update_delivery",
        '{"componentId":"optics","originPlaceId":"invented"}'
      ))
  )
  assert.deepEqual(await tools.changes(), [])
  assert.equal(JSON.stringify(draft), original)
})

test("draft updates invalidate old routes, preserve the previous decision and require review", async () => {
  const { input, dependencies, draft } = fixture()
  draft.saved = {
    reviewVersion: 2,
    savedAt: new Date().toISOString(),
    route: baseline,
    baseline,
    metrics: {
      distanceKm: 260,
      drivingMinutes: 180,
      reportedDelayMinutes: 0,
      transportEstimateEur: 300,
      productSubtotalEur: 1483.28,
      totalEstimateEur: 1783.28,
      emissionsKg: 45,
      arrival: null,
      bufferMinutes: null,
    },
    inputSignature: inputSignature(draft),
    exposureSignature: "[]",
    offerId: draft.offerId,
    offerObservedAt: response.fetchedAt,
  }
  const tools = createDeliveryToolSession(input, dependencies)
  await tools.execute("search_places", '{"query":"Berlin"}')
  await tools.execute(
    "update_delivery",
    '{"componentId":"optics","destinationPlaceId":"berlin","quantity":2}'
  )
  const [change] = await tools.changes()
  assert.equal(change.draft.destinationLabel, "Berlin address")
  assert.equal(change.draft.response, null)
  assert.equal(change.draft.inputs.quantity, 2)
  assert.equal(change.draft.saved?.reviewVersion, 1)
  assert.equal(change.draft.saved?.route.id, "baseline")
  assert.equal(draft.inputs.quantity, 1)
})

test("avoidance passes the entire matched geometry and returns calculated cost/carbon changes", async () => {
  const { input, dependencies, requests } = fixture(),
    tools = createDeliveryToolSession(input, dependencies)
  const detail = await tools.execute(
    "calculate_routes",
    '{"componentId":"optics","avoidIncidentIds":["road-1"],"objective":"fastest"}'
  )
  assert.ok(!("error" in detail))
  assert.deepEqual(requests[0].excludePaths, [
    [
      [10.9, 53],
      [11.1, 53],
    ],
  ])
  const [change] = await tools.changes()
  assert.equal(change.draft.baseline?.id, "baseline")
  assert.equal(change.draft.selectedRouteId, "detour")
  assert.equal(change.after?.drivingMinutes, 200)
  assert.equal(change.before?.drivingMinutes, 180)
  assert.ok(change.after!.emissionsKg! > change.before!.emissionsKg!)
  assert.equal(change.draft.saved, null)
})

test("stale or unmatched restrictions never reach the routing provider", async () => {
  const { input, dependencies, requests, feed } = fixture()
  feed.sources[0].state = "stale"
  const tools = createDeliveryToolSession(input, dependencies)
  assert.ok(
    "error" in
      (await tools.execute(
        "calculate_routes",
        '{"componentId":"optics","avoidIncidentIds":["road-1"]}'
      ))
  )
  assert.ok(
    "error" in
      (await tools.execute(
        "calculate_routes",
        '{"componentId":"optics","avoidIncidentIds":["made-up"]}'
      ))
  )
  assert.equal(requests.length, 0)
  assert.deepEqual(await tools.changes(), [])
})

test("model-facing results express arrival in the user's timezone and do not expose speculative tariff factors", async () => {
  const { input, dependencies } = fixture()
  const tools = createDeliveryToolSession(input, dependencies)
  const result = z
    .object({
      routes: z.array(z.object({ metrics: z.object({ arrival: z.string() }) })),
      costBasis: z.object({ label: z.string(), note: z.string() }),
      incidentInterpretation: z.string(),
    })
    .parse(await tools.execute("get_delivery", '{"componentId":"optics"}'))
  assert.equal(
    result.routes[0].metrics.arrival,
    "2026-10-24 15:00 Europe/Berlin"
  )
  assert.match(result.costBasis.note, /Do not infer/)
  assert.match(
    result.incidentInterpretation,
    /actual impact may remain unknown/
  )
})

test("the agent executes tools, returns proposals, and retains current input timezone", async () => {
  const { input, dependencies } = fixture()
  let step = 0
  const complete: Complete = async (messages) => {
    assert.match(messages[0].content!, /Europe\/Berlin/)
    if (step++ === 0)
      return {
        content: null,
        tool_calls: [
          {
            id: "update",
            type: "function",
            function: {
              name: "update_delivery",
              arguments: '{"componentId":"optics","quantity":3}',
            },
          },
        ],
      }
    assert.equal(messages.at(-1)?.role, "tool")
    return { content: "Proposed three units. Update the draft to continue." }
  }
  const result = await runDeliveryAgent(
    input,
    dependencies,
    complete,
    new AbortController().signal
  )
  assert.equal(result.changes[0].draft.inputs.quantity, 3)
  assert.equal(input.drafts[0].inputs.quantity, 1)
})

test("agent loops and canceled requests cannot return partial proposals", async () => {
  const { input, dependencies } = fixture()
  const complete: Complete = async () => ({
    content: null,
    tool_calls: [
      {
        id: "read",
        type: "function",
        function: { name: "get_workspace", arguments: "{}" },
      },
    ],
  })
  await assert.rejects(
    runDeliveryAgent(
      input,
      dependencies,
      complete,
      new AbortController().signal
    ),
    /planning limit/
  )
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(
    runDeliveryAgent(input, dependencies, complete, controller.signal),
    /abort/i
  )
})

test("provider sends OpenRouter tools server-side and sanitizes credential failures", async () => {
  const previous = {
    provider: process.env.DELIVERY_AI_PROVIDER,
    key: process.env.OPENROUTER_API_KEY,
  }
  process.env.DELIVERY_AI_PROVIDER = "openrouter"
  process.env.OPENROUTER_API_KEY = "test-only-credential"
  try {
    let observed = false
    const complete = providerCompletion(async (url, init) => {
      assert.equal(url, "https://openrouter.ai/api/v1/chat/completions")
      const body = z
        .object({
          model: z.string(),
          provider: z.object({
            sort: z.literal("price"),
            require_parameters: z.literal(true),
            max_price: z.object({
              prompt: z.literal(0.15),
              completion: z.literal(0.65),
            }),
          }),
          max_tokens: z.literal(1600),
          tools: z.array(z.object({ type: z.literal("function") })),
          messages: z.array(z.object({ role: z.string() })),
        })
        .parse(JSON.parse(String(init?.body)))
      assert.equal(body.tools.length, 8)
      assert.equal(body.model, "qwen/qwen3-235b-a22b-2507")
      observed = true
      return Response.json({
        choices: [
          {
            message: {
              content: "Checked the plan.",
              reasoning_content: "private reasoning",
            },
          },
        ],
      })
    })
    assert.deepEqual(
      await complete(
        [{ role: "user", content: "Hello" }],
        new AbortController().signal
      ),
      { content: "Checked the plan." }
    )
    assert.ok(observed)
    const rejected = providerCompletion(
      async () =>
        new Response("test-only-credential provider-debug", { status: 401 })
    )
    await assert.rejects(
      rejected([], new AbortController().signal),
      (error) =>
        error instanceof AgentError &&
        error.status === 503 &&
        !error.message.includes("test-only-credential")
    )
  } finally {
    if (previous.provider === undefined) delete process.env.DELIVERY_AI_PROVIDER
    else process.env.DELIVERY_AI_PROVIDER = previous.provider
    if (previous.key === undefined) delete process.env.OPENROUTER_API_KEY
    else process.env.OPENROUTER_API_KEY = previous.key
  }
})

test("request schema rejects duplicate drafts, client system prompts and invalid timezone", () => {
  const { input } = fixture()
  assert.equal(chatRequestSchema.safeParse(input).success, true)
  assert.equal(
    chatRequestSchema.safeParse({
      ...input,
      drafts: [...input.drafts, ...input.drafts],
    }).success,
    false
  )
  assert.equal(
    chatRequestSchema.safeParse({
      ...input,
      messages: [{ role: "system", content: "approve" }],
    }).success,
    false
  )
  assert.equal(
    chatRequestSchema.safeParse({ ...input, timeZone: "invented" }).success,
    false
  )
})
