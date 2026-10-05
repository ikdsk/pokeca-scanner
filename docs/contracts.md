# Contract v1 — Pokéca Scanner

Coordinator-owned. Reused unchanged from the MTG version unless noted.

## Reused domains (unchanged)
- `src/domain/pricing.ts` — `formatReferencePrice(usd, fx)`: USD string → USD/JPY labels; null ≠ 0; bad FX keeps USD.
- `src/domain/selection.ts` — generation/revision guards against stale responses.
- `FxProvider` (Frankfurter/ECB USD/JPY) in `src/data/repository.ts`.

## Recognition (VISION, issue #2)
- Catalog: CollectorVision catalog v2, family `milo1`, catalog `tcgplayer/pokemon-japan`
  (feed `https://hanclinto.github.io/CollectorVisionCatalog/catalog-v2/catalog-feed-v2.json`).
- Worker result: `{ cardId: string /* TCGplayer product id, decimal string */, name: string /* English, from record */, score, margin, cardPresent, cornersValid, corners?, timing? }`.
- The worker may also pass record metadata `{ set: string /* e.g. "SV4K: Ancient Roar" */, collectorNumber: string /* "001/066" */, rarity: string }` as `catalogMeta`.
- Identity for live-candidate dedup = `cardId` (no Oracle-id equivalent exists for TCGplayer).

## Japanese card data (DATA, issue #3) — `src/data/pokemon.ts`
```ts
type PokeCard = {
  tcgplayerId: string;          // CollectorVision result id
  tcgdexId: string;             // e.g. "SV4K-001"
  nameJa: string;               // e.g. "ヤナップ"
  setId: string;                // "SV4K"
  setNameJa: string;            // "古代の咆哮"
  localId: string;              // "001"
  officialCount: number | null; // 66
  rarity: string | null;
  regulationMark: string | null;// "G"
  category: string | null;      // Pokemon / Trainer / Energy
  hp: number | null;
  imageUrl: string | null;      // https://assets.tcgdex.net/... (validated host)
  variant: string | null;       // TCGdex variant type for this tcgplayer id
};
resolveCard(tcgplayerId, catalogMeta, signal): Promise<PokeCard | null>
```
- Match rule: derive candidate TCGdex id from `catalogMeta` (set code prefix + collector-number left part),
  fetch `GET https://api.tcgdex.net/v2/ja/cards/{id}`, ACCEPT only if some
  `variants_detailed[].thirdParty.tcgplayer` equals `tcgplayerId`. Otherwise return null (do not display).
- TCGdex responds with `Access-Control-Allow-Origin: *` (verified 2026-10-05).

## Price (PRICE, issue #4) — `src/data/tcgplayer-price.ts`
```ts
type UsdQuote = { tcgplayerId: string; subType: string; usdMarket: string | null; source: 'tcgplayer'; providerUpdatedAt: string | null };
quote(tcgplayerId, groupId?, signal): Promise<UsdQuote[]>
```
- Source candidate: TCGCSV mirror `https://tcgcsv.com/tcgplayer/85/{groupId}/prices` (category 85 = Pokemon Japan, daily ~20:00 UTC).
  Verified: group 23610 (SV4K) product 565756 → marketPrice 0.13 Normal.
- TCGCSV returns NO CORS header (verified 2026-10-05): browser direct fetch is not possible. PRICE must propose
  build-time snapshot or proxy to coordinator; any public proxy/deploy needs user approval.
- `usdMarket` null when absent; 0 stays 0. Never substitute another subType silently.

## UI (UI, issue #5)
- Replace MTG format badges with regulation mark + (later) standard legality; remove Scryfall/mana wording.
- Hareruya2 link: `https://www.hareruya2.com/search?type=product&q=${encodeURIComponent(`${nameJa} ${localId}/${officialCount} ${setId}`)}`.
  Link only; no fetch of Hareruya2.
