# FORMA delivery assistant

The overview and every workspace header now expose **Ask FORMA**. Chat uses the Apache-2.0 Qwen3-235B-A22B-Instruct-2507 model through OpenRouter on the server and calls FORMA’s existing catalog, incident, address-search, road-routing and metric functions. It does not reuse the retired supplier-research assistant.

## Try it

1. Open the overview and select **Optical interconnects**. Type directly into the compact chat input, use **Check live incidents / Compare routes / Reduce emissions**, or open **Ask FORMA** in the header. The first message sends immediately from the overview. In chat, **Working on** opens a searchable delivery picker with product and manufacturer names.
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
OPENROUTER_MODEL=qwen/qwen3-235b-a22b-2507
```

Carl’s standing requirement: use low-cost open-source models for this project. There is no expensive model fallback. Requests prefer the cheapest tool-compatible provider and enforce ceilings of $0.15 per million input tokens and $0.65 per million output tokens, with at most 1,600 output tokens per model step. OpenRouter rejects the request if no provider meets those limits. The model listing on 24 October 2026 showed $0.09 input / $0.55 output per million tokens.

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
- [x] Qwen3 open-source model + live incident hub + Valhalla route proposal verified: quantity 2, handling 15, locations/departure preserved, deadline empty, approval absent.
- [x] Compact overview composer, prioritized review card and redesigned persistent chat panel with searchable keyboard-accessible delivery picker. Draft proposals, conflict checks, Undo, planner synchronization and manual approval are preserved.
- [x] 126 unit/API tests and all 27 production browser tests pass; all five chat tests passed after the panel redesign, including the new 320px keyboard/search check (28 distinct browser cases). Build and TypeScript pass; lint has no errors and two existing legacy warnings.
- [x] Live browser read-only question returned current A24 reports and calculated cost/carbon without a draft change. Qwen3 independently passed draft-update, real A24 avoidance and read-only arrival/cost/carbon checks; the latter reports Berlin local time explicitly.
- [x] Localhost refreshed for review.
- [x] Carl lifted the merge hold and requested a normal push and PR merge. The feature branch is `codex/nebius-delivery-agent`; GitHub is authoritative for its publication/merge status. See [performance measurements](PERFORMANCE.md).

Provider reference: https://openrouter.ai/docs/guides/features/tool-calling

Model license: https://huggingface.co/Qwen/Qwen3-235B-A22B-Instruct-2507

Provider price caps: https://openrouter.ai/docs/guides/routing/provider-selection#max-price
