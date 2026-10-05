# Development operating rules — Pokéca Scanner

Pokémon Card Game (Japanese edition) scanner, forked from the MTG scanner
(`ikdsk/mtg-card-scanner` @ `release/issue22-candidate-immersive` 5ed9293).
MTG-era plans/reports live in `docs/archive/mtg/` for reference only.

## Product constraints
- MVP: one-card scan of Japanese Pokémon cards, Japanese metadata, TCGplayer USD reference price plus approximate JPY.
- Recognition: CollectorVision catalog v2 `pokemon-japan` (source tcgplayer; result id = TCGplayer product id).
- Japanese metadata: TCGdex `ja` API, matched to the TCGplayer product id. Never show a candidate that has only an internal id.
- Price: TCGplayer USD (reference, overseas market) + approximate JPY. Label it as overseas reference, never as a domestic price.
- Hareruya2: external search link only. Do not fetch, store, or redisplay Hareruya2 prices or content (their terms forbid reuse).
- Startup and scan latency are product value. No default camera image upload. No fabricated prices or recognition results.
- Keep the approved MTG-version UX: big black camera + white result panel, continuous scanning, green only for detection lines,
  "hold → view → optional save", gear settings, unified start/stop button.
- Read docs/development-plan.md, docs/contracts.md and the assigned GitHub issue before editing.

## Model assignment
- Coordinator (LEAD): Claude Opus 5.5. Implementation/TEST/QA subagents: Claude Sonnet 5.5 (`claude-sonnet-5-5`).
- Pin the model per worker process; do not silently fall back to another model. If unavailable, stop and report.

## Isolation and ownership
- One agent = one branch = one git worktree in `/Users/dikeda/workspace/pokeca-scanner-worktrees/<role>`.
- Main checkout `/Users/dikeda/workspace/pokeca-scanner` is for coordinator integration only.
- Coordinator alone owns package.json, package-lock.json, tsconfig.json, .github/, docs/contracts.md and integration.
- Dependency or contract change: propose to coordinator; do not edit owned files.
- Commit only owned paths (see docs/agent-briefs.md); no `git add .`; no push/merge unless explicitly delegated.
- Never remove a worktree with uncommitted changes.

## Quality
- Strict TDD: one behavior RED -> GREEN -> refactor; record real commands/outcomes in the report.
- No test weakening, skips or threshold relaxation without coordinator review.
- Label mocked fixtures. Mock passes do not prove real recognition, provider behavior or phone performance.
- No public deploy, paid service, license purchase, image upload or committed secrets without user approval.

## Progress tracking
- Progress, verification results and defects are reflected in GitHub Issues of `ikdsk/pokeca-scanner`.

## Reporting
- Return branch, commit, changed paths, RED/GREEN results, limits and blockers.
- Human device tests remain NOT RUN until evidence exists; desktop WebKit is not iPhone Safari.
