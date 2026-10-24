import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  serverExternalPackages: ["@duckdb/node-api"],
  experimental: {
    agentUpgrade: "security",
  },
}

export default nextConfig
