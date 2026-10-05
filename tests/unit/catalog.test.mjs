import { expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { BrowserCatalogV2, CatalogV2FeedClient } from '../../public/recognition/lib/collectorvision-catalog-v2.mjs';

// SYNTHETIC compatible cached snapshot and failed update; no model execution.
async function fixture() {
  const feed = JSON.parse(await readFile(new URL('../../public/recognition/catalog-feed-v2.json', import.meta.url)));
  const family = feed.families.milo1;
  const catalog = family.catalogs['tcgplayer/pokemon-japan'];
  catalog.rows = catalog.base.rows = 1;
  for (const update of Object.values(catalog.updates)) {
    update.rows = { added: 0, updated: 1, deleted: 0 };
    // records-only deltas (e.g. v15) carry no embeddings asset
    update.recognition_rows = update.assets.embeddings ? 1 : 0; update.metadata_rows = update.assets.embeddings ? 0 : 1;
  }
  const previous = new BrowserCatalogV2({ familyKey: 'milo1', catalogKey: 'milo1/tcgplayer/pokemon-japan', publicName: catalog.public_name, descriptor: catalog.descriptor, embedding: family.embedding, version: 15, sourceUpdatedAt: '2026-09-24', records: [{ id: 'SYNTHETIC', name: 'Fixture', identifiers: {}, faceIndex: 0 }], embeddings: new Uint16Array(128), metadataLoaded: false });
  const cache = { get: vi.fn(async version => version === 15 ? previous : null), put: vi.fn(), delete: vi.fn() };
  const fetchImpl = vi.fn(async url => String(url).endsWith('feed.json') ? new Response(JSON.stringify(feed)) : new Response('update unavailable', { status: 503 }));
  return { feed, previous, cache, fetchImpl };
}
it('keeps the last complete compatible catalog active when update fails (SYNTHETIC)', async () => {
  const { previous, cache, fetchImpl } = await fixture();
  const client = new CatalogV2FeedClient({ fetchImpl, feedUrl: 'https://fixture.example/feed.json', cache });
  const result = await client.loadGame('pokemon-japan', { includeMetadata: false });
  expect(result.version).toBe(15);
  expect(result.records).toEqual(previous.records);
  expect(result.embeddings).toEqual(previous.embeddings);
  expect(result.updateError).toContain('503');
  expect(cache.put).not.toHaveBeenCalled();
  expect(cache.delete).not.toHaveBeenCalled();
});
it('never falls back to a snapshot from a different embedding model (SYNTHETIC)', async () => {
  const { previous, cache, fetchImpl } = await fixture();
  previous.embedding = { ...previous.embedding, model: 'different-model@sha256:bad' };
  const client = new CatalogV2FeedClient({ fetchImpl, feedUrl: 'https://fixture.example/feed.json', cache });
  await expect(client.loadGame('pokemon-japan', { includeMetadata: false })).rejects.toThrow('503');
  expect(cache.put).not.toHaveBeenCalled();
});
it('resumes a failed update, validates complete candidate and persists it atomically (SYNTHETIC)', async () => {
  const { feed, previous, cache } = await fixture();
  const { gzipSync } = await import('node:zlib');
  const { createHash } = await import('node:crypto');
  const record = { id: 'SYNTHETIC', name: 'Updated fixture', identifiers: {} };
  const records = gzipSync(JSON.stringify({ op: 'upsert', record, embedding_index: 0 }) + '\n');
  const embeddings = gzipSync(Buffer.alloc(256));
  const assets = feed.families.milo1.catalogs['tcgplayer/pokemon-japan'].updates['16'].assets;
  for (const [key, bytes] of Object.entries({ records, embeddings })) {
    assets[key].size = bytes.length;
    assets[key].sha256 = createHash('sha256').update(bytes).digest('hex');
  }
  let available = false;
  const fetchImpl = vi.fn(async url => String(url).endsWith('feed.json') ? new Response(JSON.stringify(feed)) : available ? new Response(String(url).includes('records') ? records : embeddings) : new Response('', { status: 503 }));
  const client = new CatalogV2FeedClient({ fetchImpl, feedUrl: 'https://fixture.example/feed.json', cache });
  const fallback = await client.loadGame('pokemon-japan', { includeMetadata: false });
  expect(fallback.version).toBe(15); expect(cache.put).not.toHaveBeenCalled();
  available = true;
  const updated = await client.loadGame('pokemon-japan', { includeMetadata: false });
  expect(updated.version).toBe(16); expect(updated.updateError).toBeNull();
  expect(updated.records[0].name).toBe('Updated fixture');
  expect(previous.records[0].name).toBe('Fixture');
  expect(cache.put).toHaveBeenCalledExactlyOnceWith(updated);
  expect(cache.delete).toHaveBeenCalledWith(15, 'milo1/tcgplayer/pokemon-japan', false);
});

it('retains v15 after quota failure and a fresh client can use it offline (SYNTHETIC)', async () => {
  const { feed, previous } = await fixture();
  const { gzipSync } = await import('node:zlib');
  const { createHash } = await import('node:crypto');
  const records = gzipSync(JSON.stringify({ op: 'upsert', record: { id: 'SYNTHETIC', name: 'Updated fixture', identifiers: {} }, embedding_index: 0 }) + '\n');
  const embeddings = gzipSync(Buffer.alloc(256));
  const assets = feed.families.milo1.catalogs['tcgplayer/pokemon-japan'].updates['16'].assets;
  for (const [key, bytes] of Object.entries({ records, embeddings })) {
    assets[key].size = bytes.length; assets[key].sha256 = createHash('sha256').update(bytes).digest('hex');
  }
  const stored = new Map([[15, previous]]);
  const cache = { get: async v => stored.get(v) ?? null, put: vi.fn(async () => { throw new DOMException('controlled quota failure', 'QuotaExceededError'); }), delete: vi.fn(async v => { stored.delete(v); }) };
  let offline = false;
  const fetchImpl = async url => String(url).endsWith('feed.json') ? new Response(JSON.stringify(feed)) : offline ? new Response('', { status: 503 }) : new Response(String(url).includes('records') ? records : embeddings);
  const options = { fetchImpl, feedUrl: 'https://fixture.example/feed.json', cache };
  expect((await new CatalogV2FeedClient(options).loadGame('pokemon-japan', { includeMetadata: false })).version).toBe(16);
  expect(cache.put).toHaveBeenCalledOnce();
  offline = true;
  const reloaded = await new CatalogV2FeedClient(options).loadGame('pokemon-japan', { includeMetadata: false });
  expect(reloaded.version).toBe(15);
  expect(reloaded.records).toEqual(previous.records);
  expect(reloaded.embeddings).toEqual(previous.embeddings);
  expect(reloaded.updateError).toContain('503');
  expect(cache.delete).not.toHaveBeenCalled();
  expect(stored.get(15)).toBe(previous);
});

// --- pokemon-japan worker helpers (pure; SYNTHETIC inputs shaped like real v16 records) ---
import { indexRecords, searchTop, assertCompatibleCatalog, POKEMON_CATALOG_KEY } from '../../public/recognition/lib/pokemon-catalog.mjs';
const pansage = { id: '565756', name: 'Pansage', faceIndex: 0, identifiers: { tcgplayer_category: '85', tcgplayer_group: '23610' }, metadata: { category: 'Pokemon Japan', collector_number: '001/066', rarity: 'Common', set: 'SV4K: Ancient Roar' } };
it('indexes ids, names and catalogMeta from tcgplayer records without Oracle ids (SYNTHETIC)', () => {
  const bare = { id: '1', name: 'No metadata', faceIndex: 0, identifiers: {} };
  const index = indexRecords([pansage, bare]);
  expect(index.cardIds).toEqual(['565756', '1']);
  expect(index.cardNames).toEqual(['Pansage', 'No metadata']);
  expect(index.catalogMeta[0]).toEqual({ set: 'SV4K: Ancient Roar', collectorNumber: '001/066', rarity: 'Common', group: '23610' });
  expect(index.catalogMeta[1]).toEqual({ set: null, collectorNumber: null, rarity: null, group: null });
  expect('secondaryIds' in index).toBe(false);
});
it('returns the top-k rows by dot product, best first, ties by row order (SYNTHETIC)', () => {
  const lookup = Float32Array.from([0, 1, 2, 3]);
  const embeddings = Uint16Array.from([1, 0,  3, 0,  2, 0,  3, 0,  0, 1]); // dims 2, 5 rows
  expect(searchTop(embeddings, 5, 2, [1, 0], lookup, 3)).toEqual([{ index: 1, score: 3 }, { index: 3, score: 3 }, { index: 2, score: 2 }]);
  expect(searchTop(embeddings, 5, 2, [1, 0], lookup, 10)).toHaveLength(5);
  expect(searchTop(embeddings, 0, 2, [1, 0], lookup, 3)).toEqual([]);
});
it('rejects catalogs for another key, model, dimension or version range (SYNTHETIC)', () => {
  const manifest = { model_hashes: { milo: 'sha256:abc' }, catalog: { dims: 128, versions: [10, 16] } };
  const good = { catalogKey: POKEMON_CATALOG_KEY, embedding: { model: 'x@sha256:abc' }, dimension: 128, version: 16 };
  expect(() => assertCompatibleCatalog(good, manifest)).not.toThrow();
  expect(() => assertCompatibleCatalog({ ...good, catalogKey: 'milo1/scryfall/mtg' }, manifest)).toThrow('catalog');
  expect(() => assertCompatibleCatalog({ ...good, embedding: { model: 'x@sha256:bad' } }, manifest)).toThrow('model');
  expect(() => assertCompatibleCatalog({ ...good, dimension: 64 }, manifest)).toThrow('dimensions');
  expect(() => assertCompatibleCatalog({ ...good, version: 9 }, manifest)).toThrow('version');
  expect(() => assertCompatibleCatalog({ ...good, version: 17 }, manifest)).toThrow('version');
});
