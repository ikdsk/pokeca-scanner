import { expect, it } from 'vitest';
import { PriceSession } from '../../src/ui/price-session.js';
import { SnapshotMissingError } from '../../src/ui/snapshot-loader.js';
import type { UsdQuote } from '../../src/data/tcgplayer-price.js';
import { pokeCard } from './fixtures.js';
// SYNTHETIC quotes/FX only.
const q = (id: string, usd: string): UsdQuote[] => [{ tcgplayerId: id, subType: 'Normal', usdMarket: usd, source: 'tcgplayer', providerUpdatedAt: null }];
const rate = { jpyPerUsd: 150, asOf: '2026-10-02' };
const other = { ...pokeCard, tcgplayerId: '2' };
it('goes loading then ready with quotes and FX', async () => {
  const s = new PriceSession(async id => q(id, '1.00'), async () => rate, () => {});
  const run = s.select(pokeCard);
  expect(s.value).toMatchObject({ card: pokeCard, status: 'loading', quotes: [] });
  await run;
  expect(s.value).toMatchObject({ status: 'ready', quotes: q('565756', '1.00'), fx: rate, fxError: false });
});
it('a late response for an older card is ignored and reset invalidates outstanding work', async () => {
  const pending: ((v: UsdQuote[]) => void)[] = [];
  const s = new PriceSession(() => new Promise(resolve => pending.push(resolve)), async () => rate, () => {});
  const a = s.select(pokeCard); const b = s.select(other);
  pending[1]!(q('2', '2.00')); await b; pending[0]!(q('565756', '99.00')); await a;
  expect(s.value.card?.tcgplayerId).toBe('2'); expect(s.value.quotes[0]!.usdMarket).toBe('2.00');
  const c = s.select(pokeCard); s.reset(); pending[2]!(q('565756', '5.00')); await c;
  expect(s.value).toMatchObject({ card: null, status: 'loading', quotes: [] });
});
it('missing snapshot, other errors and FX failure stay truthful', async () => {
  const missing = new PriceSession(async () => { throw new SnapshotMissingError(); }, async () => rate, () => {});
  await missing.select(pokeCard); expect(missing.value).toMatchObject({ status: 'missing', quotes: [] });
  const broken = new PriceSession(async () => { throw new Error('boom'); }, async () => { throw new Error('fx'); }, () => {});
  await broken.select(pokeCard); expect(broken.value).toMatchObject({ status: 'error', fxError: true, fx: null });
  const noFx = new PriceSession(async id => q(id, '0.00'), async () => { throw new Error('fx'); }, () => {});
  await noFx.select(pokeCard); expect(noFx.value).toMatchObject({ status: 'ready', fx: null, fxError: true }); expect(noFx.value.quotes[0]!.usdMarket).toBe('0.00');
});
