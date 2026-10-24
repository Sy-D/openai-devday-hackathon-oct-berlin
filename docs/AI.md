# Forma assistant

The assistant explains the plans produced by the local planner. It cannot create routes, change capacity, reserve a factory or assign an order. A suggested plan is an existing, feasible plan ID; the user reviews and confirms it in the dashboard.

## Run

Use Node 22.12 or later (verified here with Node 22.22.2). `npm run dev` starts the Next.js application. The supplier-risk dashboard is at `/`; the production planner is at `/planning`. Native Next route handlers serve `/api/assistant` and `/api/health` in the same application, so the browser does not depend on a second local API server or a Vite proxy.

For live OpenAI responses, copy `.env.example` to `.env`, set `OPENAI_API_KEY` in that local file and restart the application. The key belongs only on the server. Never add a `NEXT_PUBLIC_` or `VITE_` prefix to it. `OPENAI_MODEL` is optional; the default is `gpt-6-astra`, as shown in the official Structured Outputs documentation checked on 24 October 2026. Account access to that model is not assumed; a different Responses-compatible model can be configured.

Without a key, the API returns deterministic route advice with `mode: "demo"` and text beginning “Demo analysis”. A provider error, timeout, refusal, incomplete response, malformed output or invalid route suggestion also returns a clearly disclosed demo response. No live API call has been verified unless the health endpoint reports a successful response or the dashboard receives `mode: "live"`.

## Contract

`POST /api/assistant`, with `Content-Type: application/json`:

```ts
{
  message: string, // 1–2,000 characters
  context: {
    order: { id: string, name: string, quantity: number, dueHours: number, customer?: string },
    plans: Plan[], // Current application plans; 1–12 entries with unique IDs
    factories: Factory[],
    selectedPlanId?: string
  }
}
```

The server keeps only relevant fields, verifies numeric ranges and checks that each plan's delivery buffer equals the order deadline minus its arrival time. The supplied context is a demo snapshot, not an authenticated production system of record.

```ts
// Successful HTTP response, including a disclosed provider fallback:
{
  reply: string,
  suggestedPlanId?: string,
  mode: "live" | "demo",
  reason?: "not_configured" | "provider_unavailable"
}
```

The UI should render `reply` as text, show the returned `mode`, and offer a separate action to select `suggestedPlanId`. Invalid requests return HTTP 400; oversized requests return 413. The HTTP body limit is 96 KiB, at most four assistant requests run concurrently, and provider calls time out after 25 seconds.

`GET /api/health` returns:

```ts
{
  mode: "live" | "demo", // Whether an API key is configured
  ready: boolean, // True only after a validated live reply in this process
  status: "not_configured" | "unverified" | "verified" | "unavailable",
  model?: string
}
```

A configured key is not proof of network access, valid billing or model availability. Use `ready` and `status` for that distinction. Health does not send a paid API request. Readiness belongs to one running Node process; a restart or a different serverless instance begins unverified. A validated live reply is the direct evidence for the request that produced it.

## Verify a real connection

After setting the server-side key and optional model in the project's ignored `.env`, run:

```sh
npm run test:live
```

This command starts a temporary loopback API on a free port, uses the repository's current FM-2048 data and planner, and sends **one real OpenAI request** through the shared validated assistant core. The temporary server uses the retained Node HTTP adapter; Next route integration is checked separately by the route and browser tests. The command verifies that the response is live, suggests the cheapest feasible on-time plan, and changes the temporary server's health from unverified to verified. It does not change orders or browser state, print credentials, or expose the provider's raw response. The request uses the server's 25-second timeout; the temporary server closes when the check finishes.

- Exit **0**: the live response and planning suggestion passed verification.
- Exit **1**: the request failed, fell back to demo mode or returned an unsuitable suggestion. Live planning advice is not verified.
- Exit **2**: the key is missing or the local environment file cannot be loaded; no provider request was sent.

The temporary process verifies this invocation only. Restarted app servers begin unverified and become verified after their own validated live response. Missing credentials remain an external setup task; passing the mocked test below does not close it.

```sh
npx tsx --test scripts/live-smoke.test.ts
```

## Implementation and validation

`server/assistant.ts` calls `POST https://api.openai.com/v1/responses` using native `fetch`. Structured Outputs constrain the reply to a text field and a nullable plan ID selected from the current feasible plans. The server validates the returned ID again. Requests set `store: false`, send no tool definitions, and contain no key in the JSON body.

`server/production-api.ts` supplies the native Next handlers. It accepts same-origin browser requests, reads at most 96 KiB of JSON, limits in-process concurrency, redacts provider errors and disables response caching. `server/index.ts` remains the loopback-only adapter for isolated provider/HTTP verification. Same-origin checks and in-process limits are not user authentication or shared rate limiting; a public deployment still needs an access-control decision before exposing a configured key-backed endpoint.

Run `npx tsx --test server/assistant.test.ts server/production-api.test.ts` for request validation, route selection, provider failure, output validation, HTTP contracts, same-origin checks, streaming body limits and concurrency. Provider responses in tests are mocked; those tests do not prove a real API connection. Run `npm run typecheck` for the integrated application type check.

Official sources: [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) and [Responses API reference](https://developers.openai.com/api/reference/resources/responses/methods/create). The first source was fetched and used to verify the endpoint, schema format and model example. The full second page exceeded the documentation fetch limit; it is a navigation link, not independent verification.
