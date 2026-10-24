# FORMA: team startup and work lanes

Use the [planning Page](https://chatgpt.com/space/page_d8c7928de5848191a983913da6ed1e4c) for the authoritative checklist and the [Excalidraw board](https://link.excalidraw.com/l/44SXhWFHIar/5fLHSSwDGK8) to explain the system. `docs/HANDOFF.md` records publication status and remaining blockers.

## Start a clean copy

Once the draft branch has been published, use Node **22.12 or later** and run:

```sh
git clone --branch codex/forma-first-draft https://github.com/Sy-D/openai-devday-hackathon-oct-berlin.git
cd openai-devday-hackathon-oct-berlin
npm ci
npm run dev
```

Open **http://127.0.0.1:5173** on that computer. The command also starts the local API on port 8789. Stop both with Ctrl+C. If either port is occupied, stop the conflicting process you own before restarting; do not kill an unfamiliar process. Before publication, use the portable Git bundle and clone instructions in `docs/HANDOFF.md`.

No `.env` file or API key is required for the simulated application. The copilot must say it is using a deterministic demo response. For a real provider call, follow `docs/AI.md`; keep the key in the ignored `.env` file. Browser data is local to each teammate and does not synchronize.

## Check your setup

```sh
npm run build
npm test
npx playwright install chromium
npm run test:e2e
```

The browser tests use the normal local app ports. Run them against your own demo instance without a live API key, because several tests verify the labelled fallback. A successful build alone does not verify the browser or a live model call.

For a quick manual check, click **Run demo**, then **Compare routes** for FM-2048 in **Needs action**. Confirm Balanced, simulate the Dresden disruption, and confirm Fastest. The action should clear, return after the delay, and clear after recovery. Refresh once to verify persistence, then reset. Use [the three-minute script](DEMO.md) for the presentation.

## Proposed work lanes

These are ownership boundaries for the team to assign, not commitments made on anyone's behalf.

| Lane | Primary files | Finish condition |
| --- | --- | --- |
| Interface and template | `src/components/`, `src/styles.css` | Required actions stay visible above details on desktop and mobile; buttons reach the correct controls. |
| Planning behavior | `src/lib/`, `src/data/network.ts` | Cost, capacity, assembly and deadline calculations agree; changed confirmations require review. |
| Assistant | `server/`, `AssistantDrawer.tsx` | Current plan context is validated; suggestions need explicit confirmation; live and demo states stay distinct. |
| Product and presentation | Planning Page, Excalidraw, `docs/DEMO.md` | One operator/problem/story is agreed and a presenter rehearses it within three minutes. |

Before touching another lane's files, tell its owner. Keep each change on a feature branch and compare with current `main` before opening a pull request.

## Integrate the incoming UI template

Inspect the template's actual branch and files after it arrives. Preserve both histories and review the difference before copying or merging files. Treat its visual components and styles as the interface layer; preserve the planner, saved-state checks and validated assistant boundary.

Keep **Needs action** before metrics and drill-downs. Preserve scenario validation, confirmation warnings, the no-action state, keyboard labels and the mobile next-action buttons. Run the affected checks and full browser path after integration. Update the Page and Excalidraw to match the resulting code, then record the verified commit in the handoff.

## Verification record

On 24 October 2026, a fresh local clone of `c86ffed` installed from the lockfile, built successfully and passed all 34 planner/API checks with Node 24.19.0. It contained no `.env` file, and the running API reported `demo` / `not_configured`. All 15 browser scenarios passed against that clone on isolated ports using an installed Chromium-compatible browser. The rehearsal covered recovery, disruption, stale confirmations, no-capacity/deadline cases, no-action state, persistence, reset and the real local demo API.

This is a clean-copy check on the same machine, not a teammate-machine check, spoken presentation rehearsal or live OpenAI verification. Later source revisions require their own checks.
