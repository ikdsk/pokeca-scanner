# DATA P1 report (issue #3) — `src/data/pokemon.ts`

Branch `feat/data-tcgdex`. Model: Claude Sonnet 5.5. Exports: `PokeCard`, `CatalogMeta`, `candidateTcgdexId`, `parseTcgdexCard`,
`resolveCard(tcgplayerId, catalogMeta, signal?, http = JsonClient)`, `hare2SearchUrl`. Reuses `JsonClient` / `ProviderError`.
`resolveCard` has an optional 4th parameter (injectable `JsonClient`) beyond the contract signature; the contract call shape still works.

## TDD record (`npx vitest run tests/unit/pokemon-data.test.ts`)
| Step | Behavior | RED | GREEN |
|---|---|---|---|
| 1 | `candidateTcgdexId` "SV4K: Ancient Roar" + "001/066" → `SV4K-001` | module `src/data/pokemon.js` missing, "no tests", file failed | 1 passed |
| 2 | no-colon set, no-slash number, null for missing/empty/unmappable/path-like | `AssertionError: expected '-001' to be null` (1 failed / 2 passed) | fixed with code/local-id validation; `'../x'` also caught (regex first allowed dots) → 3 passed |
| 3 | `parseTcgdexCard` match mapping | `parseTcgdexCard is not a function` | 4 passed |
| 4 | mismatch/missing variants/string-vs-number id/null optional fields/image URL validation (9 cases) | **No RED observed**: I had already written the full parser in step 3 (over-implementation, deviation from strict TDD); tests were added afterwards and passed immediately | 17 passed |
| 5 | `resolveCard` (fake fetch), 404/500 → null, abort rethrown, `hare2SearchUrl` | 5+ failed (`resolveCard` / `hare2SearchUrl` not exported) | 26 passed |

Final: `npm run check` — see bottom.

All fixtures are SYNTHETIC (modeled on facts verified 2026-10-05); the fake fetch is injected into `JsonClient`; no network in unit tests.

## Real sample (read-only network, not committed)
Catalog `tcgplayer-pokemon-japan/version/10/base/records.jsonl.gz` (27,348 records), 20 rows picked with a fixed LCG seed (20261005),
resolved with the real `resolveCard` against `api.tcgdex.net/v2/ja`: **4/20 resolved** (SV4a-074, SV3a-068, SV4K-015, SV8-053; all modern SV sets).

Why the other 16 returned null (spot-checked with curl):
- Older sets (S4a, BW6, Pt1, XY-Bx, …): TCGdex `ja` returns 404 for the derived id (set not present / differently coded).
- SM12a-061: card exists but `variants_detailed[].thirdParty` has only `cardmarket`, no `tcgplayer` → correctly rejected by the match rule.
- Non-code set names ("SV: ex Starter Set …", "SM: The Best of XY") derive ids like `SV-006` which don't exist in TCGdex.
- Promo/unnumbered rows ("DP-P" with number `124/DP-P`, "Leaders' Stadium" without collector_number, "Magma VS Aqua: …", "Start Deck 100 …") → no candidate id (null).

Not measured: weighting by what users actually scan (mostly recent sets); a 20-row uniform sample over-weights old sets. Not a guarantee for any specific set.

## Limits / notes for coordinator
- Coverage is limited by TCGdex's tcgplayer cross-reference; expect many nulls for pre-SV sets. UI must handle `null` (show recognition-only fallback, never an internal-id-only candidate).
- Image is `${image}/high.webp`, only https + host `assets.tcgdex.net` (no port/credentials); otherwise `imageUrl: null`.
- `ProviderError` (incl. 404/429/5xx) → `null`; abort/timeout and non-Provider errors are rethrown. JsonClient caches 24h per URL.
- `variant` is the first variant whose tcgplayer id matches. Cards where `variants_detailed` lacks tcgplayer are never shown.
- A possible later improvement (needs coordinator decision): fallback via TCGdex search by name/number, or a prebuilt tcgplayerId→tcgdexId map at build time.
- Real check used `npx tsx` (downloaded ad hoc, not added to package.json). No package/contract edits.
Final `npm run check`: typecheck clean; 20 test files / 184 tests passed.
