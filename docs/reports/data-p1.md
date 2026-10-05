# DATA P1 report (issue #3) — `src/data/pokemon.ts`

Branch `feat/data-tcgdex`. Model: Claude Sonnet 5.5. Exports: `PokeCard`, `CatalogMeta`, `candidateTcgdexId`,
`parseTcgdexCard(json, tcgplayerId, catalogMeta?)`, `resolveCard(tcgplayerId, catalogMeta, signal?, http = JsonClient)`, `hare2SearchUrl`. Reuses `JsonClient` / `ProviderError`.
`resolveCard` has an optional 4th parameter (injectable `JsonClient`) beyond the contract signature; the contract call shape still works.

## TDD record (`npx vitest run tests/unit/pokemon-data.test.ts`)
| Step | Behavior | RED | GREEN |
|---|---|---|---|
| 1 | `candidateTcgdexId` "SV4K: Ancient Roar" + "001/066" → `SV4K-001` | module `src/data/pokemon.js` missing, "no tests", file failed | 1 passed |
| 2 | no-colon set, no-slash number, null for missing/empty/unmappable/path-like | `AssertionError: expected '-001' to be null` (1 failed / 2 passed) | fixed with code/local-id validation; `'../x'` also caught (regex first allowed dots) → 3 passed |
| 3 | `parseTcgdexCard` match mapping | `parseTcgdexCard is not a function` | 4 passed |
| 4 | mismatch/missing variants/string-vs-number id/null optional fields/image URL validation (9 cases) | **No RED observed**: I had already written the full parser in step 3 (over-implementation, deviation from strict TDD); tests were added afterwards and passed immediately | 17 passed |
| 5 | `resolveCard` (fake fetch), 404/500 → null, abort rethrown, `hare2SearchUrl` | 5+ failed (`resolveCard` / `hare2SearchUrl` not exported) | 26 passed |

### P2 (contract change): `matchMethod` + set_number fallback
Each step: `npx vitest run tests/unit/pokemon-data.test.ts`.
| Step | Behavior | RED (observed) | GREEN |
|---|---|---|---|
| 6 | `PokeCard.matchMethod = 'tcgplayer_id'` on id match | `maps a matching card` failed (missing `matchMethod`), 1 failed / 25 passed | 26 passed |
| 7 | set_number fallback: no tcgplayer refs + set code + numeric localId → `matchMethod 'set_number'`, `variant: null` | `matches by set code, numeric localId and official count...` failed; 1 failed / 28 passed. The 2 sibling tests (no meta → null, id match preferred) passed immediately (they pinned existing behavior, no RED) | first GREEN omitted the refs/count guards |
| 7b | That first, deliberately minimal GREEN broke the existing `returns null on id mismatch` (card with refs to other ids matched by number) | 1 failed (regression caught by an existing test) | — |
| 8 | guards: refs to other ids → null; any string/number ref counts as a ref; official count equal; non-numeric `/part` or unknown official → null | 5 failed / 33 passed (refs ×2, count ×2, plus the 7b regression) | 38 passed |
| — | set code case-insensitive/mismatch, numeric localId (`'10'`==`'010'`, `TG10` rejected), name never used, `resolveCard` set_number end-to-end | **No RED**: the set-code/localId comparisons were written in step 7's GREEN, so these tests passed on arrival (regression guards only) | 38 passed |

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

## Real sample, recent sets (P2; read-only network, not committed)
Same catalog (27,348 records). Pool: sets with code `SV*`/`M*` (5,625 rows). 30 rows, LCG seed 20261005, resolved with the real `resolveCard`.
**Counts: tcgplayer_id 25, set_number 5, null 0.** (The random draw contained no M-series or SV11B rows, so a supplemental targeted draw follows.)

set_number matches (eye check; English = catalog record name, never used for matching):
| tcgplayerId | Set / number | English record name | TCGdex id | Japanese name |
|---|---|---|---|---|
| 623327 | SV9a 079/063 | Electivire ex - 079/063 | SV9a-079 | エレキブルex |
| 566701 | SV2a 161/165 | Erika's Invitation - 161/165 (Poke Ball Pattern) | SV2a-161 | エリカの招待 |
| 566456 | SV2a 111/165 | Rhyhorn | SV2a-111 | サイホーン |
| 566692 | SV2a 152/165 | Energy Sticker (Poke Ball Pattern) | SV2a-152 | エネルギーシール |
| 566653 | SV2a 109/165 | Koffing (Poke Ball Pattern) | SV2a-109 | ドガース |

All 5 are name-consistent by eye. Note SV2a (151) matches by set_number here, as the coordinator probe suggested.
Note: the "(Poke Ball Pattern)" record is a different tcgplayer product than the plain one but gets the same Japanese card (`variant: null`, since TCGdex has no tcgplayer variant for it). Metadata is correct; the pattern distinction is not resolvable via TCGdex.

Supplemental targeted draw (16 rows from `M<digit>`, SV8–SV11 sets, same seed): tcgplayer_id 10, set_number 4, null 2.
| Result | tcgplayerId | Set / number | English record name | Japanese name |
|---|---|---|---|---|
| set_number | 636603 | SV11W 050/086 | Mienshao - 050/086 | コジョンド (SV11W-050) |
| set_number | 636622 | SV11W 069/086 | Druddigon - 069/086 | クリムガン (SV11W-069) |
| set_number | 636613 | SV11W 060/086 | Deino - 060/086 | モノズ (SV11W-060) |
| set_number | 636610 | SV11W 057/086 | Garbodor - 057/086 | ダストダス (SV11W-057) |
| null | 636497 | SV11B 143/086 | Krookodile - 143/086 | — |
| null | 636411 | SV11B 057/086 | Venipede - 057/086 | — |
(One M-series row, M6-026, resolved by tcgplayer_id; no M1L/M2/M2a row was drawn.)

**SV11B nulls are caused by the contract's count rule, not a bug:** TCGdex `SV11B` has `cardCount.official = 174` while the catalog numbers read `/086` (Black Bolt/White Flare each print /086; TCGdex uses a combined 174). SV11B-143 (ワルビアル) and SV11B-057 (フシデ) exist in TCGdex. I implemented the rule exactly as specified; the counts disagree, so null. Coordinator decision needed if SV11B should resolve (e.g. allow count to equal either sibling count, or drop the count check when set code and numeric localId match). Not changed here.
Also: Krookodile 143/086 vs Japanese ワルビアル matches by eye (same Pokémon), so the card is correct, just excluded by the rule.

## Limits / notes for coordinator
- Coverage is limited by TCGdex's tcgplayer cross-reference; expect many nulls for pre-SV sets. UI must handle `null` (show recognition-only fallback, never an internal-id-only candidate).
- Image is `${image}/high.webp`, only https + host `assets.tcgdex.net` (no port/credentials); otherwise `imageUrl: null`.
- `ProviderError` (incl. 404/429/5xx) → `null`; abort/timeout and non-Provider errors are rethrown. JsonClient caches 24h per URL.
- `variant` is the first variant whose tcgplayer id matches. Cards where `variants_detailed` lacks tcgplayer are never shown.
- set_number matches carry `variant: null` and may map several tcgplayer products (e.g. Poke Ball Pattern vs plain) to one Japanese card; it is metadata-only identification, not a variant claim.
- Not sampled: M1L, M2, M2a (probe-flagged sets) — random draws did not hit them. Unit tests use SYNTHETIC fixtures.
- A possible later improvement (needs coordinator decision): fallback via TCGdex search by name/number, or a prebuilt tcgplayerId→tcgdexId map at build time.
- Real check used `npx tsx` (downloaded ad hoc, not added to package.json). No package/contract edits.
Final `npm run check`: typecheck clean; 20 test files / 196 tests passed.
