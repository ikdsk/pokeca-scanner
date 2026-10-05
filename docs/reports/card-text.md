# TEXT-01 / issue #13 — card text in the detail sheet

Branch `feat/card-text` (base 2002ef5). Agent: Claude Sonnet 5.5.

## Changes
- `src/data/pokemon.ts`: `PokeCard.text?: CardText`, parsed defensively from the TCGdex ja JSON `resolveCard` already fetches (no extra request). Every field type-checked; malformed items dropped; absent/unknown stays absent. Numeric attack `damage` (e.g. `30`) is kept as the string `"30"`.
- `src/ui/card-text.ts`: pure `cardTextView(text)` (Japanese labels: types/cost, stage, trainerType, 特性, 弱点/抵抗力/にげる, `イラスト：`) and `renderCardText(text)` DOM section.
- `src/main.ts`: one slot in the detail body after the price/晴れる屋2 area, filled in `showCard` — so live, picked alternative and history-opened sheets all share it. The compact dock never shows it.
- `src/ui/style.css`: section styling, effects use `white-space: pre-line`.
- Energy type labels (not in the brief): `Normal`→基本エネルギー, `Special`→特殊エネルギー; unknown kept.

## TDD
- RED: `card-text.test.ts` (text undefined), `card-text-view.test.ts` (module missing), `card-text.spec.ts` 6/6 failed (no section) before the render code.
- GREEN: each after the minimal implementation. Note: the parser was written for all fields at once after the first RED, so the later parse tests (Trainer, Energy, malformed, absent) were GREEN on first run (characterization, not individually RED).
- `pokemon-data.test.ts` "maps a matching card" expectation gained `text: { category, hp }` (new field, not a weakening).

## Verification
- `npm run check`: 30 files / 255 tests pass. `npm run build`: OK.
- Playwright, `MVP_PORT=4245 --workers=1` (desktop + mobile-viewport projects): card-text 6, pokemon-flow 36, scan-view-save 10, scan-history 10, alternatives-products 12, camera-first-design 4 — all passed.
- Fixtures are SYNTHETIC-from-real (shapes from real TCGdex ja JSON; wording invented). Mock passes do not prove coverage or phone behavior.

## Real check (Chromium 390x844, vite preview :4192, real recognition + real TCGdex)
- `/tmp/ubbg_665887.jpg` → ハイパーボール: `グッズ` + effect text + `イラスト：Studio Bora Inc.` (`card-text-trainer.png`).
- SV4K-015 composited on gray (PIL) → グレンアルマex: `1進化 · HP260 · 炎`, 特性 グレンアーマー + effect, ワザ 無色 無色 しゃくねつバズーカ 40+ + effect, `弱点 水×2 / にげる 2`, `イラスト：takuyoa` (`card-text-pokemon.png`).

## Limits
- Device (iPhone Safari) test NOT RUN. Desktop Chromium only.
- Energy-card text not checked against real data. Other 進化/特殊ルール texts (ex rule boxes) appear only if TCGdex provides them.
- docs/contracts.md not updated (coordinator-owned): add `PokeCard.text?`.
