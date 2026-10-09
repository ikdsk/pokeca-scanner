# Mana Peek link on the idle (pre-camera) intro — report

Branch `feat/intro-manapeek-link` (worktree `intro-manapeek-link`), base `8f46fb6`. **Nothing committed, pushed or merged**; the diff is left in the worktree.

## Changes
- `src/main.ts` — after the cameraIntro paragraph「結果をタップすると詳細が開きます。残したいカードは「履歴に保存」。」, added `p.small.intro-sister` with an `a` 「MTG版はこちら →」 → `https://ikdsk.github.io/mtg-card-scanner/`, `target="_blank"`, `rel="noopener noreferrer"`. Variables `introSister` / `introSisterLink` (no clash with the footer's `sister` / `sisterLink`; both links coexist). It lives inside `cameraIntro`, so it hides with the intro while scanning.
- `src/ui/style.css` — one added rule: `.camera-intro .intro-sister a` (white, underlined, `pointer-events:auto`). Needed because `.camera-intro` has `pointer-events:none`, which would otherwise make the link unclickable. No existing rule changed.
- `tests/browser/intro-hint.spec.ts` — new test: link visible in the intro with correct `href`/`target`/`rel`, positioned below the history-save text, hidden once scanning starts. The existing "no MTG wording" check in this file now strips the link text before scanning the body (everything else is still checked).
- `tests/browser/pokemon-flow.spec.ts` — the branding test's banned-word text also strips 「MTG版はこちら →」 (same approach as the footer link PR). No assertion removed.
- Untouched: `package.json`, `package-lock.json`, `tsconfig.json`, `.github/`.

## Verification (real commands, this worktree)
- `npm run check` — typecheck OK; vitest 30 files / 264 tests passed.
- `npm run build` — OK.
- `npx playwright test` (port 4187 checked free with `lsof`):
  - First run: 222 passed, 2 failed — the `pokemon-flow` branding test (desktop + mobile) failed because the intro link text contains `MTG`. Fixed by stripping the link text in that test.
  - Final run: **224 passed** (desktop + mobile-viewport).
- Responses are SYNTHETIC. Real-device (iPhone Safari) check: NOT RUN.

## Screenshot
`docs/reports/intro-manapeek-link.png` (390×844, Chromium, idle intro): the link sits as a small underlined line directly under the history-save text; it does not overlap the heading, the スキャン開始 button, the start hint arrow or the gear. Captured with a temporary spec (deleted afterwards).
