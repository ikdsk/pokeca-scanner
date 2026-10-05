# Agent briefs and ownership — Pokéca Scanner

Model: implementation / TEST / QA subagents run Claude Sonnet 5.5. Coordinator: Claude Opus 5.5.
Each agent works in its own worktree from the coordinator-provided base commit.

| Role | Issue | Owned paths |
|---|---|---|
| LEAD | #1 | root config, .github/, AGENTS.md, docs/contracts.md, docs/development-plan.md, src/main.ts integration |
| VISION | #2 | public/recognition/, src/recognition/, scripts/prepare-assets.mjs, tests/unit/{adapter,recognition,live-candidate,catalog,continuous-scan}.test.*, docs/reports/vision-p1.md |
| DATA | #3 | src/data/pokemon.ts, tests/unit/pokemon-data.test.ts, docs/reports/data-p1.md |
| PRICE | #4 | src/data/tcgplayer-price.ts, tests/unit/tcgplayer-price.test.ts, scripts/price-snapshot.mjs (if proposed), docs/reports/price-p1.md |
| UI | #5 | src/ui/, index.html, tests/unit/{format-legality,reference-image,scan-history,candidate-metadata}.test.ts, tests/browser/, docs/reports/ui-p1.md |
| TEST | — | tests/regression/ |
| QA | #6 | docs/qa/ |

Common task rules: read AGENTS.md, docs/contracts.md and your issue. Strict one-behavior RED→GREEN TDD.
Run `npm run check` (and `npm run build` if UI). Do not edit files you do not own; ask the coordinator via your report.
Commit owned files only, no push. Report: branch, commit SHA, changed paths, RED/GREEN evidence, limits, blockers.
