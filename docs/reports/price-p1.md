# PRICE P1 report (issue #4)

Branch `feat/price-tcgplayer`. Model: Claude Sonnet 5.5.

## Delivered
- `src/data/tcgplayer-price.ts`: `parseSnapshot` (pure, strict validation), `createTcgplayerPrice(loader).quote(tcgplayerId, groupId?, signal)` → `UsdQuote[]`, `chooseQuote(quotes, variant?)`.
- `scripts/price-snapshot.mjs`: sequential download (≥200 ms gap), tmp-then-rename write, default output `public/prices/pokemon-japan-usd.json` (arg 1 overrides). Output is NOT committed.
- `tests/unit/tcgplayer-price.test.ts`: 13 tests, SYNTHETIC fixtures, no network.

## RED → GREEN (real runs, `npx vitest run tests/unit/tcgplayer-price.test.ts`)
1. parseSnapshot accepts documented shape: RED (stub threw "not implemented") → GREEN 1/1.
2. Malformed snapshots rejected: RED (`Cannot read properties of null`, 1 failed | 2 passed) → GREEN 3/3.
3. quote(): shape, null/0/1234.50 formatting, unknown id, shared load, retry after invalid load, abort: RED (`createTcgplayerPrice is not a function`) → GREEN after one test was revised (below) 9/9.
4. chooseQuote: RED (`chooseQuote is not a function`, 4 failed) → GREEN 13/13.
- Test revision: my first abort test required the caller's signal be passed to the loader. That contradicted the chosen design (one shared load; one caller's abort must not poison it), so I replaced it with "aborted caller rejects without poisoning the shared load". It was my own new test, not a weakening of existing coverage.
- `npm run check`: typecheck clean, 20 files / 171 tests passed.

## Real snapshot (run once, 2026-10-05, output at /tmp, not committed)
- 459 groups, 25,932 products, 28,576 rows; 2,643 products have >1 subtype.
- 801,754 bytes raw (≈783 KiB), 120,467 bytes gzip -9; 93.0 s wall (sequential, 200 ms gap).
- providerUpdatedAt from `https://tcgcsv.com/last-updated.txt` = 2026-10-04T20:05:38Z.
- Spot check: product 565756 → `[["Normal",0.13]]`; via `quote('565756')` → usdMarket `"0.13"`.

## Limits
- `quote` ignores `groupId` (snapshot keyed by product id; ids are unique within the category).
- Waiting on the first snapshot load is not abortable mid-flight; abort is checked before and after.
- No default loader/URL is wired; the UI/integration must pass a loader (e.g. fetch of `prices/pokemon-japan-usd.json`) – coordinator decision.
- `public/prices/` is not in `.gitignore` (not my file); the generated JSON could be committed by accident.
- Only `marketPrice` is kept; low/mid/high/directLow are dropped. Values rounded to whole cents.
- Snapshot is a build/local artifact: prices are as old as the last run. Real-device/browser behavior NOT RUN.

## Open questions
- TCGCSV terms of use / required attribution unverified; needs user review before any public deploy.
- Refresh cadence (source updates ~20:00 UTC daily; the script takes ~93 s) and where it runs (manual, CI schedule, deploy hook).
- Staleness display: `providerUpdatedAt` is exposed on each quote; the UI should decide when to flag as stale.
- Which subtype to show when a product has several (`chooseQuote` returns null on ambiguity).

## Proposed package.json script (coordinator)
`"prices:snapshot": "node scripts/price-snapshot.mjs"` and add `public/prices/` to `.gitignore`.
