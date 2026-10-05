# Price subtype fix (issue #10)

Branch `fix/price-subtype`, base cd89747. Agent: PRICE-FIX (Claude Sonnet 5.5).

## Change
- `chooseQuote(quotes, variant?: string | null)` (src/data/tcgplayer-price.ts):
  1. Exactly one quote -> use it, whatever the TCGdex variant (including null). A TCGplayer product id is one printing.
  2. Several quotes -> explicit table `normal→Normal, holo→Holofoil, reverse→Reverse Holofoil`; used only if exactly one quote has that subtype.
  3. Otherwise `null` (never guess).
- `priceView` (src/ui/price-view.ts): passes the variant as-is (removed the `?? 'Normal'` default for multi-subtype products). When `chooseQuote` is null the headline is 「版により価格が異なります」 and every subtype is listed in `others`. Null price -> 「この商品の価格なし」; 0 stays a real price.

## TDD (real commands)
- RED: `npx vitest run tests/unit/tcgplayer-price.test.ts` -> 3 failed | 9 passed (holo on [Holofoil] returned null; table lookup; `null` variant threw TypeError).
- GREEN: same command -> 12 passed.
- RED: `npx vitest run tests/unit/price-view.test.ts` -> 1 failed | 6 passed (headline was 「価格の種類を特定できません」, expected 「版により価格が異なります」). The single-Holofoil view tests passed already, as `chooseQuote` was fixed first.
- GREEN: after the view change -> all pass.
- `chooseQuote` variant lookup uses a Map (no prototype keys such as `constructor`).

## Existing tests changed (each encoded old behavior)
- tests/unit/tcgplayer-price.test.ts `chooseQuote`: old cases asserted case-insensitive exact name match (`'holofoil'`) and null for a lone `Normal` with variant `Holofoil` — the bug itself. Replaced by the three tests above.
- tests/unit/price-view.test.ts: "shows Normal ... (variant null)" asserted the silent Normal default; now variant `normal` is required, and a null variant with several subtypes shows no price. "mismatched holo" case asserted the old headline/null for a lone-pair mismatch; updated to the new headline.
- tests/browser/pokemon-flow.spec.ts: headline text 「価格の種類を特定できません」 -> 「版により価格が異なります」 (title also renamed). No assertion was weakened; 900002 (variant normal, Normal+Reverse) still shows 概算 ￥300 / $2.00.

## Results
- `npm run check`: 24 files, 224 tests passed (includes typecheck/lint steps of the script).
- `npm run build`: OK.
- `npx playwright test`: 126 passed.

## Real check (public/prices/pokemon-japan-usd.json, vite preview 127.0.0.1:4197, Chromium 390x844, image input, real in-browser recognition + TCGdex)
| Card | Expected | Displayed |
|---|---|---|
| SV4K/015 グレンアルマex | ~$0.33 | recognized SV4K 015/066: 概算 ￥52 / $0.33 USD |
| SV4K/070 ミガルーサ | ~$3.71 | NOT the target: recognized as S8 115/100 ポッドとデントとコーン (similarity 0.594, margin 0.006): 概算 ￥659 / $4.18 USD |
| SV4K/001 ヤナップ | $0.13 | recognized SV4K 001/066: 概算 ￥20 / $0.13 USD |

Screenshot (ex card, 015): docs/reports/price-subtype-fix.png. Server killed (port 4197 free).

## Limits
- SV4K/070 was misrecognized by the recognizer (low margin), so the displayed price belongs to the wrong card; this is a recognition issue, not the price path. The snapshot itself holds 565825 → [[Holofoil, 3.71]], and the unit tests cover that shape synthetically. Not shown end to end.
- Mocked/synthetic fixtures prove selection logic only. No iPhone Safari test (NOT RUN). JPY uses the live FX at test time (~158 JPY/USD).
- 1st Edition / Unlimited products intentionally show no headline.
