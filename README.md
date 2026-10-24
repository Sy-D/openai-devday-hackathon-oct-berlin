# FORMA: infrastructure delivery decisions

Select a physical part of a modular AI data center, inspect its product and seller evidence, calculate road alternatives and compare the consequences of live incidents.

- `/`: interactive hardware model, ten component references and a direct path into delivery planning.
- `/planning?component=optics`: exact NVIDIA optical-module offers, editable origin/destination/timing, live road geometry, relevant reports, cost/time/emissions comparison and saved decisions.
- `/incidents`: automatically updated reports from GDACS, NASA EONET, Autobahn A2/A24/A10 and NDW; PortWatch remains explicitly historical.

**Two-minute walkthrough:** [demo script](docs/DEMO.md). **Current delivery checklist:** [remaining work](docs/CONNECTED_WORKSPACE_TODO.md).

## What the numbers mean

Public seller prices, availability wording and source timestamps are preserved. Missing prices or dispatch information use planning inputs whose provenance is available in the evidence panel. Manufacturer links establish product identity; they do not validate estimated commercial terms or mixed-vendor compatibility.

Valhalla supplies actual road geometry and modeled driving time. Current Autobahn delays are applied only to fresh direction-aligned road overlap; overlapping queues use the largest report, not a sum. Avoidance samples the full reported road section and the resulting route is checked again. A nearby report or ramp closure never establishes that an entire delivery is blocked.

Small-part transport uses HanseSprint's published tariff, including its bands, service multiplier, pickup-time surcharges and rounding. Its cost is an estimate pending carrier confirmation. Diesel-car emissions use the UK 2026 average-car factor. Large-part freight and emissions use explicit planning assumptions; car routing does not establish heavy-vehicle clearance. The comparison may recommend retaining the original route when alternatives are slower or costlier.

Decisions are saved in this browser, with original evidence retained. Changed inputs, route selection or relevant reports require review. There is no purchase, carrier booking, shared order database or guaranteed arrival promise. Incident records cannot be paused, reset or cleared by users. The previous scripted planners are no longer accessible, including through `?mode=demo`; legacy supplier routes redirect to planning, and scripted disruption/assistant endpoints return 410.

## Run locally

Use Node.js 22.12 or later:

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Public incident, routing and place-search services need network access but no credentials. Place lookup uses an explicit search action through [Photon](https://github.com/komoot/photon#demo-server) with a bounded per-process cache and request spacing; PHOTON_SEARCH_URL can select a separately hosted service. For a production preview run `npm run build` followed by `npm start`.

```sh
npm test
npm run lint
npm run build
PLAYWRIGHT_USE_PRODUCTION=1 npm run test:e2e
```

The JavaScript lockfile is canonical; `npm ci` applies the existing metal-fx patch. Browser fixtures are confined to tests and are never substituted for failed live providers. See [test coverage](tests/README.md).

## Runtime and source limits

Provider requests are bounded and cached per process. Incident failures retain last-good reports with stale status; routing failures show an error or retain a baseline with an explicit avoidance warning. There is no durable event archive or cross-instance polling coordinator. Public routing and Photon search are fair-use demo services; a production deployment needs appropriate service arrangements. Attribution remains on the map.

Simon’s shared design is retained with selected control, spacing and touch-target improvements. His new branch was not merged wholesale, and none of its simulated backend behavior replaced this workflow. The separate removal of his legacy supplier implementation remains teammate-owned. The following material is historical setup for that retained code, not the current application path.

### Legacy supplier agent setup (separate removal pending)

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

It serves the same application routes on port 3000. Optional provider values come from the root `.env`; research results persist in the `agent-output` volume. Docker CI verified the original integration build. Runtime provider configuration still needs its own check.

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
