# VISION-P1 report — recognition switched to `tcgplayer/pokemon-japan` (issue #2)

Branch `feat/vision-pokemon-japan` · implementer: Claude Sonnet 5.5 · date 2026-10-05.
Same detector (cornelius 2.12) and embedder (milo 1.0.0) as the MTG version; only the catalog, result shape and identity changed.

> **Preview notice.** CollectorVision's non-MTG catalogs are a *preview*: they are less validated than `scryfall/mtg`.
> Everything below is reference-image evidence on one desktop browser. It does not establish camera, iPhone or physical-card accuracy.

## What changed

| Area | Change |
|---|---|
| `public/recognition/catalog-feed-v2.json` | Snapshot of the live `milo1` / `tcgplayer/pokemon-japan` entry (feed `checked_at` 2026-10-04T13:15:12Z): base v10 (27,348 rows) + deltas v11–v16 → v16, 27,593 rows. Deltas v1–v10 are dropped because they are already folded into base v10. Deltas v7/v15 are records-only (no embeddings asset); the loader handles them. |
| `src/recognition/manifest.ts` | `version: 'milo1-pokemon-japan16-cornelius2.12'`, `catalog: { rows: 27593, dims: 128, versions: [10, 16] }`. |
| `public/recognition/lib/pokemon-catalog.mjs` (new) | Pure helpers: `indexRecords` (ids, names, `catalogMeta`), `searchTop` (top-k dot-product), `assertCompatibleCatalog` (key, model hash, dims, version range). |
| `public/recognition/scanner.worker.mjs` | `forGame("pokemon-japan")` with **`includeMetadata: true`** (needed for `catalogMeta`; the old `false` would have dropped set / collector number). Removed `scryfall_oracle`, secondary-id machinery and the legacy secondary-id loading. Search is now a top-5 scan with an O(k) insert instead of a per-row `Map` of identity scores. Result carries `cardId`, `cardName`, `catalogMeta`, `topMatches`. |
| `src/recognition/live-candidate.ts` | Identity = `cardId` (TCGplayer product id). |
| `src/recognition/adapter.ts` | `RecognitionResult` gains `cardName?`, `catalogMeta?`, `topMatches?`. First-load hint now 約17MB (was 約45MB). |
| `scripts/prepare-assets.mjs` | Mirrors the `tcgplayer/pokemon-japan` catalog. |
| `public/recognition/THIRD-PARTY-NOTICES.md` | Catalog paragraph rewritten (pokemon-japan, preview status). |
| Double-face logic | Left as is: it lives in the upstream-ported `collectorvision-catalog-v2.mjs`, is generic, and is harmless. The live catalog has 0 rows with `face_index > 0`. Untouched to keep the AGPL port diff small. |

Worker result contract (additive to docs/contracts.md):

```
cardId: "565756"                       // TCGplayer product id
cardName: "Pansage"                    // English, from the record
catalogMeta: { set: "SV4K: Ancient Roar", collectorNumber: "001/066", rarity: "Common", group: "23610" }  // fields null when absent
topMatches: [{ cardId, cardName, score } × up to 5]
score, margin (best − second-best row), cardPresent, cornersValid, corners, timing
```

Contract note: `group` is `identifiers.tcgplayer_group`, which PRICE needs for `quote(tcgplayerId, groupId)`.

## Strict TDD log (real commands/outcomes)

Baseline before any change: `npm run check` → 19 files / 158 tests passed.

| # | Behavior | RED | GREEN |
|---|---|---|---|
| 1 | Live-candidate identity is `cardId`; a stray `oracleId` is ignored (`live-candidate.test.ts`). `recognition`/`continuous-scan` tests rewritten from Oracle-id to product-id semantics, assertions kept. | `vitest run live-candidate continuous-scan` → 1 failed / 7 passed (new identity test) | 8 passed |
| 2 | Catalog client works against the bundled pokemon-japan feed (`catalog.test.mjs`: v15 snapshot → v16 update, records-only deltas in the fixture, cache keys `milo1/tcgplayer/pokemon-japan`) | 4 failed (`catalogs['tcgplayer/pokemon-japan']` undefined) | 4 passed after the feed snapshot |
| 3 | `indexRecords` / `searchTop` / `assertCompatibleCatalog` (3 new tests in `catalog.test.mjs`) | file failed: module `pokemon-catalog.mjs` not found | 7 passed |
| 4 | Manifest agrees with the bundled feed; first-load hint says 約17MB (`adapter.test.ts`) | 2 failed / 3 passed | 5 passed |

Final: `npm run check` → typecheck clean, **19 files / 164 tests passed**. `npm run build` → OK (tsc + vite build).
All unit tests are SYNTHETIC; none of them prove recognition quality.

## REAL pipeline check (reference images, NOT camera photos)

Method: headless Chromium (Playwright 1.59, desktop macOS, **WASM, 1 thread, no GPU**) runs the real `scanner.worker.mjs` with the real
models and the full 27,593-row v16 catalog from locally mirrored assets (`npm run assets:prepare`). Test frames are TCGdex `ja` reference images
(`https://assets.tcgdex.net/ja/SV/<SET>/<NNN>/high.webp`, not committed) drawn by canvas into frames:

- `fullbleed` — the card image fills the whole frame (no background).
- `onbg` — card at 80% of frame height on a brown striped background with a drop shadow.
- `onbg-rot180` — as `onbg`, rotated 180°.
- `onbg-tilt8` — as `onbg`, rotated 8°.

13 cards, 7 sets (SV4K, SV2a, SV3, SV4a, SV5a, SV7a, SV8a): Common/Uncommon, Double Rare, Super Rare, Art Rare, Special Art Rare, Shiny Rare, Shiny Secret Rare.
Expected id = catalog record matched by set + collector number. TCGdex independently confirms the TCGplayer id for 8 of 13 (including the two you named:
SV4K-001 ↔ 565756, SV4K-002 ↔ 565757). **The 5 SV2a cards have no `thirdParty.tcgplayer` in TCGdex `ja`**, so their truth rests on catalog metadata only.

| Variant | Top-1 | Top-5 | Corners detected |
|---|---|---|---|
| fullbleed | 10/13 | 11/13 | 12/13 |
| onbg | 12/13 | 13/13 | 13/13 |
| onbg-rot180 | 12/13 | 13/13 | 13/13 |
| onbg-tilt8 | 12/13 | 13/13 | 13/13 |

Per-case notes (full per-frame table was printed to the console; raw rows in `/tmp/pokeca-ref/results.json`, not committed):

- SV4K-001 → 565756 and SV4K-002 → 565757: top-1 in every `onbg*` variant (scores 0.96–0.98, margin ≈ 0.26–0.29).
- Normal / Art Rare / Special Art Rare / Super Rare / Shiny: top-1 in every `onbg*` variant, scores 0.76–0.97.
- **SV2a-010 Caterpie (Common): top-1 wrong in all 4 variants, top-2 correct.** The wrong id 566559 is "Caterpie - 010/165 (Poke Ball Pattern)": a separate TCGplayer product with the same set, collector number and art.
  This is a catalog ambiguity (two products for one printed card), not a detector failure. Margin 0.14–0.16.
- SV4K-002 `fullbleed`: wrong top-1 (570540 Jolteon V, score 0.52, margin 0.005) — low score and margin, so the tentative threshold 0.5 sits right at the edge.
- SV8a-207 `fullbleed`: no card detected (`cardPresent=false`). The detector expects some background around the card.
- Full-bleed accuracy being lower than `onbg` mirrors the MTG-era finding that tight crops hurt corner detection and dewarp; it is not representative of a hand-held camera.

Pokémon card aspect ratio and frame **do** work with the existing cornelius detector and dewarp on these reference images (13/13 corners with a background). That is not proof for real camera conditions (glare, holo foil, sleeves, blur).

### Timing / first load (desktop headless Chromium, 1 thread; indicative only)

- Per frame: median **≈ 278 ms** total (min 277, max 330) including detect + dewarp + 2 embeds (rotation-invariant) + search; search ≈ **6 ms** for 27,593 rows × 2 orientations.
- Init (`ready`) with local assets: cold **0.71 s**, warm (IndexedDB caches) **0.37 s**.
- Init over the real network (HuggingFace models, github.io catalog, jsDelivr ORT) in a fresh profile: cold **4.7 s**, warm **0.41 s**, `catalogFallback = null`, v16 / 27,593 rows. The "external bytes" counted by response `content-length` were 21.8 MB cold / 5.3 MB warm; this includes the ORT runtime and is not a clean app-payload figure.
- Asset sizes (from the feed and manifest): catalog base 6,847,395 B + deltas 113,622 B = **6,961,017 B (6.96 MB)**; models 4,407,545 + 5,191,100 = **9,598,645 B (9.60 MB)**; total **16,559,662 B ≈ 16.6 MB** (MTG was ≈ 45 MB). ORT WASM runtime (separate, jsDelivr) is 27.2 MB uncompressed.
- `dist` main JS bundle is 51.6 kB after this work (not compared against a pre-change build); worker and catalog code ship as static assets.
- Catalog is loaded with metadata now. Memory overhead was not measured.

## Limits and NOT RUN

- **NOT RUN:** real camera photos of physical cards; iPhone Safari (desktop headless Chromium is not iPhone Safari); WebGPU; memory/thermal measurements on a phone; sleeved or glare-prone cards; cards outside SV-era sets (older sets, promos); multi-card scenes.
- Reference images are clean digital art, so they overstate real-world accuracy. The `onbg` backgrounds are synthetic.
- Top-1 is inherently ambiguous for products that share a printed card (Poke Ball Pattern, Master Ball Pattern, reverse variants): `cardId` differs while `catalogMeta.set` + `collectorNumber` are identical. Top-5 helps; the UI should treat these as "same card, pick variant".
- Live-candidate identity is the product id (contract). Frame-to-frame jitter between two variants of the same card will therefore re-propose. If that shows up on devices, consider deduping by `catalogMeta.set + collectorNumber` in the coordinator's integration.
- `margin` is now best − second-best row (before: best − best of a different Oracle identity). The default tentative threshold (0.5) was not re-tuned.
- Bundled feed snapshot is pinned at v16; hash-verified assets stay valid indefinitely, but newer catalog versions need a snapshot refresh plus a manifest `versions` bump (the unit test checks the two stay in sync).
- `public/recognition/assets` and `vendor` are local, gitignored, and end up in `dist/` on build — do not deploy that.

## Findings for other agents / coordinator

1. **DATA:** TCGdex `ja` returns no `thirdParty.tcgplayer` for the 5 SV2a (151) cards I looked up (`variants_detailed[].thirdParty.tcgplayer` is absent). Under the contract's strict match rule, `resolveCard` returns `null` and those cards would not be shown. This needs a coordinator decision.
2. **DATA/UI:** Record names can carry a variant suffix ("Caterpie - 010/165 (Poke Ball Pattern)") and the English name may embed the number; don't parse `cardName` for matching, use `catalogMeta`.
3. **PRICE:** `catalogMeta.group` is the TCGplayer group id for the TCGCSV `prices` path.

## Required `src/main.ts` changes (not edited — coordinator-owned)

I kept two type-only shims so `npm run check` / `npm run build` stay green with the untouched `main.ts`:
`scryfallOracleId?: undefined` on `RecognitionResult` (`src/recognition/adapter.ts`) and `oracleId?: undefined` on `LiveCandidate.observe`'s parameter (`src/recognition/live-candidate.ts`). Neither has runtime effect.

Needed in `main.ts`:
1. Lines 335 and 363: `tentative.observe({...candidate,oracleId:candidate.scryfallOracleId},performance.now())` → `tentative.observe(candidate, performance.now())`.
2. Line 261: `tentative.accepted(captured.identity)` is still right (identity = cardId). Where the confirmed card is resolved, use `candidate.cardId` plus `candidate.catalogMeta` as `resolveCard(tcgplayerId, catalogMeta, signal)` inputs.
3. Optionally show `topMatches` as alternatives.
4. After main.ts no longer references them, delete the two shims.
