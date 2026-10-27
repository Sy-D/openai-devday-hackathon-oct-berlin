# Browser coverage

The current suite covers the real procurement workflow, provider-controlled incidents,
3D model interaction and fallback, mobile layout, saved drafts/decisions, contextual
navigation, and retirement of the previous simulated endpoints.

The former simulation-only `actions`, `action-accessibility`, `scenario`, and `demo`
specifications were removed when those application flows were retired. They remain
in Git history. Their applicable persistence, keyboard/model, mobile and failure-state
regressions are covered by `procurement`, `planning-navigation`, `live-overview`,
`live-incidents`, and `dsx` specifications. No retired flow is silently skipped.

Tests using routing or incident fixtures explicitly intercept the HTTP boundary;
they do not provide fallback datasets to the application. Real-provider endpoint
checks and visual smoke are run separately to verify deployment connectivity.
