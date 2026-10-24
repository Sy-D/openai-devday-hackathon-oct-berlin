# Forma assistant

The assistant explains the plans produced by the local planner. It cannot create routes, change capacity, reserve a factory or assign an order. A suggested plan is an existing, feasible plan ID; the user reviews and confirms it in the dashboard.

## Run

Use Node 22 or later. `npm run dev` starts both the API and Vite application. For separate terminals, use `npm run dev:api` and `npm run dev:ui`. Vite forwards `/api` to `http://127.0.0.1:8789`.

For live OpenAI responses, copy `.env.example` to `.env`, set `OPENAI_API_KEY` in that local file and restart the API. The key belongs only on the server. Never add a `VITE_` prefix to it. `OPENAI_MODEL` is optional; the default is `gpt-6-astra`, as shown in the official Structured Outputs documentation checked on 24 October 2026. Account access to that model is not assumed; a different Responses-compatible model can be configured.

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

A configured key is not proof of network access, valid billing or model availability. Use `ready` and `status` for that distinction. Health does not send a paid API request.

## Implementation and validation

`server/assistant.ts` calls `POST https://api.openai.com/v1/responses` using native `fetch`. Structured Outputs constrain the reply to a text field and a nullable plan ID selected from the current feasible plans. The server validates the returned ID again. Requests set `store: false`, send no tool definitions, and contain no key in the JSON body. The server binds to loopback and rejects remote browser origins; this is a local hackathon service, not a publicly hosted authenticated API.

Run `npx tsx --test server/assistant.test.ts` for request validation, route selection, provider failure, output validation and real HTTP endpoint tests. Provider responses in tests are mocked; those tests do not prove a real API connection. Run `npx tsc -p server/tsconfig.json` for the server type check.

Official sources: [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) and [Responses API reference](https://developers.openai.com/api/reference/resources/responses/methods/create). The first source was fetched and used to verify the endpoint, schema format and model example. The full second page exceeded the documentation fetch limit; it is a navigation link, not independent verification.
