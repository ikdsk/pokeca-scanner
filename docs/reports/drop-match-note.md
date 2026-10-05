# drop-match-note (follow-up to #12)

User request: 「番号で照合は消す」. The 番号で照合 note is no longer displayed on any surface (dock meta row, detail sheet, picked alternatives, history sheet — all share `metaNodes`).

## Changes
- `src/ui/candidate-view.ts`: removed `matchNote` from `CandidateView`.
- `src/main.ts`: `metaNodes` no longer emits `.match-note`.
- `src/ui/style.css`: removed unused `.match-note`.
- `PokeCard.matchMethod` (src/data/**) untouched; it is simply not displayed.

## Intentionally replaced assertions
- `tests/unit/candidate-view.test.ts`: `labels set_number matches with a muted note` (expected `matchNote === '番号で照合'`) -> `never exposes a match-method note` (no `matchNote` property, no 番号で照合 in the view). Dropped `matchNote: null` from the first test.
- `tests/browser/pokemon-flow.spec.ts`: set_number test no longer expects `.match-note` text 番号で照合; now expects 0 `.match-note` and no 番号で照合 anywhere in body (renamed). The first test additionally asserts the text is absent.

## TDD
- RED: `npx vitest run tests/unit/candidate-view.test.ts` -> 1 failed / 5 passed (matchNote still present).
- GREEN: same -> 6 passed; `npm run check` 28 files / 243 tests passed; `npm run build` ok.
- Browser: `MVP_PORT=4244 npx playwright test --workers=1 tests/browser/pokemon-flow.spec.ts` -> 36 passed (SYNTHETIC; desktop WebKit, not iPhone Safari). No RED run was done for the browser assertion (unit RED only).
