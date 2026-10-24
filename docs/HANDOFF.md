# FORMA: application handoff

Updated 24 October 2026. The app is ready for local team review. Operational data is synthetic.

## Start here

```sh
git clone --branch codex/hackathon-work https://github.com/Sy-D/openai-devday-hackathon-oct-berlin.git
cd openai-devday-hackathon-oct-berlin
npm ci
npm run dev
```

Requires Node 22 or later. Open http://127.0.0.1:5173 on the computer running the application. The local assistant API uses port 8789. No map service or database is required. The clone command becomes usable when the branch is published; publication status is recorded below.

The [planning Page](https://chatgpt.com/space/page_d8c7928de5848191a983913da6ed1e4c) owns the unified team checklist. The [shared Excalidraw board](https://link.excalidraw.com/l/44SXhWFHIar/5fLHSSwDGK8) explains the system and component boundaries. The planning chat owns both documents; the application chat owns this code and publication. Keep milestones aligned without overlapping edits.

## Current implementation

The top **Needs action** section lists affected orders, a concrete reason and the next decision. It covers baseline late delivery, changed confirmations, newly infeasible routes, insufficient capacity and impossible deadlines. Actions open the correct order and relevant input or plan controls. Valid confirmations remove cards; resolving every affected order displays **No actions required**. Late confirmations remain flagged.

The dashboard includes metrics, a schematic Europe map, three route alternatives, factory capability inspection, component routing, assembly timing, order search and filters, activity, export and local persistence.

**What if the order changes?** accepts whole quantities from 1 to 500 kits and deadlines from 1 to 336 hours from the fixed demo clock. Explicitly applying inputs recomputes capacity, cost, assembly hours, delivery buffer and recommendation. Draft fields do not alter the plan. Confirmation snapshots retain their original quantity and deadline. Changed inputs or estimates require review; restoring the exact original inputs can restore an unchanged valid confirmation. The saved-state parser preserves compatible earlier confirmations and ignores malformed entries.

The assistant uses the current order, recomputed plans and current factory queues. Suggestions cannot confirm a plan. The UI distinguishes missing credentials, configured but unverified credentials, verified live replies and fallback. A configured key alone is never labelled as a verified connection. No real OpenAI response was verified in this run because no API key is configured. Configure `.env` as described in `docs/AI.md`, restart, and verify a real response separately.

## Concrete demo

FM-2048 needs 12 gripper kits in Berlin within 60 hours of 27 October 2026, 08:00 CET. Each kit contains one SLS PA12 housing, two LPBF AlSi10Mg fingers and one purchased actuator. Assembly starts after the last component arrives.

| Plan | Cost | Delivery | Deadline buffer | Assembly |
| --- | ---: | ---: | ---: | --- |
| Lowest cost | €2,596 | 72h | 12h late | Prague |
| Balanced | €3,222 | 49h | 11h early | Leipzig |
| Fastest | €4,423 | 34h | 26h early | Leipzig |

Confirm Balanced, then simulate the 24-hour Dresden delay. Balanced becomes 73h, and its action card returns. Fastest uses Munich and remains 34h.

After restoring capacity, apply 42 kits / 60h. Balanced exceeds Dresden's finger capacity. Fastest costs €13,081 and delivers at 49h after 21h of assembly. At 49 kits every route is infeasible. At 12 kits / 33h every feasible route is late. See `docs/DEMO.md` for the presentation script.

## Verification

- `npm run build`: frontend and server TypeScript plus production Vite build.
- `npm test`: 34 planner, action, persistence and API checks.
- `npm run test:e2e`: 15 browser scenarios covering the actual local API, action navigation, the no-action state, scenarios, outdated confirmations, capacity/deadline failures, recovery, persistence, reset, current copilot context and honest provider status.
- Desktop and mobile screenshots in `outputs/`; the action section and its first next step are visible in the first viewport at 390 × 844 and 1440 × 1000.
- Live OpenAI behaviour has unit tests with a mocked provider; a successful real provider call is still unverified.

## Model limits

The planner compares three predefined alternatives. It does not search the whole network. Printing assumes one fixed-duration batch per site within capacity; per-unit production and assembly costs scale with quantity. Assembly duration scales from the 12-kit reference; transport cost stays fixed per leg. The same illustrative BOM is reused for every mock product name.

Factory capabilities, prices, reliability, capacities, queues, orders and emissions are synthetic. Confidence is a heuristic, not a calibrated probability. The on-time headline counts orders with no current action; it is not historical delivery performance. Working calendars, independent finishing/QA steps, assembly queues and cross-order capacity reservations are not modelled. State is local to this browser; there is no shared operational backend, authentication, real booking or public deployment.

## Continue without overlapping work

- Interface: `src/components/NeedsAction.tsx`, `ScenarioControls.tsx`, `NetworkMap.tsx` and `src/styles.css`. A team UI template is expected but has not been supplied. Preserve action visibility and behaviour when integrating it.
- Planning: `src/lib/planner.ts`, `actions.ts`, `scenario.ts`, `demo-state.ts`, and `src/data/network.ts`.
- AI: `src/components/AssistantDrawer.tsx`, `server/assistant.ts`, `server/index.ts`, and `docs/AI.md`.
- Product and rehearsal: shared Page, Excalidraw and `docs/DEMO.md`. Team ownership and final demo scope remain open.
- Verify teammate setup on a second machine after publication. Local checks here do not prove another machine's setup.

## Publication

Carl authorized pushing the existing branch without overwriting remote work. The remote was empty at the pre-push check; the GitHub connector reported read-only access. The normal Git push outcome is recorded in the final handoff. No deployment was requested.
