# syntax=docker/dockerfile:1

# Full dependency install, using the same npm lockfile as local development.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY patches ./patches
COPY scripts/apply-patches.mjs ./scripts/
RUN npm ci

# Production-only node_modules for the runtime image.
FROM deps AS prod-deps
RUN npm prune --omit=dev --ignore-scripts

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# All-in-one runtime: Next.js plus the Python deep-research-agent. The API
# routes spawn the agent scripts per request (ANALYST_PYTHON), so no second
# long-running process or supervisor is needed.
FROM python:3.12-bookworm AS runner
# Copy Node.js/npm from the official node image (same Debian base).
COPY --from=node:22-bookworm-slim /usr/local /usr/local
WORKDIR /app
ENV NODE_ENV=production \
    ANALYST_PYTHON=/usr/local/bin/python3

COPY deep-research-agent/requirements.txt ./deep-research-agent/
# requirements.txt includes duckdb for scripts/ask.py + create_duckdb.py.
RUN pip install --no-cache-dir -r deep-research-agent/requirements.txt

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY package.json next.config.ts ./
# data/supplier_risk_dataset.csv is read at request time via DuckDB.
COPY data ./data
COPY deep-research-agent/*.py ./deep-research-agent/
COPY scripts/*.py ./scripts/
# Build data/suppliers.duckdb for the analyst (scripts/ask.py).
RUN python3 scripts/create_duckdb.py

# output/ must be writable for the agent's CSV and JSONL results.
RUN useradd --create-home --uid 1001 app \
    && mkdir -p deep-research-agent/output \
    && chown -R app:app deep-research-agent/output
USER app

EXPOSE 3000
CMD ["npm", "start"]
