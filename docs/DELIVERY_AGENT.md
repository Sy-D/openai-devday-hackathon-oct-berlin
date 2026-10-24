# FORMA delivery assistant

The overview and every workspace header now expose **Ask FORMA**. Chat uses OpenRouter on the server and calls FORMA’s existing catalog, incident, address-search, road-routing and metric functions. It does not reuse the retired supplier-research assistant.

## Try it

1. Open the overview, select **Optical interconnects**, then **Ask FORMA**.
2. Ask: “Which current incidents affect this delivery, and what are its transport cost and carbon? Do not change anything.”
3. Ask: “Set quantity to 2 and handling to 15 minutes, keep the current locations and departure, then calculate the fastest route. Leave the deadline empty.”
4. Read the proposed inputs and comparison, then click **Update delivery draft**. The map and review state update in the same browser. **Undo draft changes** restores the previous draft if no later edit conflicts.
5. Ask: “Calculate an alternative avoiding the reported A24 accident and compare its time, cost and carbon with the original. Keep other inputs unchanged.” Use the actual report available today; the alternative may be worse.
6. Click **Review delivery**, compare the original and selected routes, and use **Apply route decision** only when satisfied. Chat never applies the final decision or books transport.

Live reports change. If no current report matches the route, ask for a normal route comparison; do not invent a disruption for the recording. The assistant can look up named places, change quantities/handling/departure/deadline or seller offers, select a calculated route and reopen a previous review. Address changes require another route calculation.

## Server setup

Local Next.js reads ignored `.env.local`:

```dotenv
DELIVERY_AI_PROVIDER=openrouter
OPENROUTER_API_KEY=your-server-key
OPENROUTER_MODEL=anthropic/claude-sonnet-4.6
```

Restart the local production server after changing environment variables. Never use a `NEXT_PUBLIC_` credential. Docker Compose accepts these same variables from the shell or `docker compose --env-file .env.local up --build`. No key is included in Git or Docker build context.

Optional Nebius support remains available via `DELIVERY_AI_PROVIDER=nebius`, `NEBIUS_API_KEY`, `NEBIUS_MODEL` and `NEBIUS_BASE_URL`. The provided Nebius credential was rejected; OpenRouter supersedes it for this task. The server does not silently fall back to another account/provider.

## Behavior and boundaries

- `/api/delivery-chat` executes a bounded allowlist of eight tools. The model cannot run shell commands, fetch arbitrary URLs, buy parts or approve decisions.
- Provider credentials, hidden reasoning and provider debug errors never enter browser responses. Requests have body, history, duration, tool-count and concurrency limits.
- All mutations remain proposals until **Update delivery draft**. Current browser storage is compared with the request snapshot before writing. Later manual edits or another tab’s changes block the proposal instead of being overwritten.
- Applied decisions are retained as previous evidence and reopened for review when chat changes their inputs or route. Calculations use the browser’s timezone on the server, including Berlin’s DST transition.
- Incident proximity is screening, not proof of a closure. Stale/unmatched reports cannot be sent to the avoidance tool. The complete reported road geometry is passed to the existing router.
- Cost and carbon retain the existing sourced or assumed calculation basis. They are planning estimates, not a carrier quote, measured footprint or booking. Browser drafts are not shared database records.
- There is no synthetic assistant response if a provider fails. A visible error leaves drafts unchanged.

## Verification · 24 October 2026

- [x] Bounded provider/tool integration; live OpenRouter function call verified.
- [x] Real model + live incident hub + Valhalla route proposal verified: quantity 2, handling 15, locations/departure preserved, deadline empty, approval absent.
- [x] Overview and persistent chat panel, draft proposals, conflict checks, Undo, planner synchronization and manual approval.
- [x] 125 unit/API tests and all 27 production browser tests pass. Build and TypeScript pass; lint has no errors and two existing legacy warnings.
- [x] Live browser read-only question returned current A24 reports and calculated cost/carbon without a draft change.
- [x] Localhost refreshed for review.
- [ ] Main publication/merge: intentionally on hold at Carl’s request. Keep work on `codex/nebius-delivery-agent`.

Provider reference: https://openrouter.ai/docs/guides/features/tool-calling
