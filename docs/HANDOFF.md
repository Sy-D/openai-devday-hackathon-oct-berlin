# FORMA: application handoff

Updated 24 October 2026. The incoming supplier dashboard and FORMA production planner now share one Next.js application. Production build, unit tests and browser checks pass. Publication remains blocked; lint still has known failures.

## Start here

In the existing checkout on `codex/forma-template-integration`, use Node.js 22.12 or later:

```sh
npm ci
npm run dev
```

Open **http://localhost:3000** for supplier risk and **http://localhost:3000/planning** for production planning. Both use the same Next server. The planner calls native `/api/assistant` and `/api/health` routes; it does not require a separate API process or a frontend proxy.

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

The coordinator's final integrated run passed the production build, **45 unit
tests** and **19 browser tests against the production server** (12.2 seconds).
`/`, `/planning`, `/compare` and `/api/health` returned HTTP 200. DuckDB's
shared library and the supplier CSV were included in the server trace.

Overall lint does **not** pass: 55 incoming custom anti-slop rule failures and
an App state-update-in-effect finding remain. These findings must stay visible
rather than being represented as a clean lint run. Reproduce checks with:

```sh
npm run typecheck
npm test
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

Unit tests cover planning, actions, scenarios, persistence, assistant validation, native Next request handling and the bounded live check. Browser checks exercise `/planning` and navigation from the incoming dashboard. Screenshots in `outputs/` support visual review but do not establish provider access or teammate setup.

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

The first FORMA draft is preserved at **`c89d43b` on `codex/forma-first-draft`**. The supplier template arrived on `origin/main` at **`baa6a5c`**. The combined work is on **`codex/forma-template-integration`** in the shared local checkout.

GitHub has rejected pushes with HTTP 403 because `carldiederichs` lacks write access to [Sy-D/openai-devday-hackathon-oct-berlin](https://github.com/Sy-D/openai-devday-hackathon-oct-berlin). The integrated branch has not been published. The repository already has a `main` branch containing the supplier template.

The repository owner must grant write access. After the integration is committed and checks are complete, push normally and verify the remote SHA:

```sh
git push -u origin codex/forma-template-integration
```

Do not force-push over teammates' work. Once publication succeeds, teammates can clone the integrated branch:

```sh
git clone --branch codex/forma-template-integration https://github.com/Sy-D/openai-devday-hackathon-oct-berlin.git
cd openai-devday-hackathon-oct-berlin
npm ci
npm run dev
```

Any earlier `forma-hackathon-work.bundle` is a historical standalone draft, not this integration. A replacement bundle must be generated from the final integration commit before it can serve as an offline handoff. Neither a local branch nor a bundle counts as GitHub publication or deployment.

Hosting has been requested at `forma-supply-chain.vercel.app` after the first
push. Deployment authorization and access are still pending; no Vercel
deployment has been performed. The requested name is not a verified live URL.
