# Mana Peek cross-link in the app footer — report

Branch `feat/mana-peek-footer-link` (worktree `mana-peek-footer-link`), base `bcfd838`. **Nothing committed, pushed or merged**; the diff is left in the worktree.

## Changes
- `src/main.ts` — one line after the AGPL/rights notice: a `p.small.sister-app` holding an `a` "MTGカード版の Mana Peek もあります" → `https://ikdsk.github.io/mtg-card-scanner/`, `target="_blank"`, `rel="noopener noreferrer"` (same pattern as the sources links). No CSS change: existing `.information a` styles already apply.
- `tests/browser/pokemon-flow.spec.ts` — in the existing branding/sources test: added assertions that the link is visible with the right `href`, `target` and `rel`. That test bans the string `MTG` anywhere in the page, which the new link text intentionally contains, so the link text is stripped (`replaceAll`) from the scanned text before the banned-word check. All other text is still checked.
- `docs/reports/mana-peek-cross-link-footer.png` — screenshot (390×844, 2x). No `docs/screenshots/` directory exists, so it is under `docs/reports/`.
- Untouched: `package.json`, `package-lock.json`, `tsconfig.json`, `.github/`, README, CSS.

## Verification (real commands, this worktree)
- `npm ci` (no `node_modules` in the worktree; lockfile unchanged) — 0 vulnerabilities.
- `npm run check` — typecheck OK; vitest 30 files / 264 tests passed.
- `npm run build` — OK.
- `npx playwright test` (port 4187 checked free with `lsof`) — final run **222 passed** (desktop + mobile-viewport).
  - Intermediate runs: the branding test failed first because `.replace` removed only one of the two occurrences (body and drawer); fixed with `replaceAll`. One `camera-geometry` mobile test (720×1280) failed once in the first full run and passed on the isolated rerun and every later full run; not caused by this change, but I did not find the cause of the flake.
- Responses in these tests are SYNTHETIC. Real-device (iPhone Safari) checks are NOT RUN.

## Screenshot
`docs/reports/mana-peek-cross-link-footer.png` — 設定 drawer → 情報・プライバシー: the link appears as a small line below the license notice and above 「第三者ライセンスと利用条件」, with the same link colour as the other footer links.
