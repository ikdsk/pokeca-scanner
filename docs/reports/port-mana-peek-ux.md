# PORT-01 — Mana Peek UX → Pokéca Scanner (issue #9)

Branch `feat/port-mana-peek-ux`, base `cd89747`. Agent: Claude Sonnet 5.5. Source (read-only): MTG
`feat/unify-close-buttons` @ 1882fa4 vs ancestor 5ed9293. Nothing was cherry-picked; each behavior was
re-implemented on the Pokémon code (`src/main.ts` was rewritten around the MTG final structure).

## Ported / skipped

| MTG commit | Item | What was done |
|---|---|---|
| 4d649e3 | Recognition preload | `void prepare()` at startup; `prepare()` is idempotent (shared by preload, camera, local image). A local image only restarts the worker when a camera frame is in flight. DFC/Scryfall/japanese-name parts **skipped** (MTG only). |
| 9baca3d | Sticky candidate | `LiveCandidate.observe` returns the pending suggestion through transient frames; `accepted(identity, preserveNewer)`. `presentSuggestion(null)` never clears; an unresolvable/failed replacement is dismissed without evicting the shown card; replacement commits atomically. `tentative.holding` dimming removed. |
| 9942d8e | Toolbar / gear | Gear is an SVG button (`aria-label` 情報・設定), 44px, on the same row as the scan button (CSS block ported). |
| 74a65b4 | One scan button, no diagnostics | Single camera-icon button 「スキャン開始」⇄「停止」 in place; 「カード検出なし/四隅を検出」 line and 「類似度 — · margin —」 removed (candidate 「類似度 x.xxx」 stays). |
| b9a8711 / f323fba / 13fd5b7 / 4385466 | Compact format badges / set badge | Replaced by the **regulation mark badge** + 「拡張名 セットコード 番号」 in the collapsed dock (kept as text: TCGdex ja has no set symbol). MTG format badges, set icon: **skipped**. Fixed a clamp rule that stretched the badge (seen in the real screenshot). |
| 5f3e904 | Polish integration | Folded into the above. |
| 48618a5 | かざす→見る→任意保存 | Tap image/name → modal detail sheet (card frozen while open; queued newer verified card applied on close); close via × / Escape / header swipe down (body scroll does not close). 「履歴に保存」 (once, 保存しました ✓ feedback), 「他の候補」; no これです/違う, no ▲▼ toggles, no auto-save, camera keeps running. |
| 45199a7 | Intro / nav trim | Idle intro with app name ポケカスキャナー + one-line hint; **no mana wheel / MTG wording / rename**. `確定カード` route and result panel removed; nav = 画像・履歴, settings via gear. |
| 3a04f39 | Start hint, wording, 他の候補, history→sheet | Arrow + 「タップしてスタート！」 under the scan button while idle. 「参考価格 ￥…」 (was 「概算 ￥…」; also inside the other-subtype list; 「海外参考価格（TCGplayer）」 / 「国内販売・買取価格ではありません」 kept). 他の候補 implemented **for real** (below). Printings list → 「同じカードの別商品」. History rows open the same read-only sheet. |
| 792d622 | Mana wheel logo | **Skipped** (MTG-specific). |
| 1882fa4 | Unified close buttons | `closeIconButton` (shared × SVG, `aria-label`/title 閉じる, 44px) for drawer and detail sheet. |

### 他の候補 and 同じカードの別商品 (Pokémon-specific)
- `src/ui/alternative-candidates.ts`: resolved `topMatches` only, dedupe by `tcgdexId` (best score wins, current wins), max 4, current always kept, best score first.
- `src/ui/same-card-products.ts`: other products with the same `tcgdexId` (e.g. Poke Ball pattern), each priced by its own product id; section omitted when none.
- Selecting a non-current entry shows it as the current card until a newer verified candidate replaces it; 履歴に保存 stores it.
- **Worker change (needs coordinator review):** `public/recognition/scanner.worker.mjs` `topMatches[]` entries now also carry `catalogMeta` (one additive line + comment). Without it a top match has no set/number, so `resolveCard` cannot derive its TCGdex id and every alternative would be dropped. `TopMatch.catalogMeta?` added in `adapter.ts`. Real check below shows it working.

### Compatibility with #10 (0d941a6, price fix)
Not rebased. My `src/ui/price-view.ts` edits are only the two 概算→参考価格 string lines (non-overlapping with #10's `chooseQuote` / 「版により価格が異なります」 hunks); the new 同じカードの別商品 rows call `priceView` with `variant: null` (sole-quote semantics). `tests/unit/price-view.test.ts` text expectations conflict textually with #10's edits and need a trivial merge (wording only).

## Assertions intentionally changed (UX changed)
Old controls/labels replaced in existing specs: カメラでスキャン→スキャン開始; これです→履歴に保存; 違う→(removed; 他の候補); 候補パネルを拡大/縮小 and 確定カード route→detail sheet; 設定 button→情報・設定 gear; 補助画面を閉じる→閉じる; 概算 ￥→参考価格 ￥ (unit+e2e); `recognition.test.ts` "clears low quality"→"retains low quality" (sticky); rearm checks use "save again is possible" instead of panel-hidden; hidden panel after save/dismiss → card stays shown. No threshold/skip weakening; test counts only grew.

## RED → GREEN

| Behavior | RED (observed) | GREEN |
|---|---|---|
| sticky `LiveCandidate` retain + `accepted(…, preserveNewer)` | `vitest live-candidate`: 2 failed | 7/7 |
| `recognition.test` retains low quality | (follows from above) 1 failed | pass |
| 参考価格 wording (`price-view`) | 4 failed | 6/6 |
| `alternative-candidates` | module missing, then 1 failed (dedupe-by-best-score) | 5/5 |
| `same-card-products` | module missing | 4/4 |
| New Playwright specs (preload, toolbar, sticky, collapsed dock, scan-view-save, intro-hint, alternatives-products, unify-close-buttons: 28 tests) | all 28 failed against a `git archive` of `cd89747` + the new specs (many fail simply because the new controls don't exist there) | 28/28 on the port |
| Rearm saved-state & alias handling found by pokemon-flow/live-candidate | 2 e2e failures | fixed in `main.ts` (reset saved flag on rearm only; carry saved version across product-id aliases) |

## Test counts
- `npm run check`: typecheck + vitest **234 passed (26 files)** (was 223/24 before this work).
- `npm run build`: OK.
- `npx playwright test --workers=2` (desktop + mobile-viewport, port 4231): run 1 **182/182**; after a CSS-only badge fix run 2 **181/182** — one timing-flaky assertion in `live-candidate` (frame-count window measured right after a click); the spec now syncs to a frame dispatch first and passed 16/16 with `--repeat-each=8` (both projects). Baseline before this work: 126 e2e / 223 unit.

## Real check (Chromium 390×844, `vite preview` :4198, real worker/catalog/TCGdex/Frankfurter, killed afterwards)
Uploaded `https://assets.tcgdex.net/ja/SV/SV4K/001/high.webp` via the image input: preloaded model status visible on the idle screen; result **ヤナップ / 古代の咆哮 SV4K 001/066 / レアリティ Common / G / 類似度 0.792 / 参考価格 ￥20 / $0.13 USD**; sheet shows the 国内販売・買取価格ではありません note and the 晴れる屋2 link. 他の候補 returned real neighbours: ヤナップ (現在の候補), ケムッソ (S10a 004/071, 0.584), ウツドン (SV2a 070/165, 0.574).
Screenshots: `port-mana-peek-ux-dock.png`, `port-mana-peek-ux-detail.png`, `port-mana-peek-ux-intro.png`. `public/prices/pokemon-japan-usd.json` was used but is not committed.

## Limits / NOT RUN
- All Playwright specs use SYNTHETIC worker/camera/TCGdex/price data; they do not prove real recognition, provider coverage or phone performance. Desktop Chromium ≠ iPhone Safari.
- **NOT RUN:** real camera (continuous scan) on any device, iPhone Safari, human device tests. The real check used a single uploaded image.
- 「同じカードの別商品」 with real data not observed (the SV4K-001 neighbours contain no second product of the same card); covered only by the synthetic spec. TCGdex variant `type` strings for pattern products are assumed (`pokeball`/`masterball` → 日本語ラベル; unknown → 「別商品」).
- History entries do not keep top matches, so the sheet opened from history omits 同じカードの別商品.
- Dock keeps a fixed height, so a short card leaves some white space above the buttons.
