import { describe, expect, it } from 'vitest';
import { JsonClient, ProviderError } from '../../src/data/http.js';
import { candidateTcgdexId, hare2SearchUrl, parseTcgdexCard, resolveCard } from '../../src/data/pokemon.js';

// All fixtures below are SYNTHETIC, modeled on facts verified 2026-10-05 (not live API output).
describe('candidateTcgdexId', () => {
  it('derives set code prefix + collector-number left part', () => {
    expect(candidateTcgdexId({ set: 'SV4K: Ancient Roar', collector_number: '001/066' })).toBe('SV4K-001');
  });
});
describe('candidateTcgdexId edge cases', () => {
  it('accepts a set without colon and a number without slash', () => {
    expect(candidateTcgdexId({ set: 'SV4K', collector_number: '001' })).toBe('SV4K-001');
  });
  it('returns null for missing, empty or unmappable values', () => {
    expect(candidateTcgdexId({})).toBeNull();
    expect(candidateTcgdexId({ set: ': Promo', collector_number: '001/066' })).toBeNull();
    expect(candidateTcgdexId({ set: 'SV4K: Ancient Roar', collector_number: '/066' })).toBeNull();
    expect(candidateTcgdexId({ set: 'Ancient Roar Promo', collector_number: '001' })).toBeNull();
    expect(candidateTcgdexId({ set: 'SV4K', collector_number: '../x' })).toBeNull();
  });
});

const card = (over: Record<string, unknown> = {}) => ({
  id: 'SV4K-001', name: 'ヤナップ', localId: '001', rarity: 'Common', regulationMark: 'G', category: 'Pokemon', hp: 70,
  image: 'https://assets.tcgdex.net/ja/SV/SV4K/001',
  set: { id: 'SV4K', name: '古代の咆哮', cardCount: { official: 66, total: 95 } },
  variants_detailed: [{ type: 'normal', thirdParty: { cardmarket: 741192, tcgplayer: 565756 } }],
  ...over,
});
describe('parseTcgdexCard', () => {
  it('maps a matching card (SYNTHETIC)', () => {
    expect(parseTcgdexCard(card(), '565756')).toEqual({
      tcgplayerId: '565756', tcgdexId: 'SV4K-001', nameJa: 'ヤナップ', setId: 'SV4K', setNameJa: '古代の咆哮', localId: '001',
      officialCount: 66, rarity: 'Common', regulationMark: 'G', category: 'Pokemon', hp: 70,
      imageUrl: 'https://assets.tcgdex.net/ja/SV/SV4K/001/high.webp', variant: 'normal',
    });
  });
});
describe('parseTcgdexCard rejection and validation', () => {
  it('returns null on tcgplayer id mismatch', () => { expect(parseTcgdexCard(card(), '999')).toBeNull(); });
  it('returns null when variants_detailed is missing or has no thirdParty', () => {
    expect(parseTcgdexCard(card({ variants_detailed: undefined }), '565756')).toBeNull();
    expect(parseTcgdexCard(card({ variants_detailed: [{ type: 'normal' }] }), '565756')).toBeNull();
  });
  it('compares string and numeric tcgplayer ids safely', () => {
    const c = card({ variants_detailed: [{ type: 'holo', thirdParty: { tcgplayer: '565756' } }] });
    expect(parseTcgdexCard(c, '565756')?.variant).toBe('holo');
  });
  it('returns null for non-object input', () => { expect(parseTcgdexCard(null, '1')).toBeNull(); expect(parseTcgdexCard([], '1')).toBeNull(); });
  it('keeps optional fields null instead of fabricating them', () => {
    const r = parseTcgdexCard(card({ rarity: undefined, hp: undefined, regulationMark: undefined, category: undefined, set: { id: 'SV4K', name: '古代の咆哮' } }), '565756')!;
    expect([r.rarity, r.hp, r.regulationMark, r.category, r.officialCount]).toEqual([null, null, null, null, null]);
  });
  it.each([
    'http://assets.tcgdex.net/ja/SV/SV4K/001', 'https://evil.example/ja/SV/SV4K/001', 'https://assets.tcgdex.net.evil.example/x',
    'https://user@assets.tcgdex.net/x', 'javascript:alert(1)', 'not a url', '',
  ])('rejects image url %s', image => { expect(parseTcgdexCard(card({ image }), '565756')?.imageUrl).toBeNull(); });
  it('has null imageUrl when image is absent', () => { expect(parseTcgdexCard(card({ image: undefined }), '565756')?.imageUrl).toBeNull(); });
});

const respond = (status: number, body: unknown = {}) => async () => new Response(JSON.stringify(body), { status });
const client = (fetcher: (url: string) => Promise<Response>) => new JsonClient(fetcher as unknown as typeof fetch, 0);
describe('resolveCard (fake fetch, no network)', () => {
  const meta = { set: 'SV4K: Ancient Roar', collector_number: '001/066' };
  it('fetches the derived TCGdex ja card and returns the match', async () => {
    const urls: string[] = [];
    const http = client(async url => { urls.push(url); return respond(200, card())(); });
    const r = await resolveCard('565756', meta, undefined, http);
    expect(urls).toEqual(['https://api.tcgdex.net/v2/ja/cards/SV4K-001']);
    expect(r?.nameJa).toBe('ヤナップ');
  });
  it('returns null on id mismatch', async () => { expect(await resolveCard('1', meta, undefined, client(respond(200, card())))).toBeNull(); });
  it('returns null on 404 and other ProviderError instead of throwing', async () => {
    expect(await resolveCard('565756', meta, undefined, client(respond(404)))).toBeNull();
    expect(await resolveCard('565756', meta, undefined, client(respond(500)))).toBeNull();
  });
  it('returns null without any request when the id cannot be derived', async () => {
    let calls = 0;
    expect(await resolveCard('565756', { set: 'Promo' }, undefined, client(async () => { calls++; return respond(200)(); }))).toBeNull();
    expect(calls).toBe(0);
  });
  it('rethrows aborts so callers can cancel', async () => {
    const ac = new AbortController(); ac.abort(new DOMException('x', 'AbortError'));
    await expect(resolveCard('565756', meta, ac.signal, client(respond(200, card())))).rejects.toThrow();
  });
  it('does not accept a non-numeric tcgplayer id into the URL path', async () => {
    expect(await resolveCard('565756', { set: 'SV4K/../x', collector_number: '001' }, undefined, client(respond(200, card())))).toBeNull();
  });
  it('ProviderError type is the shared one', () => { expect(new ProviderError('x', 404).status).toBe(404); });
});
describe('hare2SearchUrl', () => {
  it('follows the contract format (link only)', () => {
    const c = parseTcgdexCard(card(), '565756')!;
    expect(hare2SearchUrl(c)).toBe(`https://www.hareruya2.com/search?type=product&q=${encodeURIComponent('ヤナップ 001/66 SV4K')}`);
  });
  it('omits the /count part when officialCount is unknown', () => {
    const c = { ...parseTcgdexCard(card(), '565756')!, officialCount: null };
    expect(hare2SearchUrl(c)).toBe(`https://www.hareruya2.com/search?type=product&q=${encodeURIComponent('ヤナップ 001 SV4K')}`);
  });
});
