# Connected procurement workspace — remaining work

This is the active implementation checklist. The shared planning Page, Notion checkpoint and Excalidraw were reconciled after implementation and publication, as requested.

## Verified milestones

- [x] Sourced exact seller offers: NVIDIA optics (€1,483.28 net observed), refurbished optics (€475 with tax treatment unknown) and APC monitoring (€582.99 net observed). All ten model categories link to real manufacturer product references.
- [x] Live routing API and incident geometry: Valhalla road alternatives and whole-section avoidance, A24/A10/A2 reports, time windows, road/ramp distinction, direction checks and reported traffic delays. Live requests and 27 backend checks passed.
- [x] Publish a checkpoint for collaboration: `codex/connected-procurement` at `6873cda`; normal push and remote SHA verified.
- [x] Apply only reviewed frontend improvements from Simon: shared elevation, transitions, focus and 44px touch targets. No simulated backend or broad branch merge adopted. Scoped lint and Tailwind compilation passed.
- [x] Remove accessible scripted planners/alerts and pause/reset-feed controls. Default overview and old `?mode=demo` both use the connected overview; legacy supplier pages redirect to planning. Scripted disruption and old simulated assistant endpoints return 410. First production build passed and localhost was refreshed.

## Finish and verify

- [x] **Verified — Explicit decision approval:** removed the overview evidence badge. Older saved decisions now require **Apply updated decision** while retaining their routes, inputs and previous calculations. **Reopen for review** returns an applied decision to the red review state. The new migration/reopen browser regression passes; the current browser's previous plan visibly awaits approval. Recording steps use the exact Apply controls.

- [x] **Verified — Recording path and review dots:** red/amber/green markers follow review state. Browser regression proves save turns the part green and changed evidence turns it red. Exact recording clicks and narration are in DEMO.md; actual-provider rehearsal passed. Report popup CSS was repaired and its rendered boxed layout was verified.

- [x] **Verified — Usable location search and map:** explicit city/address/facility search selects named locations; coordinates are collapsed under Advanced. Real Photon lookup succeeded for Berlin. Styled component picker, OpenFreeMap light/dark tiles, endpoint labels, legend, fit and loading state are implemented. Actual desktop and 390px controls/map screenshots were inspected; browser regression checks lookup-to-route payload and component navigation.

- [x] **Verified — Connected decision flow:** model part → offer → origin/destination/timing → live reports → actual road alternatives → saved decision. Production browser checks cover save/reload, relevant-update review, changed route/location guards and in-flight response races. Actual provider smoke also preserved a saved decision across incident-page navigation.
- [x] **Verified — Fill missing data:** all ten components have a planning-ready priced option. Three seller offers retain observed prices; eight category estimates fill missing prices. Origins and timing are editable; freight/emissions assumptions and sources are expandable. No supplier quote, stock confirmation or scripted incident is invented. This implements the latest permission to use assumptions for missing values.
- [x] **Verified — Visual repairs:** modular AI data-center labels, stronger action colors and compact part cards are visible; the overview evidence badge was removed at Carl's request. Rendered desktop/mobile screenshots inspected; 320/390/768/1440px browser layout checks pass.
- [x] **Verified — Local checks:** 112 unit/API tests and all 23 production browser tests pass, including explicit approval and reopening. Production build/TypeScript pass; lint has zero errors and two existing legacy warnings. Actual Photon, Valhalla and incident-provider workflow passed, including saved decisions and live reported-delay changes. Retired simulation-only suites were replaced with current flow coverage.
- [x] **Published — Branch and PR:** connected application pushed to `codex/connected-procurement`; [PR #7](https://github.com/Sy-D/openai-devday-hackathon-oct-berlin/pull/7) is merged. Remote SHA verified. Only selected frontend improvements from Simon were adopted.
- [x] **Merged — Application:** PR #7 merged into main at `3b3d3ab`; it contains tested implementation `c59947a` with no content difference.
- [x] **Verified — Previous application CI:** GitHub Docker run 40098287449 passed for application head `c59947a` (2m9s). PR #7 and documentation PR #8 are merged. The explicit-approval follow-up has passed local checks; its CI result must be checked separately.
- [x] **Verified — Two-minute demo script:** [DEMO.md](DEMO.md) traces the optical module, Glinde/Berlin route, current traffic evidence, alternatives and saved decision. Actual browser clicks and calculations passed; human spoken timing remains below. The script uses the displayed result even when keeping the baseline is best.
- [x] **Verified — Documentation and cleanup:** planning Page updated and read back; Notion checkpoint saved and read back; Excalidraw architecture/status/demo frames updated and visually inspected. Only localhost:3000 remains; extra preview/test servers are stopped. Teammate work is preserved.

## External follow-ups

- [ ] **Blocked — Hosting:** Vercel workspace authorization is deferred by Carl. No deployment to forma-supply-chain.vercel.app is claimed.
- [ ] **Team verification:** teammates pull the published branch/main and rehearse on another machine; agree presenter and final two-minute timing.
- [ ] **Separate removal PR:** Simon's non-design supplier code removal remains teammate-owned. Preserve that work; check the incoming PR before integration. Its old UI entry points are now retired locally.

## Superseded or intentionally excluded

- No purchases, supplier outreach or carrier booking were requested. A saved route is a browser-local planning decision.
- The old simulated manufacturing/AI assistant is retired; configuring its OpenAI key is no longer needed for this workflow.
- Initial all-real-only direction is superseded by explicit permission to use assumptions for missing data. Actual reports and sourced prices remain authoritative; calculated forecasts do not become confirmed shipment outcomes.
