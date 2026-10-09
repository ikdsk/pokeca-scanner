# GitHub Pages deploy preparation

Branch: `feat/github-pages-deploy` (uncommitted; no commit/push/deploy performed).
Target: `https://ikdsk.github.io/pokeca-scanner/` (project page, sub-path).

## Changed files
- `vite.config.ts` — `base: process.env.GITHUB_PAGES_BASE ?? '/'` (server/build/plugin settings unchanged).
- `src/recognition/adapter.ts` — Worker URL uses `import.meta.env.BASE_URL`.
- `src/main.ts` — third-party notices link uses `import.meta.env.BASE_URL`.
- `src/ui/snapshot-loader.ts` — `SNAPSHOT_URL` uses `import.meta.env.BASE_URL`.
- `.github/workflows/deploy.yml` — new.

Not changed: `index.html` (the `/src/main.ts` script is rewritten by Vite; it has no favicon/icon links, so no `%BASE_URL%` needed), `package.json`, `package-lock.json`, `tsconfig.json`, `ci.yml`.

Absolute-path audit: the only other `/`-prefixed hits in `src/` are `/cards/*` in `src/data/http.ts` (API endpoint names, not asset URLs), a regex in `image-source.ts`, and display text in the privacy note (`/prices/pokemon-japan-usd.json`, descriptive only). `public/recognition/scanner.worker.mjs` resolves its assets relative to `import.meta.url`, so it works under a sub-path.

## Deviation from the supplied workflow
The supplied YAML put `deploy-pages` in the `build` job, left the `deploy` job without steps, and had `needs: build` twice (invalid YAML/workflow). `deploy.yml` follows the standard layout: `build` ends at `upload-pages-artifact`; `deploy` (needs `build`, environment `github-pages`) runs `actions/deploy-pages@v4`. Everything else is as specified. The YAML was not validated by GitHub (not pushed); it was only read by eye.

## Verification (real commands)
1. Default build: `npm run check` → typecheck OK, 30 files / 264 tests passed. `npm run build` → OK, `dist/index.html` references `/assets/...`.
2. `GITHUB_PAGES_BASE=/pokeca-scanner/ npm run build` → OK. `dist/index.html` script and CSS use `/pokeca-scanner/assets/...`; built JS contains `/pokeca-scanner/prices/pokemon-japan-usd.json`, `/pokeca-scanner/recognition/scanner.worker.mjs` and `/pokeca-scanner/recognition/THIRD-PARTY-NOTICES.md`.
3. Sub-path simulation (`/tmp/pages-sim/pokeca-scanner/` via `python3 -m http.server 4360`, Playwright Chromium): page loads at `/pokeca-scanner/`, no page errors or console errors, notices link href is `/pokeca-scanner/recognition/THIRD-PARTY-NOTICES.md`, the worker (`scanner.worker.mjs`) and `lib/pokemon-catalog.mjs` were requested and returned 200, and `/pokeca-scanner/prices/pokemon-japan-usd.json` returns 200 (built with the real snapshot). Not verified: an actual scan or the price display in the UI under the sub-path (no camera/card input; the loader's fetch of the price file was only checked by direct request), model/catalog download from upstream hosts.
4. `npx playwright test` (default-base build, port 4187 free) → 222 passed.

## Price snapshot in CI
`npm run prices:snapshot` ran locally against TCGCSV with plain public network access and no secrets: 461 groups, 25,974 products, 28,636 rows, 803 KB, ~94 s. It needs no credentials, so GitHub-hosted runners should work; this was not run on an actual runner. The generated file is gitignored and not committed. If TCGCSV is down the step fails and the deploy aborts (intended: no price-less production deploy).

## Known limitations
- Dev/preview server middleware in `vite.config.ts` matches `/recognition/assets/...` literally; it is unaffected for default-base use and irrelevant to the static Pages build, but `vite preview` with `GITHUB_PAGES_BASE` set would not apply it. Local optional assets (`npm run assets:prepare`) are not part of the CI build, so Pages uses upstream-hosted models/catalog.
- Repo visibility and enabling Pages (Source: GitHub Actions) are left to the coordinator.
- Real-device behavior (iPhone Safari camera) NOT RUN.
