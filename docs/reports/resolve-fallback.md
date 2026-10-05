# resolve-fallback (issue #16)

Branch `fix/resolve-fallback`, base 07acc7b. Model: Claude Sonnet 5.5.

## Changes
- `src/data/pokemon.ts`: `SET_ALIAS` + exported `tcgdexSetId()`; `candidateTcgdexId` and the set_number match both use it.
- `src/main.ts`: `resolveSuggestion()` — if the top product has no Japanese card, resolve the next topMatches (first 5 overall, own id excluded,
  per-product cache `matchCards` reused, resolved in parallel) and show the first in rank order with that product's own cardId/score/rarity/price.
  Version/identity guards still use the original observation; an unresolved id is never shown; no error text when a fallback succeeded.
- Tests: `tests/unit/pokemon-data.test.ts` (5 new), `tests/browser/resolve-fallback.spec.ts` (2 new).

## Alias table (verified 2026-10-05 against live `https://api.tcgdex.net/v2/ja`)
| Catalog set | TCGdex id | Evidence |
|---|---|---|
| Start Deck 100 Battle Collection | MC | `/sets` has `MC=スタートデッキ100 バトルコレクション` (774 cards). `MC-741` = レガシーエネルギー, localId `741` (3-digit padded, e.g. `MC-001`); matches catalog 669718 (Legacy Energy 741/742). 5/5 sampled cards matched by name (PokéAPI ja names); no tcgplayer ref on MC cards, so matching is `set_number`. |
| SV-P Promotional Cards | SV-P | `SV-P-001` = ピカチュウ with `thirdParty.tcgplayer 587758` = catalog id of "Pikachu - 001/SV-P". localId `001`. |
| M-P Promotional Cards | M-P | Sampled cards carry tcgplayer ids that map back to catalog "M-P Promotional Cards". localId `001`. |
| sm1+ / SM2+ / SM3+ / SM4+ / SM5+ | SM1p … SM5p | `SM4+` etc. exist in `/sets` but are **empty stubs** (`cards: []`); the cards are under `SM4p` etc. (`SM4p-001` = タマタマ = Exeggcute). Sampled name match: SM4p 5/5, SM3p 6/6, SM2p 6/6, SM1p 6/6, SM5p 4/4, 0 mismatches. Allowing a raw '+' would have produced ids that 404, so '+' is aliased, not accepted. |

Left unmapped (not in TCGdex ja `/sets`, or no verifiable evidence): BW-P, PCG-P, DP-P, DPt-P, ADV-P, P, T, PLAY, CoroCoro promos
(no such TCGdex set); old-era sets by English name (Base Expansion Pack, Split Earth, Flight of Legends … my name check did not confirm them);
DP1–DP5 and similar rows have no collector_number at all (cannot derive an id).

## RED / GREEN
- Unit RED: `npx vitest run tests/unit/pokemon-data.test.ts` → 4 failed | 40 passed (MC, SV-P/M-P, SM4+, set_number-with-alias). GREEN after implementation: 44 passed.
- Browser RED: `resolve-fallback.spec.ts` test 1 failed (panel stayed hidden; test 2, the cap-at-5 guard, passed already). GREEN after `resolveSuggestion`: 2 passed.
- `npm run check`: 30 files / 264 tests passed. `npm run build`: OK.
- Playwright (1 worker, port 4247, desktop + mobile-viewport): pokemon-flow, sticky-candidate, live-candidate, alternatives-products, resolve-fallback → 92 passed.

## Derivable rows (catalog v10, 27,348 rows)
Before: 19,228 derivable / 8,120 not. After: 20,759 / 6,589 → **+1,531** (MC 909, SV-P 196, SM4+ 125, SM3+ 82, SM2+ 66, sm1+ 66, SM5+ 63, M-P 24).
Of the remaining 6,589, 2,150 catalog rows have no collector_number at all.

## Real check (user photo /tmp/user_legacy_keep.jpg, Chromium 390x844 viewport, `vite preview` :4191, local image upload)
Shown: **669718 Start Deck 100 Battle Collection 741/742 via the MC alias** (TCGdex request `MC-741` only), score 類似度 0.834, USD $2.99 / ￥471,
no error message. The fallback path was therefore not needed for this photo. The correct SV6 101/101 (#3) was not shown as current;
the 他の候補 dialog was still loading its other entries when captured, so I did not verify its contents. Screenshot: `docs/reports/resolve-fallback.png`.

## Limits
- Mocked browser tests prove UI behavior only. The real check is one photo on desktop Chromium, not iPhone Safari.
- The top product (a reprint from Start Deck 100) is still the recognition's #1; the image model cannot tell it from SV6 101/101. The user sees the MC reprint, which is the same card name but a different printing.
- 8 MC energy rows have non-numeric collector numbers (GRA/FIR/WAT) and derive ids like `MC-WAT`, which 404 → unresolved (safe, never shown).
- Alias names were verified by sampling (4–7 cards per set), not by full-set comparison.
- docs/contracts.md not touched (coordinator).
