# Printed rarity (issue #12)

Branch `feat/printed-rarity`, base 2763c03. Agent: Claude Sonnet 5.5.

## Change
- `src/domain/rarity.ts`: `printedRarity()` (exact, case-sensitive table lookup after trim; unknown/'None'/null -> null) and `withPrintedRarity()`.
- `src/main.ts`: `rarityByProduct` records `catalogMeta.rarity` per product id (recognized card + every topMatch). Cards are converted with `withProductRarity` where they enter the UI: the live candidate and resolved topMatches (他の候補). The UI-layer `card.rarity` therefore holds the printed symbol, so the detail sheet, alternative picks and history entries (the saved card is stored) all carry it. A product without catalogMeta -> no rarity.
- `src/ui/candidate-view.ts`: `rarity` is `{label, aria}`; main renders `.rarity-badge` (aria-label/title 「レアリティ SR」) before the regulation badge. The old 「レアリティ <TCGdex>」 text is gone. `src/ui/style.css`: badge shares the regulation-badge style.

## TDD (real runs)
- RED: `vitest tests/unit/rarity.test.ts` -> module missing; `candidate-view.test.ts` -> 2 failed; `printed-rarity.spec.ts` -> 6 failed (badge showed TCGdex "C", expected "SR").
- GREEN: `npm run check` 28 files / 243 tests pass; `npm run build` ok.
- Playwright (1 worker each, desktop + mobile-viewport): printed-rarity 6, pokemon-flow 36, collapsed-dock 6, alternatives-products 12, scan-history 10, sticky-candidate 6 — all passed. Full suite NOT run.

## Real check (Chromium 390x844, `vite preview` :4194, image upload)
| Product | Card | Expected | Displayed |
|---|---|---|---|
| 665887 | M2a 216/193 ハイパーボール | SR | SR (regulation I) |
| 569754 | S9 126/100 ハイパーボール | UR | UR |
| 569717 | ハイパーボール | U | U (regulation F) |

Screenshot: `printed-rarity-sr.png`.

## Limits
- Fixtures are SYNTHETIC; the real check covers only 3 cards via image upload, not live camera or iPhone Safari (NOT RUN).
- The rarity is that of the product id whose card is shown. If a different product of the same TCGdex card is adopted silently (no card change), the displayed rarity is not re-evaluated.
- The history list rows do not show rarity (they never did); the history-opened sheet does.
- Existing spec `collapsed-dock` selector changed from `.rarity` to `.rarity-badge`.
