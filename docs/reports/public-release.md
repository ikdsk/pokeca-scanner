# Public release preparation — report

Branch `docs/public-release` (worktree `public-release`), base `4e60d30`. **Nothing committed, pushed or merged**; the diff is left in the worktree.

## Changed paths
- `package.json` — `private: true` → `false`; added `"license": "AGPL-3.0-or-later"` (no other field touched).
- `README.md` — full rewrite for end users (Mana Peek tone/structure), Pokéca-specific limits stated.
- `public/recognition/THIRD-PARTY-NOTICES.md` — title no longer "local/internal evaluation only"; the closing "release requires explicit approval" paragraph replaced by a "Public release" section (approval recorded 2026-10-09, AGPL rationale, limits of the approval); the leftover Scryfall/Magic paragraph (including the false "does not display remote card images") replaced by TCGdex / TCGplayer(TCGCSV) / Hareruya2 notices.
- `docs/contracts.md` — added "Public release (2026-10-09)" (none existed; Mana Peek's wording was the model).
- `docs/reports/public-release.md` — this file.
- `LICENSE` — already placed by the coordinator, untouched. `.mana-peek-readme-reference.md` — untracked reference, deleted after use.

## QA-P1 (#6) state
- Issue is **OPEN**. Only comment: QA candidate PR #8 (`cd89747`), preview URL, "real device (iPhone Safari, real camera) not done" (2026-10-05).
- `docs/qa/` contains only `.gitkeep`; **no `*-review.md` exists**. Accuracy, latency and device items in #6 have no recorded evidence.
- Record: QA is incomplete; the public-release prep proceeds on the user's statement that real-device checks were done (no measurements shared). Device tests stay NOT RUN in the repository record. The issue was not touched; closing it is the coordinator's call.

## Verification (real commands, this worktree, 2026-10-09)
- `npm ci` (worktree had no `node_modules`; lockfile unchanged) — 0 vulnerabilities.
- `npm run check` — typecheck OK; vitest **30 files / 264 tests passed**.
- `npm run build` — OK (35 modules; JS 59.66 kB / 22.21 kB gzip).
- `npx playwright test` on free port 4187 (checked with `lsof` first) — **222 passed** (desktop + mobile-viewport), exit 0. Responses are SYNTHETIC; this proves neither real recognition accuracy, provider behaviour nor phone performance.
- Run after the final edits to `package.json`/docs only; no source file was changed.

## Limits stated in the README, with their basis
| Statement | Basis |
|---|---|
| Recognition = CollectorVision `tcgplayer/pokemon-japan`, PREVIEW, accuracy unverified | `THIRD-PARTY-NOTICES.md` (catalog paragraph), `docs/contracts.md` |
| Price = TCGplayer USD + approximate JPY, overseas reference; no fixed FX rate; null ≠ 0; no subtype guessing | `src/data/tcgplayer-price.ts` (`chooseQuote`), `src/main.ts:59,443` footer text, contracts |
| Prices come from a snapshot, not live | `src/ui/snapshot-loader.ts`, `scripts/price-snapshot.mjs`; `price-view.ts` shows provider update time |
| Japanese metadata from TCGdex `ja`; unmatched cards are not shown | `src/data/pokemon.ts`, contracts |
| Hareruya2 = search link only | `hare2SearchUrl` in `src/data/pokemon.ts`; privacy text in `src/main.ts:66` |
| History: tab-memory only, newest 100 | `src/ui/scan-history-model.ts:9`, `scan-history.ts:13` |
| Up to 4 alternatives | `ALTERNATIVES_MAX = 4`, `src/ui/alternative-candidates.ts` |
| No image upload, no analytics | `src/main.ts:66` privacy text (no analytics code was found) |

## Discrepancies with the brief — please decide
1. **Images ARE displayed.** The brief said "画像は表示しません". The code shows a reference image (TCGdex `assets.tcgdex.net`, fallback TCGplayer CDN) in the detail sheet, alternatives and history thumbnails, with credit (`src/ui/reference-image.ts`, `image-source.ts`; issues #11). The old notices line "This app does not display remote card images" was MTG-era and false. README and notices now say what the code does. If hotlinking should stop before release, that is a code change for the coordinator.
2. **UI footer still says the app is not released.** `src/main.ts:64` (footer): 「ローカル・内部検証版。…公開・配布前にライセンス対応と公開承認が必要です。」 This is user-visible and now wrong. `src/main.ts` was outside this task's scope, so it is unchanged; it needs a follow-up edit (and any test asserting it).
3. **Price snapshot is not in the repo.** `public/prices/` is git-ignored; the app fetches `/prices/pokemon-japan-usd.json` from its own origin. A deploy must run `npm run prices:snapshot` (TCGCSV) and serve the file, otherwise users see no prices. Recorded in `docs/contracts.md`. Also note refreshing it needs a rebuild/redeploy.
4. Mana Peek's README mentions Cloudflare Web Analytics on the public site; this app has none, so the README states there is no analytics. If the coordinator adds analytics on deploy, update README and the in-app privacy text.
5. No screenshots section: `docs/screenshots/` does not exist here (only dated report PNGs). Add if wanted.

## Not done (by instruction)
Commit/push/merge, repo visibility change, deploy, CI changes, QA Issue changes.

## Follow-up fix: footer no longer says "not released" (2026-10-09)

Resolves discrepancy 2 above. Public release is approved (`docs/contracts.md` "Public release (2026-10-09)", `THIRD-PARTY-NOTICES.md` "Public release").

- `src/main.ts:64` footer text changed from
  「ローカル・内部検証版。認識コードとモデルはAGPL-3.0。公開・配布前にライセンス対応と公開承認が必要です。ポケモンカードの権利は株式会社ポケモン等の権利者に帰属します。」
  to
  「このアプリと認識コード・モデルはAGPL-3.0でライセンスされています。ポケモンカードの権利は株式会社ポケモン等の権利者に帰属します。」
  (mirrors the Mana Peek wording).
- Searched `src/` (incl. `src/ui/`), `tests/` and README for other pre-release wording (内部検証, 公開前, 公開承認, 公開・配布, ローカル・, 未公開): no other occurrences. No test asserted the old text, so no test changed.

Verification (real runs, 2026-10-09):
- `npm run check && npm run build`: passed (tsc clean, vite build OK).
- `MVP_PORT=4187 npx playwright test` (4187 confirmed free via `lsof`): 222 passed (desktop + mobile-viewport; fixtures are SYNTHETIC, desktop Chromium is not iPhone Safari).
- Not run: human device tests. No commit/push/merge; the diff stays in the worktree.
