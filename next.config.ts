import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  turbopack: { root: process.cwd() },
  serverExternalPackages: ["@duckdb/node-api"],
  outputFileTracingIncludes: {
    "/suppliers": ["./data/supplier_risk_dataset.csv", "./node_modules/@duckdb/node-bindings-*/**/*"],
    "/compare": ["./data/supplier_risk_dataset.csv", "./node_modules/@duckdb/node-bindings-*/**/*"],
    "/supplier/*": ["./data/supplier_risk_dataset.csv", "./node_modules/@duckdb/node-bindings-*/**/*"],
    "/api/mcp": ["./data/supplier_risk_dataset.csv", "./node_modules/@duckdb/node-bindings-*/**/*"],
  },
}

export default nextConfig
