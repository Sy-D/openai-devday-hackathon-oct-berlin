# Performance verification · 24 October 2026

The delivery chat renderer and Markdown tools now load on first use. Hover or keyboard focus preloads the panel; the first submitted prompt is retained while its code loads. The conversation stays mounted after opening. The overview uses stable model-part and visibility arrays, avoiding repeated Three.js material updates during unrelated renders. The feed freshness timer only publishes when source health actually changes; incoming incident updates still flow normally.

Route screening computes route bounds once per call, rather than once per incident, and looks up source health through a map. The exact segment-distance, time-window, reported-delay and stale-source rules are unchanged. There is no cached incident result that could hide a new report.

## Measurements

Measured locally against production builds in Chromium, with the same viewport and a fixed empty feed, no saved drafts, and no paid model call. The earlier build already included the compact overview UI; the final build also includes the redesigned searchable chat picker.

| Measurement | Before | After |
| --- | ---: | ---: |
| Initial JavaScript, compressed bytes transferred | 454,743 | 410,370 |
| Initial JavaScript, decoded bytes | 1,578,860 | 1,429,360 |
| JavaScript after opening chat, compressed bytes | 454,743 | 488,350 |
| Route screening, median of 15 runs | 222.55 ms | 8.45 ms |
| Route screening, p95 | 236.17 ms | 9.42 ms |

Initial JavaScript transfer fell **9.8%**. The redesigned chat needs additional code when first opened, rather than loading it on every visit. This is a byte measurement, not a claimed improvement in network latency or Core Web Vitals.

The deterministic route benchmark uses 2,500 route vertices and 4,000 incident fixtures, of which 40 match. Both versions return the same 40 matches; median screening time fell **96.2%**, approximately **26× faster for this workload**. These fixtures are isolated in the benchmark script and never enter the application's live feed. This does not claim the whole application is 26× faster.

## Reproduce

Use Node 22.12 or later, install the repository dependencies, then:

```sh
npx tsx scripts/benchmark-route-screening.ts
npm run build
npm run start -- --hostname 127.0.0.1 --port 3000
# In another terminal, with Playwright Chromium available:
node scripts/benchmark-page-load.mjs
```

`PERF_URL` changes the measured app URL. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` selects an existing Chromium binary. The page script uses its own browser context and does not modify the user's drafts.

Build/TypeScript and 126 unit/API tests passed. All 27 existing production browser cases passed after the performance changes; all five chat cases passed after the panel redesign, including the new keyboard search/selection and no-overflow check at 320 px (28 distinct cases). Lint has no errors and two existing warnings in the retired supplier workspace panels. The actual desktop panel was visually inspected. The server remains configured for low-cost Qwen3 through OpenRouter, with price caps and no expensive fallback.
