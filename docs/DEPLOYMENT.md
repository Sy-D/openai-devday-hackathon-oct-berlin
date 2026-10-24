# FORMA on Vercel

The intended project is `forma-supply-chain`, with requested domain `forma-supply-chain.vercel.app`. This document describes the deployment configuration, not proof that the domain is live. Record the deployed commit and verified URL in `HANDOFF.md`.

Use the repository root, the Next.js framework preset, Node 22 or 24, install command `npm ci`, and build command `npm run build`. Keep the normal Next output directory. The explicit npm command is necessary because this repository retains a Bun lockfile; npm's postinstall applies the maintained `metal-fx` patch.

## Hosted capabilities

| Feature | Without optional credentials |
| --- | --- |
| `/`, `/planning?component=ID` | Interactive DSX schematic, simulated route assessment and browser-local recovery confirmations. |
| `/api/disruptions` | Simulated SSE playback with event cursors, 55-second connections and reconnects. Verify stream delivery on the deployed platform. |
| `/suppliers`, supplier profiles and comparisons | Supplied CSV dataset, read through native DuckDB. |
| `/planning` | Synthetic production scenarios, route calculations and browser-local confirmations. |
| `/api/assistant`, `/api/health` | Production copilot's labelled demo fallback and configuration status. See `AI.md` for optional OpenAI configuration. |
| Supplier analyst, research and name resolution | HTTP 503 with an explanation. The UI displays that explanation. |
| MCP supplier research | An explicit unavailable tool result; dataset tools remain available. |

The current supplier research code spawns Python and writes results to local CSV/JSON files. A standard Next deployment does not provision that virtual environment or durable research storage. Adding Nebius/Tavily keys to Vercel alone does not enable it. On Vercel, these subprocess features stay disabled until a hosted research backend and its persistence are implemented and tested. No remote-backend environment variable is implemented yet.

Local research remains supported through `deep-research-agent/README.md`; without an executable interpreter the same routes return a clear 503. The supplier SQL analyst runs `scripts/ask.py` and also needs its generated DuckDB database. Production OpenAI configuration is separate from supplier research.

## Native data dependency

Keep `@duckdb/node-api` in `serverExternalPackages` and install dependencies on Vercel's Linux build machine. Do not upload this Mac's `node_modules` as a production build. `outputFileTracingIncludes` explicitly includes the CSV and the installed DuckDB platform package for supplier routes, including the native addon's adjacent shared library. The local automatic trace included `duckdb.node` but omitted that shared library before this adjustment.

Vercel supports the full Node API, but deployment file tracing and function size limits still apply. Verify the resulting Linux bundle and a cold request to `/suppliers`; a local Next build is insufficient evidence. [Node runtime](https://vercel.com/docs/functions/runtimes/node-js), [function limits](https://vercel.com/docs/functions/limitations), [Next output tracing](https://nextjs.org/docs/app/api-reference/config/next-config-js/output).

## Release check

1. Build the reviewed commit with `npm ci` and `npm run build`, then run the repository checks.
2. Deploy that commit and verify `/`, `/suppliers`, one supplier profile, `/compare`, `/planning` and `/planning?component=compute-a` on the resulting URL.
3. Confirm the production copilot says demo mode without a key. POST valid requests to `/api/analyst`, `/api/research` and `/api/resolve`; each should return 503 with `code: research_unavailable`.
4. Check the Vercel build/runtime logs for missing native libraries and failed dataset reads. Record the commit, URL and results before calling the hosted app verified.

A Python ASGI service or a stateless container is a possible later hosting path. The existing command-line scripts and file writes still need adaptation; this release does not claim that backend is deployed. [Vercel Python runtime](https://vercel.com/docs/functions/runtimes/python).
