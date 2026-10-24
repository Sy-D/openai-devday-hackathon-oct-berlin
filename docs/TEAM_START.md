# FORMA: team startup and work lanes

Use the [planning Page](https://chatgpt.com/space/page_d8c7928de5848191a983913da6ed1e4c) for the authoritative checklist and the [Excalidraw board](https://link.excalidraw.com/l/44SXhWFHIar/5fLHSSwDGK8) to explain the system. `docs/HANDOFF.md` records publication status and remaining blockers.

## Start a clean copy

Once the integration branch has been published, use Node **22.12 or later**, Git and npm:

```sh
git clone --branch codex/forma-template-integration https://github.com/Sy-D/openai-devday-hackathon-oct-berlin.git
cd openai-devday-hackathon-oct-berlin
npm ci
npm run dev -- --hostname 127.0.0.1
```

Use npm and `package-lock.json` for the working install. The `postinstall` script applies the maintained `metal-fx` patch and recognizes an already patched installation. Let that script run; an incompatible patch stops installation with a diagnostic.

Next.js uses port **3000** by default. Open **http://127.0.0.1:3000** for the supplier dashboard or **http://127.0.0.1:3000/planning** for production planning. Both use the same application shell. `/api/assistant` and `/api/health` are native Next routes on that server; no separate API process is needed. Stop the server with Ctrl+C. If the port is occupied, use another port with `--port` or stop only the conflicting process you own. Before publication, use the handoff and publication status in `docs/HANDOFF.md`.

The supplier dashboard uses the supplied CSV dataset; production planning uses its own synthetic orders and factories. They share navigation, but there is no automatic mapping between a supplier-risk score and a production route.

No AI credentials are required to explore those datasets or use the production demo. The production copilot must label its deterministic fallback. For a real OpenAI response, follow `docs/AI.md` and configure optional server-side credentials in the ignored `.env` file. The supplier research features have a separate Python/Nebius/Tavily setup described in `deep-research-agent/README.md`. Configured credentials alone do not prove either integration works. Production scenario data remains local to each browser.

## Check your setup

```sh
npm run build
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
```

The browser-test configuration starts Next at **http://127.0.0.1:5174** using `npm run dev -- --hostname 127.0.0.1 --port 5174`. It may reuse a server already running there. Keep that port for the tested checkout and run the demo tests without a live OpenAI key, because several scenarios verify the labelled fallback. A successful build alone does not verify the browser or a live model call.

For a quick manual check, open **Production planning** in the shared sidebar or visit `/planning`. Click **Run demo**, then **Compare routes** for FM-2048 in **Needs action**. Confirm Balanced, simulate the Dresden disruption, and confirm Fastest. The action should clear, return after the delay, and clear after recovery. Refresh once to verify persistence, then reset. Also visit `/` to check the supplier dashboard and shared navigation. Use [the three-minute script](DEMO.md) for the presentation.

## Proposed work lanes

These are ownership boundaries for the team to assign, not commitments made on anyone's behalf.

| Lane | Primary files | Finish condition |
| --- | --- | --- |
| Shared interface | `components/dashboard/`, `app/planning/`, `src/components/`, `src/styles.css` | Both routes work in the shared shell; production actions stay above details on desktop and mobile. |
| Supplier intelligence | `lib/`, `data/`, supplier dashboard components | Dataset loading, supplier search and comparison work; supplier evidence is distinguished from production mock data. |
| Planning behavior | `src/lib/`, `src/data/network.ts` | Cost, capacity, assembly and deadline calculations agree; changed confirmations require review. |
| Production assistant | `app/api/assistant/`, `app/api/health/`, `server/`, `AssistantDrawer.tsx` | Current plan context is validated; suggestions need explicit confirmation; live and demo states stay distinct. |
| Product and presentation | Planning Page, Excalidraw, `docs/DEMO.md` | One operator/problem/story is agreed and a presenter rehearses it within three minutes. |

Before touching another lane's files, tell its owner. Keep each change on a feature branch and compare with current `main` before opening a pull request.

## Continue the template integration

The Next.js supplier-risk template arrived in `main` at `baa6a5c`. The integration preserves the supplier dashboard at `/` and places the production planner at `/planning` inside `AppShell`. The first Vite draft is preserved on `codex/forma-first-draft`; new work belongs on the integration branch or a feature branch based on it.

Inspect new template commits before merging and preserve teammates' changes. Keep **Needs action** before production metrics and drill-downs. Preserve scenario validation, confirmation warnings, the no-action state, keyboard labels and mobile next-action buttons. Keep planner styles scoped so they do not alter the supplier dashboard. Run the affected checks and both routes after integration. Update the Page and Excalidraw to match the resulting code, then record the verified commit in the handoff.

## Verification record

Historical first-draft check: on 24 October 2026, a fresh local clone of `c86ffed` installed from the lockfile, built successfully and passed all 34 planner/API checks with Node 24.19.0. It contained no `.env` file, and the running API reported `demo` / `not_configured`. All 15 browser scenarios passed against that Vite draft on isolated ports using an installed Chromium-compatible browser. The rehearsal covered recovery, disruption, stale confirmations, no-capacity/deadline cases, no-action state, persistence, reset and the real local demo API.

The combined Next integration at 535ff69 also passed its production build, 45 unit/API checks and 19 browser checks against the production server. A fresh clone from the integration bundle installed successfully with npm ci and applied the dependency patch. See `docs/HANDOFF.md` for subsequent verification and publication status. A check on this machine is not a teammate-machine check, spoken presentation rehearsal or live OpenAI verification.
