# FORMA: supplier risk and production planning

A shared hackathon workspace with two connected views:

- **Supplier risk dashboard at `/`**: the incoming Siemens Mobility dashboard explores 10,000 anonymized suppliers, their risk profiles, maps and comparison views. Optional Python agents research real companies on the public web and answer questions about the supplier dataset.
- **Production planning at `/planning`**: FORMA shows which orders need action, compares three manufacturing routes, tests quantity and deadline changes, and records reviewed confirmations. Its factory network and orders are synthetic.

Both views run in one Next.js application and share the navigation. Supplier risk data is not yet an input to the production planner; the two datasets remain separate.

```mermaid
flowchart LR
  Browser --> Dashboard[Supplier dashboard /]
  Browser --> Planner[Production planning /planning]
  Dashboard --> Data[DuckDB + supplier CSVs]
  Dashboard --> Research[Native research and analyst routes]
  Research --> Python[Python agents]
  Python --> Suppliers[Nebius + Tavily]
  Planner --> Engine[Deterministic route comparison]
  Planner --> Assistant[Native /api/assistant]
  Assistant --> OpenAI[Optional OpenAI Responses API]
```

## Start locally

Use **Node.js 22.12 or later** and npm. In an existing checkout of the integration branch:

```sh
npm ci
npm run dev
```

Open **http://localhost:3000** for the supplier dashboard and **http://localhost:3000/planning** for production planning. Stop the server with Ctrl+C. No credentials or Python installation are needed to explore the bundled supplier data or run the planning demo. Map tiles and climate panels use public network services.

`package-lock.json` is the canonical JavaScript lockfile. `npm ci` also applies the checked-in `metal-fx` patch. Use `npm run build` followed by `npm start` to run the production build on port 3000.

Repository: [Sy-D/openai-devday-hackathon-oct-berlin](https://github.com/Sy-D/openai-devday-hackathon-oct-berlin). The integration is on `codex/forma-template-integration`; the earlier FORMA draft is preserved at `c89d43b` on `codex/forma-first-draft`. Publication is currently blocked by GitHub HTTP 403 for the signed-in account. A fresh clone of `main` does not yet include this integration. See [the handoff](docs/HANDOFF.md) for publication status and next steps.

## Optional AI features

Keep credentials server-side in the ignored root `.env` file. If no `.env` exists, copy `.env.example` to `.env`, then fill in only the providers you intend to use. Do not overwrite an existing configuration or commit secrets. Restart the server after changing configuration.

| Feature | Requirements |
| --- | --- |
| Planning copilot at `/planning` | `OPENAI_API_KEY`; optional `OPENAI_MODEL`. Without a key, it uses an explicitly labelled deterministic demo reply. |
| Supplier dataset analyst | Python setup below, `data/suppliers.duckdb`, and `NEBIUS_API_KEY`. |
| Research a real company | Python setup below, `NEBIUS_API_KEY` and `TAVILY_API_KEY`. |

The two AI integrations have separate configuration. Setting an OpenAI key does not configure the supplier agents. Never prefix secrets with `NEXT_PUBLIC_` or `VITE_`. Planning API details and the one-request live check are in [docs/AI.md](docs/AI.md).

### Supplier agent setup

Install Python 3.12 or later, then run these commands from the repository root:

```sh
python3 -m venv deep-research-agent/.venv
deep-research-agent/.venv/bin/pip install -r deep-research-agent/requirements.txt
deep-research-agent/.venv/bin/python scripts/create_duckdb.py
```

The last command builds the local database used by the dataset analyst. The dashboard itself queries the CSV files directly. For a different interpreter, set `ANALYST_PYTHON` to its absolute path before starting Next.js.

Supplier defaults are `NEBIUS_MODEL=MiniMaxAI/MiniMax-M3` and `NEBIUS_BASE_URL=https://api.tokenfactory.nebius.com/v1`. Research streams progress while it runs; duration depends on provider and search response times.

The research agent can also run on its own:

```sh
cd deep-research-agent
.venv/bin/python app.py "Robert Bosch GmbH"          # score one supplier
.venv/bin/python app.py --jobs 2 "Bosch" "Siemens"   # several in parallel
.venv/bin/python analyst.py "Your risk question"     # sourced web-research answer
```

The standalone `analyst.py` is separate from the dashboard's dataset analyst, which uses `scripts/ask.py`. See [the agent README](deep-research-agent/README.md) and [pipeline overview](deep-research-agent/OVERVIEW.md).

### Docker

The Docker configuration packages Node.js and Python in one container:

```sh
docker compose up --build
```

It serves the same two pages on port 3000. Optional provider values come from the root `.env`; research results persist in the `agent-output` volume. The integrated Docker setup still needs a build and runtime check on a machine with Docker available.

## Using the supplier dashboard

- **Search**: start typing or press Cmd+K / Ctrl+K. Arrow keys and Enter open a supplier profile; Cmd/Ctrl+Enter sends the text to the analyst chat.
- **Analyst chat**: asks the configured Nebius model to generate a read-only SQL query over the local supplier database, then explains the result. It supports follow-up questions and optional structured answer blocks. This feature needs the Python setup and Nebius key above.
- **Table and filters**: sort columns and filter by risk level, maximum total or financial risk, minimum delivery rating and sourcing risk.
- **Selection and chart**: select up to 20 suppliers to focus the chart and fact cards. Open supplier profiles from the chart or table.
- **Compare and export**: compare selected suppliers on `/compare` or export a shortlist memo.
- **Research a real company**: check existing matches, resolve the official name, and watch eight criteria groups gather evidence and score risk. The result includes reasons and source URLs. Researched rows use `RSCH_` IDs alongside anonymized `SUPP_` rows.

Risk scores run from 0 (no risk) to 100 (maximum risk); higher delivery ratings are better. [Column definitions](data/risk_criteria_description.md) explain the schema. Public-source model estimates need review before procurement decisions.

## Using production planning

Open `/planning` and start with **Needs action**. Each card names the affected order, reason and next decision. Compare Lowest cost, Balanced and Fastest; review capability checks, component routing, assembly timing and costs before confirming a plan.

The demo supports quantity and deadline changes, a Dresden queue disruption, recovery, local persistence and plan export. The copilot can suggest an existing route; only the user can confirm it. See [the planning guide](docs/PRODUCTION_PLANNING.md), [demo script](docs/DEMO.md) and [team setup](docs/TEAM_START.md).

## Checks

```sh
npm run typecheck
npm test
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

After configuring the production assistant's key, `npm run test:live` makes one bounded OpenAI request. Missing credentials or a demo fallback cause a nonzero exit. Final integrated check results are recorded in the handoff; a passing mocked test is not evidence of live provider access.

## Repository layout

```text
app/                    Next.js App Router
  page.tsx              Supplier dashboard
  compare/, supplier/   Supplier comparison and profile pages
  planning/             Production planner inside the shared shell
  api/resolve/          Company-name resolution
  api/research/         Supplier research and scoring (SSE)
  api/analyst/          Dataset questions via scripts/ask.py (SSE)
  api/assistant/        Validated production-planning copilot (JSON)
  api/health/           Production assistant readiness (JSON)
components/dashboard/   Supplier UI and shared app shell
components/analyst/     Supplier analyst answer rendering and chat state
components/ui/          shadcn/ui components using Base UI
lib/                    Supplier data, agent streams, maps and cache
src/                    FORMA planner UI, synthetic network and planning rules
server/                 Shared production assistant and HTTP adapters
scripts/                Dataset loading, SQL analyst and live assistant check
data/                   Anonymized supplier dataset and column definitions
deep-research-agent/    Python research, scoring and standalone web analyst
Dockerfile, compose.yml Combined Node.js and Python container setup
docs/                   Architecture, AI, planning and team handoff
tests/                  Browser checks for planning and shared navigation
tools/oxlint/           Incoming custom lint rules
```

[Architecture](docs/ARCHITECTURE.md) explains data flow and API contracts. [Tech stack](docs/TECH-STACK.md) lists the main dependencies and external services.
