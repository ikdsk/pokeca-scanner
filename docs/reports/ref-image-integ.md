# IMG-INTEG report (issue #11)

Branch `integ/ref-image-fallback` = `integration/p1` bfa8f0b + merge of `feat/ref-image-fallback` (3f7b830) + fixes.

## Changes
- `src/main.ts`: removed `thumbnailUrl` import; alternatives thumbnails use `thumbnailUrls(card)` with `onerror` advancing to the next URL, removing the image only after all fail.
- Dock summary and detail sheet (live and history-opened) already share the single `ReferenceImage` instance (`tentativeReference`), so they use the fallback chain and credit. The credit is visible in the detail sheet without CSS changes (verified by test and screenshot).
- `tests/browser/reference-image-fallback.spec.ts` rewritten for the ported UI (6 tests x 2 projects): TCGdex used + no CDN request; TCGplayer fallback with credit/link/no-referrer/488x680 in dock and sheet; history-opened sheet fallback + credit; unavailable message when all fail; history thumbnails fall back; alternatives thumbnails fall back (new).

## TDD
- RED: with alternatives `onerror` = `image.remove()` (no chain), the new alternatives test failed on both projects (`src` attribute expected `.../900001_200w.jpg`, element not found); the other 10 passed. (An earlier RED attempt failed for a test-setup reason and was corrected before this result.)
- GREEN: with the fallback chain, 12/12.
- Note: the detail-sheet credit-visibility assertions passed before any CSS change, so no CSS was added.

## Verification
- `npm run check`: typecheck OK, 27 files / 238 unit tests pass. `npm run build`: OK.
- Playwright, one worker each (`MVP_PORT=4241`): reference-image-fallback 12 passed; scan-history 10; pokemon-flow 36; alternatives-products 12; scan-view-save 10; camera-first-design 4. Full suite not run (coordinator).
- Real check (Chromium 390x844, vite preview :4195, /tmp/ubbg_665887.jpg, M2a ハイパーボール): TCGdex card API called, no TCGdex image; dock and sheet both load `tcgplayer-cdn.../665887_in_600x600.jpg` (naturalWidth 425); sheet credit "画像提供：TCGplayer · 参照画像" with a visible link. Screenshot: `ref-image-integ-detail.png`.

## Limits
- One real card on desktop Chromium only; not iPhone Safari. Synthetic specs prove wiring, not real image coverage.
- Real-network alternatives/history thumbnails were not checked against live CDN.
