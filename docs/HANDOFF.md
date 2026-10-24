# Current handoff: live incidents and hardware references

The live workspace defaults to `/`; the deterministic shipment rehearsal is now `/?mode=demo`. `/incidents` receives source-controlled updates, with filters, evidence links, freshness and explicit history. The default overview contains ten manufacturer-backed candidates and unknown shipment states, not fictional supplier assignments. See [source coverage](LIVE_INCIDENT_SOURCES.md) and [product provenance](PART_PROVENANCE.md).

The component recovery banner selects the recommended available route and immediately reveals/focuses its review section. It does not confirm or book anything. On mobile, selecting hardware brings its inspection into view; closing returns keyboard focus to the trigger. Reset view restores the base camera, cutaway, selection and filters. Delivery-action and inventory overflow repairs are included.

Verification for this change: 84 unit/API tests; 31 existing production-browser tests; eight added overview tests; provider HTTP/SSE smoke, including GET success and POST/PUT/DELETE 405. Source failure, stale retention, provider updates/removals, stream disconnect and invalid snapshot handling are covered. Browser checks include 320/390/768/1440px overview layouts. Run the commands below to verify your checkout.

Outstanding external items: a real OpenAI reply needs server-side credentials; Vercel workspace authorization remains deferred; a teammate still needs to verify startup on another machine. Simon's non-design supplier code is being removed separately. No open removal PR was visible at implementation time; preserve and integrate it when published. Shared navigation no longer links to those features.

For this project, finish implementation, refresh the preview and publish before updating Notion and Excalidraw. Live observations do not prove shipment impact, product qualification or booked transport.

---

## Historical implementation handoff

The sections below describe the preceding integration and its separate datasets. Where they conflict, the current handoff above and the source files take precedence.

# FORMA: application handoff

Updated 24 October 2026.

## Current DSX overview extension

The new landing page at `/` shows a selectable 3D container with ten subsystems, wireframe and 2D views. Red/amber delivery markers lead to `/planning?component=ID`, which compares transport routes and stores explicit recovery confirmations. `/api/disruptions` streams simulated incidents via SSE; closed links invalidate routes, delays recalculate ETA, and changed confirmations require review. Simon's supplier dashboard is preserved at `/suppliers`; the original manufacturing demo remains at `/planning`.

Simon’s frontend supplies the design template across overview, recovery and manufacturing screens. Shared theme tokens, buttons, panels, motion and light/dark mode replace the earlier separate design. **Reset view** clears filters and selection and restores the solid 3D cutaway with full camera framing. Simon’s supplied screenshot and DSX video informed the blue technical wireframe, part/supplier search, delivery-state filters, white/green modular shell, cable details and separate roof cooling deck. **Cutaway**, **Enclosed** and **Exploded** views animate the assembly layers; selecting a part reveals its interior again. See [DESIGN_REFERENCES.md](DESIGN_REFERENCES.md).

The DSX overview was merged into main through PR #3 at `b871c29`. The assembly-view follow-up is on `codex/dsx-assembly-views`; after its merge, teammates should use main. Read [DSX_OVERVIEW.md](DSX_OVERVIEW.md) for the interaction, stream lifecycle and demo; [DSX_DATA.md](DSX_DATA.md) describes the fictional dataset. This extension adds no live incident provider, actual bookings or hardware telemetry. Vercel remains deferred.

## Previous integrated application baseline

The incoming supplier dashboard and FORMA production planner now share one Next.js application. The integration and first-draft branches are published. PR #2 merged the integration into main; Vercel authorization is deferred.

## Start here

Use the current main checkout after the assembly-view follow-up merges, with Node.js 22.12 or later:

```sh
npm ci
npm run dev
```

Open **http://localhost:3000** for the pod overview (supplier risk is at `/suppliers`) and **http://localhost:3000/planning** for production planning. Both use the same Next server. The planner calls native `/api/assistant` and `/api/health` routes; it does not require a separate API process or a frontend proxy.

No credentials or Python setup are needed for bundled supplier browsing or the planning demo. Supplier maps and climate panels use public network services. Optional supplier AI needs Python and Nebius/Tavily configuration; optional planning AI uses OpenAI. Follow [the root README](../README.md) and [AI setup](AI.md) for these separate settings.

The [planning Page](https://chatgpt.com/space/page_d8c7928de5848191a983913da6ed1e4c) holds the unified team checklist. The [shared Excalidraw board](https://link.excalidraw.com/l/44SXhWFHIar/5fLHSSwDGK8) explains the system and component boundaries. Keep code milestones, the checklist and board aligned when changing either feature area.

## Current implementation

The incoming supplier dashboard provides portfolio filters, maps, profiles, comparison of up to 20 suppliers, export, company research, and dataset analyst chat. Its bundled 10,000-row dataset is anonymized. Supplier research writes local CSV records; the text-to-SQL analyst queries a generated DuckDB database. Neither is connected to the production planner's synthetic network yet.

At `/planning`, **Needs action** appears above the metrics. It lists each affected order, the reason and next decision. It covers late delivery, changed confirmations, newly infeasible routes, insufficient capacity and impossible deadlines. Actions open the correct order and relevant controls. Valid confirmations remove cards; resolving every affected order displays **No actions required**. Late confirmations remain flagged.

Planning includes a schematic Europe map, three route alternatives, factory capability inspection, component routing, assembly timing, order search and filters, activity, export and browser-local persistence.

**What if the order changes?** accepts whole quantities from 1 to 500 kits and deadlines from 1 to 336 hours from the fixed demo clock. Applying inputs recomputes capacity, cost, assembly hours, delivery buffer and recommendation. Draft fields do not alter the plan. Confirmation snapshots retain their original quantity and deadline. Changed inputs or estimates require review; restoring the exact original inputs can restore an unchanged valid confirmation. The saved-state parser preserves compatible earlier confirmations and ignores malformed entries.

The production assistant uses the current order, recomputed plans and current factory queues. Suggestions cannot confirm a plan. The UI distinguishes missing credentials, configured but unverified credentials, verified live replies and fallback. A configured key alone is never labelled as a verified connection. No real OpenAI response has been verified in this run because no key is configured. The bounded check is `npm run test:live`; see [AI.md](AI.md).

## Concrete planning demo

FM-2048 needs 12 gripper kits in Berlin within 60 hours of 27 October 2026, 08:00 CET. Each kit contains one SLS PA12 housing, two LPBF AlSi10Mg fingers and one purchased actuator. Assembly starts after the last component arrives.

| Plan | Cost | Delivery | Deadline buffer | Assembly |
| --- | ---: | ---: | ---: | --- |
| Lowest cost | €2,596 | 72h | 12h late | Prague |
| Balanced | €3,222 | 49h | 11h early | Leipzig |
| Fastest | €4,423 | 34h | 26h early | Leipzig |

Confirm Balanced, then simulate the 24-hour Dresden delay. Balanced becomes 73h, and its action card returns. Fastest uses Munich and remains 34h.

After restoring capacity, apply 42 kits / 60h. Balanced exceeds Dresden's finger capacity. Fastest costs €13,081 and delivers at 49h after 21h of assembly. At 49 kits every route is infeasible. At 12 kits / 33h every feasible route is late. See [DEMO.md](DEMO.md) for the presentation script.

## Verification status

The DSX extension passes the production build with TypeScript checking, **68 unit/API tests** and **28 browser tests against the production server**. Browser coverage includes cutaway/enclosed/exploded assembly views, reduced-motion behavior, part search and delivery filters, camera reset, 3D/wireframe/2D and WebGL fallback, mobile navigation, actual SSE arrivals, recovery confirmation and stale-route review, supplier browsing and the existing planner. Desktop, dark mode and mobile renders were visually inspected. Supplier CSV and native DuckDB libraries remain included in the server trace.

`npm run lint` passes with zero errors and two existing unused-code warnings in the supplier workspace panels. Small planning guidance text is checked at 4.5:1 contrast in both themes. The build still reports the existing dynamic Python path tracing warning; this does not establish deployment readiness for the Python backend.

Reproduce checks with:

```sh
npm run typecheck
npm test
npm run lint
npm run build
npx playwright install chromium
PLAYWRIGHT_USE_PRODUCTION=1 npm run test:e2e
```

Screenshots in `outputs/` support visual review but do not establish provider access or teammate setup.

`npm run test:live` requires a configured OpenAI key and must return a real, validated provider reply. The current missing-key result is an external setup blocker. Live supplier research, supplier analyst calls and the integrated Docker runtime also need separate environment verification. Do not treat earlier standalone FORMA test counts as the final integrated result.

## Model and storage limits

The production planner compares three predefined alternatives. It does not search the whole network. Printing assumes one fixed-duration batch per site within capacity; per-unit production and assembly costs scale with quantity. Assembly duration scales from the 12-kit reference; transport cost stays fixed per leg. The same illustrative BOM is reused for every mock product name.

Factory capabilities, prices, reliability, capacities, queues, orders and emissions are synthetic. Confidence is a heuristic, not a calibrated probability. The on-time headline counts orders with no current action; it is not historical delivery performance. Working calendars, independent finishing/QA steps, assembly queues and cross-order capacity reservations are not modelled.

Planning state stays in the current browser. Supplier research stays in local output files, or the Docker volume. There is no shared operational backend, authentication, real booking or public deployment. Same-origin checks on the production assistant are not user authentication. See [ARCHITECTURE.md](ARCHITECTURE.md) for data boundaries and API limitations.

## Continue without overlapping work

- Shared shell and supplier UI: `components/dashboard/`, `components/analyst/`, `app/page.tsx`, `app/compare/` and `app/supplier/`.
- Supplier data and research: `lib/supplier-data.ts`, `lib/agent-stream.ts`, `scripts/ask.py`, `scripts/create_duckdb.py` and `deep-research-agent/`.
- Planning UI: `app/planning/`, `src/components/NeedsAction.tsx`, `ScenarioControls.tsx`, `NetworkMap.tsx` and `src/styles.css`. Preserve prominent actions when changing the design.
- Planning rules: `src/lib/planner.ts`, `actions.ts`, `scenario.ts`, `demo-state.ts` and `src/data/network.ts`.
- Production AI: `src/components/AssistantDrawer.tsx`, `server/assistant.ts`, `server/production-api.ts`, native Next routes and [AI.md](AI.md). `server/index.ts` remains a standalone test adapter.
- Product and rehearsal: shared Page, Excalidraw and [DEMO.md](DEMO.md). Confirm team ownership and final demo scope together.
- After publication, verify `npm ci` and the two routes on a teammate's machine. Local checks here do not establish that handoff.

## Publication

The first FORMA draft remains on `codex/forma-first-draft` at `c89d43b`. Simon’s frontend (`baa6a5c`) and the original integration were merged into main at `9532785` through [PR #2](https://github.com/Sy-D/openai-devday-hackathon-oct-berlin/pull/2). The DSX overview and shared styling were merged through [PR #3](https://github.com/Sy-D/openai-devday-hackathon-oct-berlin/pull/3) at `b871c29`. The assembly-view follow-up is on `codex/dsx-assembly-views`.

After the assembly-view follow-up merges, start from main:

```sh
git clone --branch main https://github.com/Sy-D/openai-devday-hackathon-oct-berlin.git
cd openai-devday-hackathon-oct-berlin
npm ci
npm run dev
```

Earlier bundle files preserve the previous integration. Use main after the follow-up merge for the DSX model, assembly views, recovery workflow and shared frontend styles.

Hosting is requested at `forma-supply-chain.vercel.app`. Carl chose to authorize
the Vercel workspace later, so deployment is deferred. No Vercel project
connection or deployment has been completed. The requested name is not a live URL.
