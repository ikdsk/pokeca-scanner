import { describe, expect, it } from 'vitest';
import { chooseQuote, createTcgplayerPrice, parseSnapshot, type UsdQuote } from '../../src/data/tcgplayer-price.js';

// All snapshots below are SYNTHETIC fixtures (shape of scripts/price-snapshot.mjs output), not provider observations.
const base = { source: 'tcgcsv/tcgplayer', category: 85, fetchedAt: '2026-10-05T21:00:00.000Z', providerUpdatedAt: '2026-10-05T20:00:00.000Z' };

describe('parseSnapshot', () => {
  it('accepts the documented snapshot shape', () => {
    const snapshot = parseSnapshot({ ...base, prices: { '1001': [['Normal', 0.13]] } });
    expect(snapshot.prices.get('1001')).toEqual([['Normal', 0.13]]);
    expect(snapshot.providerUpdatedAt).toBe('2026-10-05T20:00:00.000Z');
  });
  it('rejects malformed snapshots instead of guessing', () => {
    const bad: unknown[] = [
      null, [], 'x', {},
      { ...base, source: 'other', prices: {} },
      { ...base, category: 86, prices: {} },
      { ...base, fetchedAt: 'yesterday', prices: {} },
      { ...base, providerUpdatedAt: 5, prices: {} },
      { ...base, prices: null },
      { ...base, prices: { '1': 'Normal' } },
      { ...base, prices: { '1': [['Normal']] } },
      { ...base, prices: { '1': [[7, 1]] } },
      { ...base, prices: { '1': [['Normal', '0.13']] } },
      { ...base, prices: { '1': [['Normal', -1]] } },
      { ...base, prices: { '1': [['Normal', Number.NaN]] } },
      { ...base, prices: { '1': [['Normal', Infinity]] } },
      { ...base, prices: { 'abc': [['Normal', 1]] } },
      { ...base, prices: { '1': [['Normal', 1], ['Normal', 2]] } },
    ];
    for (const raw of bad) expect(() => parseSnapshot(raw), JSON.stringify(raw)).toThrow(/snapshot/i);
  });
  it('accepts a null providerUpdatedAt and empty prices', () => {
    expect(parseSnapshot({ ...base, providerUpdatedAt: null, prices: {} }).providerUpdatedAt).toBeNull();
  });
});

describe('quote', () => {
  const snapshot = { ...base, prices: { '1001': [['Normal', 0.13], ['Holofoil', 12.5]], '1002': [['Normal', null]], '1003': [['Normal', 0]], '1004': [['Normal', 1234.5]] } };
  const price = createTcgplayerPrice(async () => snapshot);
  it('returns every subtype as a UsdQuote with 2-digit decimal strings', async () => {
    expect(await price.quote('1001')).toEqual([
      { tcgplayerId: '1001', subType: 'Normal', usdMarket: '0.13', source: 'tcgplayer', providerUpdatedAt: base.providerUpdatedAt },
      { tcgplayerId: '1001', subType: 'Holofoil', usdMarket: '12.50', source: 'tcgplayer', providerUpdatedAt: base.providerUpdatedAt },
    ]);
  });
  it('keeps null as null and zero as 0.00', async () => {
    expect((await price.quote('1002'))[0]?.usdMarket).toBeNull();
    expect((await price.quote('1003'))[0]?.usdMarket).toBe('0.00');
    expect((await price.quote('1004'))[0]?.usdMarket).toBe('1234.50');
  });
  it('returns an empty list for unknown ids and ignores the optional group id', async () => {
    expect(await price.quote('999')).toEqual([]);
    expect(await price.quote('1002', '23610')).toHaveLength(1);
  });
  it('loads the snapshot once and shares it across calls', async () => {
    let calls = 0;
    const counted = createTcgplayerPrice(async () => { calls += 1; return snapshot; });
    await Promise.all([counted.quote('1001'), counted.quote('1002')]);
    await counted.quote('1003');
    expect(calls).toBe(1);
  });
  it('rejects on an invalid snapshot and retries the loader next time', async () => {
    let calls = 0;
    const flaky = createTcgplayerPrice(async () => (++calls === 1 ? { nope: true } : snapshot));
    await expect(flaky.quote('1001')).rejects.toThrow(/snapshot/i);
    expect(await flaky.quote('1001')).toHaveLength(2);
  });
  it('rejects an aborted caller without poisoning the shared load', async () => {
    let calls = 0;
    const shared = createTcgplayerPrice(async () => { calls += 1; return snapshot; });
    const controller = new AbortController();
    controller.abort();
    await expect(shared.quote('1001', undefined, controller.signal)).rejects.toThrow();
    expect(await shared.quote('1001')).toHaveLength(2);
    expect(calls).toBeLessThanOrEqual(1);
  });
});

describe('chooseQuote', () => {
  const q = (subType: string): UsdQuote => ({ tcgplayerId: '1', subType, usdMarket: '1.00', source: 'tcgplayer', providerUpdatedAt: null });
  it('returns the sole quote when no variant is requested', () => {
    expect(chooseQuote([q('Normal')])).toEqual(q('Normal'));
  });
  it('returns null (never guesses) when several subtypes exist and none is requested', () => {
    expect(chooseQuote([q('Normal'), q('Holofoil')])).toBeNull();
  });
  it('matches a requested variant exactly, ignoring case', () => {
    expect(chooseQuote([q('Normal'), q('Holofoil')], 'holofoil')).toEqual(q('Holofoil'));
  });
  it('does not fall back to another subtype when the requested one is missing', () => {
    expect(chooseQuote([q('Normal')], 'Holofoil')).toBeNull();
    expect(chooseQuote([], undefined)).toBeNull();
  });
});
