# FORMA production planning

An interactive hackathon prototype for planning a distributed manufacturing order across 3D printing, purchased components, assembly and delivery.

## Start locally

Requires Node.js 22.12 or later. Use npm and the root `package-lock.json`.

```sh
npm ci
npm run dev
```

Open **http://localhost:3000/planning**. The supplier dashboard is at **http://localhost:3000**. Both run inside one Next.js application with shared navigation. The planning assistant uses native `/api/assistant` and `/api/health` routes on the same server. Stop the server with Ctrl+C. The planner needs no database, Python setup or map API.

The application works with synthetic data immediately. To enable live OpenAI responses, create the ignored root `.env` from `.env.example` if it does not already exist, set `OPENAI_API_KEY`, and restart `npm run dev`. Preserve any existing provider settings. Do not put the key in frontend code or a variable beginning with `NEXT_PUBLIC_` or `VITE_`. Supplier AI uses separate Nebius/Tavily settings; those are not needed for planning. See [assistant setup](AI.md) for the exact API contract and fallback behaviour.

## Try the demonstration

1. Click **Run demo** to reset the order and activity state. The **Needs action** section at the top shows the affected orders and the next decision. Click **Compare routes** on FM-2048.
2. Compare **Lowest cost**, **Balanced**, and **Fastest** for order FM-2048. The map, price, arrival and component routing change together.
3. Inspect Lyon on the map to see why its printer is incompatible. Open **Delivery timeline** to see assembly waiting for the last component.
4. Ask the copilot for the cheapest plan that arrives on time. Review its suggestion, then separately confirm the plan.
5. Confirm **Balanced**. The order returns to track and the attention count falls from three to two. Refreshing keeps this decision.
6. Click **Simulate disruption**. Dresden's queue gains 24 hours, making the balanced plan late. Its action card returns with a recovery step. Select and confirm **Fastest** to recover through Munich.
7. Restore capacity, then change the quantity to **42** and apply the scenario. Balanced exceeds capacity; Fastest can deliver 42 kits in 49h for €13,081. The old confirmation remains a snapshot until you review and reconfirm. Try **49** kits to see the explicit no-capacity state.
8. Resolve all three affected orders through their action cards to see **No actions required**. Reset for the next presentation.

See [the three-minute presentation script](DEMO.md), [research and assumptions](RESEARCH.md), [team startup and work lanes](TEAM_START.md), and [team handoff](HANDOFF.md).

## What is implemented

- Responsive dashboard with order-level actions above metrics, clear reasons and next steps, searchable/filterable orders, network and activity views.
- Editable simulated quantity and deadline, with recomputed eligibility, costs, assembly time and recommendations.
- Confirmation snapshots that flag changed inputs, late delivery, infeasible capacity or changed estimates for review.
- Interactive schematic European map with factory details and route comparison.
- Process, material, qualification and batch-capacity checks.
- Parallel component preparation, purchased-part lead time, transport, assembly and final delivery calculations.
- Full-order cost breakdown and explicit acknowledgement before accepting a late plan.
- Demo state persistence, disruption simulation, reset and plan export.
- OpenAI Responses integration, constrained to explaining and suggesting existing plans, plus explicitly labelled deterministic fallback.

## Verification

```sh
npm run typecheck
npm run build
npm test
npx playwright install chromium
npm run test:e2e
```

`npm run build` creates the Next.js production build in `.next/`. `npm run typecheck` checks TypeScript separately. `npm test` runs planner, assistant, native request-handler and live-check tests. Playwright checks action navigation and the empty state, changed quantity/deadline, capacity failures, confirmation snapshots, persistence, disruption, current copilot context, provider status, capability inspection, search and mobile layout.

For an existing compatible Chromium installation, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable before running browser tests. This is optional; normal installations use Playwright's downloaded Chromium.

After configuring the server-side key, `npm run test:live` makes one bounded real provider request and verifies the current planning recommendation. It fails clearly if credentials are missing or the API falls back to demo mode. Passing mocked tests does not establish live provider access.

After `npm run build`, use `npm start` to serve the production build on port 3000 with the same native API routes. Public hosting and user authentication are not configured. Final integrated validation results belong in [the handoff](HANDOFF.md).

## Model and limits

The demo clock is 27 October 2026 at 08:00 CET. The urgent order's deadline is 60 hours later. Each kit contains one SLS PA12 housing, two LPBF AlSi10Mg fingers, and one purchased actuator. The first version compares three predefined production combinations; it does not search every possible route.

Every factory, order, cost, capacity and transport input is synthetic. Map borders and routes are schematic. Ready times bundle print/purchase preparation and assumed finishing; finishing steps and inspections are not independently scheduled. Assembly begins when all components arrive; assembly slots are assumed available. Print time is fixed for one capacity-limited batch. Assembly hours scale with kit quantity from the 12-kit reference order; transport costs remain fixed per leg. Quantity is limited to whole kits from 1 to 500; deadline is 1 to 336 hours from the fixed demo clock. Forecast confidence is an illustrative heuristic, and emissions are placeholder scenario values. No real factory is contacted, no capacity is reserved, and no real order is placed.

State is stored in this browser, not shared across teammates. An API key is required to verify actual OpenAI responses. Existing platform capabilities are documented in the research notes; this prototype does not claim Siemens or Schaeffler lack solutions.

## Source map

| Location | Purpose |
| --- | --- |
| `app/planning/` | Next page and client entry point inside the shared app shell |
| `app/api/assistant/route.ts`, `app/api/health/route.ts` | Native Next API entry points |
| `src/data/network.ts` | Factories, component requirements, orders and demo clock |
| `src/lib/planner.ts` | Eligibility, route timing, costs and recommendation |
| `src/lib/actions.ts` | Order-level reasons and next decisions |
| `src/lib/scenario.ts`, `src/lib/demo-state.ts` | Simulated inputs and saved-state validation |
| `src/App.tsx` | Dashboard views and confirmation state |
| `src/components/NeedsAction.tsx`, `ScenarioControls.tsx` | Replaceable action and input interfaces |
| `src/components/NetworkMap.tsx` | Schematic map and factory inspection |
| `src/components/AssistantDrawer.tsx` | Copilot conversation and reviewed suggestion |
| `server/assistant.ts` | Validated model context, Responses request and fallback |
| `server/production-api.ts` | Shared native request handling, limits and process-local readiness |
| `server/index.ts` | Retained Node HTTP adapter for standalone smoke and unit tests |
| `scripts/live-smoke.ts` | One bounded request that requires actual live provider success |
| `docs/` | Research, pitch, integration and team handoff |
| `outputs/` | Screenshots and editable Excalidraw export for review |

The [shared planning Page](https://chatgpt.com/space/page_d8c7928de5848191a983913da6ed1e4c) contains the team checklist. The [editable Excalidraw board](https://link.excalidraw.com/l/44SXhWFHIar/5fLHSSwDGK8) explains the current system and component boundaries. No runtime secrets are needed outside your ignored `.env` file.
