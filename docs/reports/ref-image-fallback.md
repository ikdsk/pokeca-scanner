# IMG-01 / #11 — Reference image fallback (TCGdex → TCGplayer)

Branch `feat/ref-image-fallback`, base 0d941a6.

## Change
- `src/ui/image-source.ts` (new): pure `referenceImageSources(card)` → ordered `{url, thumbUrl, source, creditLabel, creditHref}`.
  TCGdex first (https, host `assets.tcgdex.net` only, no port/userinfo; thumb = `low.webp`), then TCGplayer
  `https://tcgplayer-cdn.tcgplayer.com/product/{id}_in_600x600.jpg` (thumb `_200w.jpg`) only for decimal-digit ids. Credit → `https://www.tcgplayer.com/product/{id}`.
- `src/ui/reference-image.ts`: tries sources in order, `onerror` advances; credit reflects the source shown (画像提供：TCGdex / TCGplayer). Epoch guard kept. All fail → existing message, credit cleared (no credit for an image not shown). referrerPolicy/decoding/dimensions unchanged. Signature now derives from the source URLs.
- `src/ui/candidate-view.ts`: `thumbnailUrl(imageUrl)` replaced by `thumbnailUrls(card)` (fallback-ordered list). `imageUrl` field kept.
- `src/ui/scan-history.ts`: thumbnail walks `thumbnailUrls` on error.

## TDD (real commands)
| Step | RED | GREEN |
|---|---|---|
| image-source unit | `vitest run tests/unit/image-source.test.ts` → module not found, no tests | 3 passed |
| ReferenceImage + history thumb (Playwright, routed TCGdex 404 → TCGplayer 200) | `MVP_PORT=4197 playwright test --workers=1 --project=desktop reference-image-fallback` → 2 failed (fallback, thumbnail), 2 passed (regression guards) | 4 passed |
| `thumbnailUrls` unit | NOT observed RED: test and implementation were written in the same step | 5 passed |

## Verification
- `npm run check`: typecheck OK, vitest 25 files / 227 tests passed.
- `npm run build`: OK.
- Playwright, `--workers=1`, both projects, one spec at a time: reference-image-fallback 8 passed, scan-history 10 passed, pokemon-flow 36 passed, camera-first-design 4 passed.
- **Full Playwright suite: NOT RUN by IMG** (an earlier attempt was killed, exit 137, when run alongside another agent's suite). The coordinator runs it at integration. live-candidate, continuous-camera and candidate-immersive specs mention reference images/assets; they were not run individually either.

## Real check (Chromium 390x844, preview on :4196, real TCGdex API/prices and real recognition worker)
Input: card image from TCGplayer CDN pasted centered on a 1280x960 gray background (PIL), set through `#local-image`.
- **M2: Inferno X 001/080, Oddish (product 655780)**: recognized as ナゾノクサ (similarity 0.920, matched by number; TCGdex has no image). Reference image loaded from `https://tcgplayer-cdn.tcgplayer.com/product/655780_in_600x600.jpg` (HTTP 200), credit 画像提供：TCGplayer. Screenshot: `ref-image-fallback.png`. The reference figure is the small thumbnail in the candidate summary, and its figcaption/credit are hidden by existing CSS there.
- **SV4K 001/066, Pansage (565756)**: recognized as ヤナップ (0.942). Reference image from `https://assets.tcgdex.net/ja/SV/SV4K/001/high.webp` (HTTP 200), credit 画像提供：TCGdex, no TCGplayer request.
- Credits were read from the DOM text. Only the M2 case has a screenshot.

## Limits
- Mocked Playwright runs prove fallback wiring only. The real check uses clean catalog images, not phone photos.
- No jsdom in unit tests, so ReferenceImage DOM behavior is covered only by Playwright.
- TCGplayer image terms are unverified for public release (per the issue; fine for personal/Tailnet preview).
- Human iPhone Safari test: NOT RUN.
- main.ts/style.css: no change required (ReferenceImage and thumbnails are used through existing calls). Not checked against integration/p1 bfa8f0b (stayed on base); the coordinator should confirm PORT's "他の候補" thumbnails/detail sheet use `thumbnailUrls(card)` or `referenceImageSources(card)` instead of `thumbnailUrl(card.imageUrl)` (removed), and run `npm run check` after merge.
