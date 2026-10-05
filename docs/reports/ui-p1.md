# UI P1 report (issue #5)

Branch `feat/ui-pokeca` (base integration/p1 fae8fe4). Model: Claude Sonnet 5.5.
Coordinator delegation used: `src/main.ts` rewrite; deleted MTG modules `src/data/{cards,repository}.ts`, `src/ui/{format-legality,session}.ts` and their tests. `FxProvider`/`parseFx` moved to `src/data/fx.ts`.

## Delivered
- Pure modules (unit-tested): `ui/candidate-view` (name, 拡張名+番号, rarity, regulation badge, 番号で照合 note, 晴れる屋2 link, thumbnail URL), `ui/price-view` (JPY main + USD sub, update time, others list, uses `chooseQuote`), `ui/price-session` (stale-safe), `ui/snapshot-loader` (404 / HTML fallback => missing), `ui/card-identity` (same-card variants), `ui/rearm`.
- `main.ts`: resolveCard per live suggestion; "カード情報を確認中…" until resolved; null/error => candidate hidden + dismissed + status line (never an id-only candidate). Regulation badge replaces MTG format UI. Search, printing/language/finish selectors removed; routes are 画像 / 履歴 / 設定 / 確定カード. Header ポケカスキャナー, new footer sources/rights/privacy text.
- Variant ambiguity (item 7): the live gate sees a canonical id (first product id seen per tcgdexId). While a replacement id resolves, the old card stays shown (dimmed); if it resolves to the same tcgdexId nothing changes. Dismiss/confirm of a card also suppress its aliases until the card leaves view.

## RED -> GREEN (real runs)
| Step | RED | GREEN |
|---|---|---|
| fx.ts | `Cannot find module src/data/fx.js` (no tests) | 2 passed |
| candidate-view | module missing | 5 passed |
| price-view (headline/status) | module missing | 4 passed |
| price-view (subtypes) | 2 failed (`others` was `[]`) — note: the ambiguity branch was already written in the previous GREEN, only `others` was RED | 6 passed |
| snapshot-loader, price-session | both modules missing | 6 passed |
| card-identity, rearm | modules missing | 3 + 3 passed |
| scan-history -> PokeCard | tsc: 16 type errors (vitest does not typecheck) | 11 passed with providers |
| e2e dismiss-alias test | failed: alias re-proposed after dismiss (LiveCandidate keeps ONE dismissed id; the alias overwrote it). Fixed by dismissing with the canonical identity | passed |

## Test counts
- `npm run check`: typecheck clean; 24 files / 223 unit+regression tests passed.
- `npm run build`: OK.
- `npx playwright test`: 126 passed (63 tests x desktop + mobile-viewport), 0 failed.

## Test changes (not weakening of surviving behavior)
- Deleted: `format-legality`, `combined-camera-ui`, `reference-image` browser specs; MTG parts of `smoke`; unit tests for cards/format-legality/session/reference-image and Repository parts of `providers.test.ts` (JsonClient tests kept).
- Ported with SYNTHETIC Pokémon fixtures (`tests/browser/pokemon-synthetic.ts`): live-candidate, continuous-camera, candidate-immersive, camera-first-design, scan-history; kept assets/camera-geometry unchanged. Dropped MTG-only cases (rich JP/EN printing, finish select, jitter between printings).
- Adaptations: Enter-key test now keeps A's TCGdex lookup pending (a failed lookup now hides the candidate); candidate-immersive internal-scroll assertion relaxed to `overflowY=auto` + `scrollTop>=0` because the long MTG rules text is gone (details no longer overflow at 390x844).
- New `pokemon-flow.spec.ts` (18 tests): fields, pending/unresolved/provider-failure, set_number note, missing/HTML snapshot, FX failure and zero, subtypes, alias no-flicker/dismiss, 晴れる屋2 link with no Hareruya2 request, branding/footer/privacy, local image, reference image.

## Real check (not mocked recognition/TCGdex/price)
`npm run prices:snapshot` (25,932 products, 93 s), `npm run build`, preview on :4199, Playwright Chromium 390x844, TCGdex image `.../ja/SV/SV4K/001/high.webp` via 端末の画像でスキャン, models fetched from jsDelivr/Hugging Face (no `?localAssets`).
Displayed: **ヤナップ** / 古代の咆哮 SV4K 001/066 / レアリティ Common / G badge / similarity 0.792 (margin 0.200) / 海外参考価格（TCGplayer）概算 ￥20 + $0.13 USD (FX from Frankfurter) / reference image / expanded: 国内販売・買取価格ではありません, 価格更新 2026/10/05 05:05（日本時間）, 晴れる屋2で探す ↗. ~6-8 s end to end (cached models). Hosts contacted: jsdelivr, huggingface (+hf cdn), hanclinto.github.io, api.tcgdex.net, assets.tcgdex.net, api.frankfurter.dev; no Hareruya2, no TCGCSV from the browser.
Screenshot: `docs/reports/ui-p1-sv4k001.png`. One console 404 (favicon, not investigated).

## Limits / NOT RUN
- Human iPhone Safari / real camera: NOT RUN (desktop Chromium only). Only one real card sampled; coverage of other sets unmeasured.
- Product-variant alias shows the first-seen product's price; a Poke Ball Pattern product's own price is not shown when it aliases.
- Compact dock shows 海外参考価格 label but the "国内販売・買取価格ではありません" line only in the expanded details (and always on the card page). Label hidden in compact-viewport (<=550px high) for fit.
- 晴れる屋2 link is in the expanded details and card page, not the compact dock.
- TCGdex variant names vs TCGplayer subtypes only match case-insensitively (normal/Normal); otherwise "価格の種類を特定できません" with all subtypes listed.
- Snapshot fetch is retried per candidate when missing (cheap 404). `public/prices/` is gitignored, not committed. Final product name TBD.
- `domain/selection.ts` is no longer used by src (still covered by regression tests); `ScanHistory.reserve/fail` unused by main.
