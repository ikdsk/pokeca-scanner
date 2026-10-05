import type { Page } from '@playwright/test';
// SYNTHETIC fixtures: canvas camera, fake recognition worker, TCGdex JSON, price snapshot and FX.
// Names, ids and prices are invented for tests. They are not provider data and prove nothing about
// real recognition, TCGdex/TCGplayer coverage or phone performance.

export type Product = { set: string; number: string; rarity?: string }; // rarity = TCGplayer name as in catalogMeta
// product id (TCGplayer-style decimal string) -> catalog row metadata the worker would report
export const products: Record<string, Product> = {
  '900001': { set: 'TST: Synthetic Set', number: '001/066', rarity: 'Super Rare' }, // TCGdex fixture says 'C': printed symbol must follow TCGplayer
  '900002': { set: 'TST: Synthetic Set', number: '002/066', rarity: 'Ultra Rare' }, // TCGdex fixture says 'R'
  '900003': { set: 'TST: Synthetic Set', number: '003/066', rarity: 'None' }, // unmapped -> no rarity shown
  '900021': { set: 'TST2: Synthetic Set Two', number: '161/165' },
  '900022': { set: 'TST2: Synthetic Set Two', number: '161/165' },
  '900011': { set: 'TST: Synthetic Set', number: '001/066' }, // another product of TST-001 (pattern variant)
  '900004': { set: 'TST: Synthetic Set', number: '004/066' },
  '900005': { set: 'TST: Synthetic Set', number: '005/066' },
  '900006': { set: 'TST: Synthetic Set', number: '006/066' },
  '900007': { set: 'TST: Synthetic Set', number: '007/066' },
  '900099': { set: 'TST: Synthetic Set', number: '099/066' }, // no TCGdex card -> must stay hidden
};

type Dex = Record<string, unknown>;
const dex = (id: string, localId: string, name: string, setId: string, setName: string, extra: Dex = {}): Dex => ({
  id, localId, name, rarity: 'C', regulationMark: 'G', category: 'Pokemon', hp: 70,
  image: `https://assets.tcgdex.net/ja/TST/${setId}/${localId}`, set: { id: setId, name: setName, cardCount: { official: 66 } }, ...extra,
});
export const tcgdexCards: Record<string, Dex> = {
  'TST-001': dex('TST-001', '001', 'テストA', 'TST', 'テスト拡張', { variants_detailed: [{ type: 'normal', thirdParty: { tcgplayer: 900001 } }, { type: 'pokeball', thirdParty: { tcgplayer: 900011 } }] }),
  'TST-002': dex('TST-002', '002', 'テストB', 'TST', 'テスト拡張', { rarity: 'R', regulationMark: 'H', variants_detailed: [{ type: 'normal', thirdParty: { tcgplayer: 900002 } }] }),
  'TST-003': dex('TST-003', '003', 'テストC', 'TST', 'テスト拡張', { variants_detailed: [{ type: 'normal', thirdParty: { tcgplayer: 900003 } }] }),
  'TST-004': dex('TST-004', '004', 'テストE', 'TST', 'テスト拡張', { variants_detailed: [{ type: 'normal', thirdParty: { tcgplayer: 900004 } }] }),
  'TST-005': dex('TST-005', '005', 'テストF', 'TST', 'テスト拡張', { variants_detailed: [{ type: 'normal', thirdParty: { tcgplayer: 900005 } }] }),
  'TST-006': dex('TST-006', '006', 'テストG', 'TST', 'テスト拡張', { variants_detailed: [{ type: 'normal', thirdParty: { tcgplayer: 900006 } }] }),
  // No tcgplayer cross reference at all: matched by set code + number (matchMethod set_number).
  'TST2-161': dex('TST2-161', '161', 'テストD', 'TST2', 'テスト拡張2', { set: { id: 'TST2', name: 'テスト拡張2', cardCount: { official: 165 } }, variants_detailed: [{ type: 'normal' }] }),
};
export const snapshot = {
  source: 'tcgcsv/tcgplayer', category: 85, fetchedAt: '2026-10-05T00:00:00Z', providerUpdatedAt: '2026-10-04T20:05:38Z',
  prices: {
    '900001': [['Normal', 1.0]], '900002': [['Normal', 2.0], ['Reverse Holofoil', 3.5]], '900003': [['Normal', 0]],
    '900021': [['Normal', 0.5]], '900022': [['Normal', 0.5]], '900011': [['Normal', 4.0]], '900004': [['Normal', 5.0]], '900005': [['Normal', 6.0]], '900006': [['Normal', 7.0]],
  },
};
export const fxOk = { base: 'USD', quote: 'JPY', rate: 150, date: '2026-10-02' };
export const cardSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="488" height="680"><rect width="488" height="680" fill="#4e5973"/><text x="20" y="150" fill="white" font-size="48">TEST ONLY</text></svg>';

export type FlowOptions = {
  prices?: unknown | 'missing' | 'html';
  fx?: 'ok' | 'fail';
  portrait?: boolean;
  longName?: string; // SYNTHETIC: replaces the Japanese name of TST-001 to exercise truncation
};
export async function installPokemonFlow(page: Page, options: FlowOptions = {}): Promise<{ tcgdexRequests: string[] }> {
  await page.addInitScript(({ products, portrait }) => {
    const state = { id: '900001', top: [] as { id: string; score: number }[], present: true, hold: false, frames: 0, inits: 0, started: [] as number[], score: .623, margin: .01, latency: 10, sizes: [] as number[][] };
    Object.assign(window, { continuousProbe: state, immersiveProbe: state });
    navigator.mediaDevices.getUserMedia = async () => {
      const c = document.createElement('canvas'); c.width = portrait ? 720 : 1280; c.height = portrait ? 1280 : 720;
      const ctx = c.getContext('2d')!; ctx.fillStyle = '#252934'; ctx.fillRect(0, 0, c.width, c.height);
      const stream = c.captureStream(portrait ? 12 : 5); Object.assign(window, { immersiveStream: stream }); return stream;
    };
    class SyntheticWorker {
      onmessage: ((e: { data: unknown }) => void) | null = null;
      postMessage(data: { type: string; bitmap?: ImageBitmap }) {
        if (data.bitmap) state.sizes.push([data.bitmap.width, data.bitmap.height]);
        data.bitmap?.close(); if (data.type === 'frame') state.frames++; if (data.type === 'init') { state.inits++; state.started.push(performance.now()); }
        if (state.hold && data.type === 'frame') return;
        const snapshot = { ...state }; const meta = (products as Record<string, { set: string; number: string; rarity?: string }>)[snapshot.id];
        setTimeout(() => this.onmessage?.({ data: data.type === 'init' ? { type: 'ready', catalogVersion: 52 } : {
          type: 'result', cardId: snapshot.id, cardName: 'SYNTHETIC English name', catalogMeta: meta ? { set: meta.set, collectorNumber: meta.number, rarity: meta.rarity ?? null, group: null } : null,
          topMatches: (snapshot.top.length ? snapshot.top : [{ id: snapshot.id, score: snapshot.score }]).map(m => { const mm = (products as Record<string, { set: string; number: string; rarity?: string }>)[m.id]; return { cardId: m.id, cardName: null, catalogMeta: mm ? { set: mm.set, collectorNumber: mm.number, rarity: mm.rarity ?? null, group: null } : null, score: m.score }; }),
          cardPresent: snapshot.present, cornersValid: snapshot.present, corners: [[.1, .1], [.9, .1], [.9, .9], [.1, .9]], score: snapshot.score, margin: snapshot.margin,
        } }), data.type === 'init' ? 10 : snapshot.latency);
      }
      terminate() {}
    }
    Object.defineProperty(window, 'Worker', { value: SyntheticWorker });
  }, { products, portrait: options.portrait ?? false });
  const tcgdexRequests: string[] = [];
  await page.route('https://api.tcgdex.net/v2/ja/cards/**', route => {
    const id = decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop()!);
    tcgdexRequests.push(id);
    return tcgdexCards[id] ? route.fulfill({ json: id === 'TST-001' && options.longName ? { ...tcgdexCards[id], name: options.longName } : tcgdexCards[id] }) : route.fulfill({ status: 404, json: {} });
  });
  await page.route('https://assets.tcgdex.net/**', route => route.fulfill({ contentType: 'image/svg+xml', body: cardSvg }));
  await page.route('**/prices/pokemon-japan-usd.json', route => {
    if (options.prices === 'missing') return route.fulfill({ status: 404, body: 'not found' });
    if (options.prices === 'html') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>fallback</title>' });
    return route.fulfill({ json: options.prices ?? snapshot });
  });
  await page.route('https://api.frankfurter.dev/**', route => options.fx === 'fail' ? route.fulfill({ status: 503, json: {} }) : route.fulfill({ json: fxOk }));
  return { tcgdexRequests };
}
export const startScan = (page: Page) => page.getByRole('button', { name: 'スキャン開始', exact: true }).click();
export const setProbe = (page: Page, patch: Record<string, unknown>) => page.evaluate(p => Object.assign((window as unknown as { continuousProbe: object }).continuousProbe, p), patch);
export const frames = (page: Page) => page.evaluate(() => (window as unknown as { continuousProbe: { frames: number } }).continuousProbe.frames);
export const tinyPng = (page: Page) => page.evaluate(() => { const c = document.createElement('canvas'); c.width = c.height = 2; return c.toDataURL().split(',')[1]!; });
