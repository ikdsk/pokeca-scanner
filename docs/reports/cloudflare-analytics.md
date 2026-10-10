# Cloudflare Web Analytics (public site only) — report

Branch `feat/cloudflare-analytics` (worktree `cloudflare-analytics`). **Nothing committed, pushed or merged**; the diff is left in the worktree.

## Changes
- `src/analytics.ts` (new) — `isPokecaPublicSite(loc)`: true only when `hostname === 'ikdsk.github.io'` **and** `pathname.startsWith('/pokeca-scanner/')`. Split out so the condition is unit-testable.
- `src/main.ts` — right after the imports, if `isPokecaPublicSite(location)` a deferred `beacon.min.js` script is appended to `<head>` with `data-cf-beacon={"token":"54404ff142394c16a4e7ae1d54a95697"}`. The comment states why the path is checked. The privacy `<details>` text no longer says 「分析サービスへの送信はありません」; it now says that the public site (ikdsk.github.io/pokeca-scanner/) only does anonymous page-view counting via Cloudflare Web Analytics, with no cookies and no personally identifying data, and that local environments are not measured.
- `README.md` — 「解析（アナリティクス）はありません」 replaced with the same accurate statement.
- Tests: `tests/unit/analytics.test.ts` (pokeca path true; Mana Peek path, `/`, look-alike `/pokeca-scanner-x/`, 127.0.0.1, localhost, tailnet host false) and a `smoke.spec.ts` test that no `script[data-cf-beacon]` exists and no `cloudflareinsights.com` request is made on 127.0.0.1.
- Untouched: `package.json`, `package-lock.json`, `tsconfig.json`, `.github/`. (`npm ci` was run to install dependencies in this worktree; no manifest changed.)

## Token handling
- `54404ff142394c16a4e7ae1d54a95697` is a **Pokéca Scanner–dedicated** Cloudflare Web Analytics site. Mana Peek (`ikdsk/mtg-card-scanner`) uses a separate site/token.
- Both apps are served from `ikdsk.github.io`, so a hostname-only check would send Pokéca traffic to Mana Peek's site (or vice versa); the `/pokeca-scanner/` path check prevents that.
- The token is a public beacon identifier (visible in any page source), not a secret.

## Verification (real commands, this worktree)
- `npm run check` — typecheck OK; vitest 31 files / 267 tests passed.
- `npm run build` — OK.
- `dist/assets/index-C2tfrLXZ.js` contains `54404ff142394c16a4e7ae1d54a95697`; `00c24dfbaf044bc4b54872c21eefbc6b` appears nowhere in `dist/`.
- `npx playwright test` (port 4187 checked free with `lsof`): **226 passed** (desktop + mobile-viewport).
- Limits: the beacon injection on the real `https://ikdsk.github.io/pokeca-scanner/` and data arriving in the Cloudflare dashboard are NOT RUN (needs deployment). The path condition is covered by unit tests only, not by a browser on the real host.
