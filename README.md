# FORMA

An interactive hackathon prototype for planning a distributed manufacturing order across 3D printing, purchased components, assembly and delivery.

## Start locally

Requires Node 22 or later.

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. The command starts the Vite frontend and the assistant API on port 8789. Both bind to the local computer. Stop both with Ctrl+C. There is no database or map API to configure.

The application works with synthetic data immediately. To enable live OpenAI responses, copy `.env.example` to `.env`, set `OPENAI_API_KEY` in that file, and restart `npm run dev`. Do not put the key in frontend code or in a variable beginning with `VITE_`. See [assistant setup](docs/AI.md) for the exact API contract and fallback behaviour.

## Try the demonstration

1. Click **Run demo** to reset the order and activity state.
2. Compare **Lowest cost**, **Balanced**, and **Fastest** for order FM-2048. The map, price, arrival and component routing change together.
3. Inspect Lyon on the map to see why its printer is incompatible. Open **Delivery timeline** to see assembly waiting for the last component.
4. Ask the copilot for the cheapest plan that arrives on time. Review its suggestion, then separately confirm the plan.
5. Confirm **Balanced**. The order returns to track and the attention count falls from three to two. Refreshing keeps this decision.
6. Click **Simulate disruption**. Dresden's queue gains 24 hours, making the balanced plan late. Select and confirm **Fastest** to recover through Munich.

See [the three-minute presentation script](docs/DEMO.md), [research and assumptions](docs/RESEARCH.md), and [team handoff](docs/HANDOFF.md).

## What is implemented

- Responsive dashboard with metrics, searchable/filterable orders, network and activity views.
- Interactive schematic European map with factory details and route comparison.
- Process, material, qualification and batch-capacity checks.
- Parallel component preparation, purchased-part lead time, transport, assembly and final delivery calculations.
- Full-order cost breakdown and explicit acknowledgement before accepting a late plan.
- Demo state persistence, disruption simulation, reset and plan export.
- OpenAI Responses integration, constrained to explaining and suggesting existing plans, plus explicitly labelled deterministic fallback.

## Verification

```sh
npm run build
npm test
npx playwright install chromium
npm run test:e2e
```

`npm run build` checks frontend and server types and creates the frontend in `dist/`. `npm test` runs planner and assistant tests. Playwright checks the browser confirmation path, persistence, disruption, copilot, capability inspection, search and a narrow layout.

For an existing compatible Chromium installation, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable before running browser tests. This is optional; normal installations use Playwright's downloaded Chromium.

`npm run preview` previews only the built frontend. For the complete copilot workflow, use `npm run dev`; production hosting and an authenticated hosted API are not configured.

## Model and limits

The demo clock is 27 October 2026 at 08:00 CET. The urgent order's deadline is 60 hours later. Each kit contains one SLS PA12 housing, two LPBF AlSi10Mg fingers, and one purchased actuator. The first version compares three predefined production combinations; it does not search every possible route.

Every factory, order, cost, capacity and transport input is synthetic. Map borders and routes are schematic. Ready times bundle print/purchase preparation and assumed finishing; finishing steps and inspections are not independently scheduled. Assembly begins when all components arrive; assembly slots are assumed available. Forecast confidence is an illustrative heuristic, and emissions are placeholder scenario values. No real factory is contacted, no capacity is reserved, and no real order is placed.

State is stored in this browser, not shared across teammates. An API key is required to verify actual OpenAI responses. Existing platform capabilities are documented in the research notes; this prototype does not claim Siemens or Schaeffler lack solutions.

## Source map

| Location | Purpose |
| --- | --- |
| `src/data/network.ts` | Factories, component requirements, orders and demo clock |
| `src/lib/planner.ts` | Eligibility, route timing, costs and recommendation |
| `src/App.tsx` | Dashboard views and confirmation state |
| `src/components/NetworkMap.tsx` | Schematic map and factory inspection |
| `src/components/AssistantDrawer.tsx` | Copilot conversation and reviewed suggestion |
| `server/assistant.ts` | Validated model context, Responses request and fallback |
| `server/index.ts` | Local HTTP endpoints and server-side environment loading |
| `docs/` | Research, pitch, integration and team handoff |
| `outputs/` | Verified screenshots and editable Excalidraw export |

No generated application code or runtime secrets are needed outside this repository.
