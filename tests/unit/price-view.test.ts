import { expect, it } from 'vitest';
import { priceView, type PriceInput } from '../../src/ui/price-view.js';
import type { UsdQuote } from '../../src/data/tcgplayer-price.js';
// SYNTHETIC quotes and FX; never current prices.
const quote = (subType: string, usdMarket: string | null, id = '565756'): UsdQuote => ({ tcgplayerId: id, subType, usdMarket, source: 'tcgplayer', providerUpdatedAt: '2026-10-04T20:05:38Z' });
const fx = { jpyPerUsd: 150, asOf: '2026-10-02' };
const base: PriceInput = { status: 'ready', quotes: [quote('Normal', '0.13')], variant: null, fx, fxError: false };
it('main line is approximate JPY with USD sub line, update time and the overseas-reference disclaimer', () => {
  const view = priceView({ ...base, quotes: [quote('Normal', '1.00')] });
  expect(view.heading).toBe('海外参考価格（TCGplayer）');
  expect(view.headline).toBe('概算 ￥150'); expect(view.usd).toBe('$1.00 USD');
  expect(view.updatedAt).toBe('価格更新 2026/10/05 05:05（日本時間）');
  expect(view.disclaimer).toBe('国内販売・買取価格ではありません');
  expect(view.fxNote).toBe('Frankfurter / ECB · 1 USD = 150 JPY · 最新公表日 2026-10-02');
});
it('keeps a real zero and never invents JPY without FX', () => {
  expect(priceView({ ...base, quotes: [quote('Normal', '0.00')] })).toMatchObject({ headline: '概算 ￥0', usd: '$0.00 USD' });
  const noFx = priceView({ ...base, fx: null, fxError: true });
  expect(noFx).toMatchObject({ headline: '概算JPYは利用できません', usd: '$0.13 USD', fxNote: '為替を取得できません。USDのみ表示します。' });
  expect(priceView({ ...base, fx: null }).fxNote).toBe('為替を確認中（取得できなければUSDのみ）');
});
it('null market price is "no price", not zero and not another subtype', () => {
  const view = priceView({ ...base, quotes: [quote('Normal', null)] });
  expect(view.headline).toBe('この商品の価格なし'); expect(view.usd).toBeNull();
  expect(priceView({ ...base, quotes: [] }).headline).toBe('この商品の価格データなし');
});
it('reports loading, missing snapshot and load errors without any price', () => {
  expect(priceView({ ...base, status: 'loading', quotes: [] })).toMatchObject({ headline: '価格を取得中…', usd: null });
  expect(priceView({ ...base, status: 'missing', quotes: [] })).toMatchObject({ headline: '価格データなし（npm run prices:snapshot で生成）', usd: null, updatedAt: null });
  expect(priceView({ ...base, status: 'error', quotes: [] })).toMatchObject({ headline: '価格を取得できません', usd: null });
});
it('single Holofoil subtype shows its price whatever the TCGdex variant (SYNTHETIC mirror of issue #10: holo + [[Holofoil, 0.33]])', () => {
  for (const variant of ['holo', 'normal', 'reverse', null]) {
    const view = priceView({ ...base, quotes: [quote('Holofoil', '0.33')], variant });
    expect(view.headline).toBe('概算 ￥50'); expect(view.usd).toBe('$0.33 USD'); expect(view.others).toEqual([]);
  }
  expect(priceView({ ...base, quotes: [quote('1st Edition', '2.00')], variant: 'holo' }).usd).toBe('$2.00 USD');
  expect(priceView({ ...base, quotes: [quote('Holofoil', null)], variant: 'holo' }).headline).toBe('この商品の価格なし');
  expect(priceView({ ...base, quotes: [quote('Holofoil', '0.00')], variant: 'holo' })).toMatchObject({ headline: '概算 ￥0', usd: '$0.00 USD' });
});
it('multiple subtypes: maps the variant and lists the others small (SYNTHETIC)', () => {
  const quotes = [quote('Reverse Holofoil', '0.50'), quote('Normal', '0.13'), quote('Holofoil', null)];
  const view = priceView({ ...base, quotes, variant: 'normal' });
  expect(view.usd).toBe('$0.13 USD'); expect(view.headline).toBe('概算 ￥20');
  expect(view.others).toEqual(['Reverse Holofoil $0.50 USD（概算 ￥75）', 'Holofoil 価格なし']);
  expect(priceView({ ...base, quotes, variant: 'reverse' }).usd).toBe('$0.50 USD');
  expect(priceView({ ...base, quotes: [quote('Normal', '0.13'), quote('Holofoil', '2.00')], variant: 'holo' }).usd).toBe('$2.00 USD');
});
it('multiple subtypes with an unknown variant never default to Normal (SYNTHETIC)', () => {
  const view = priceView({ ...base, quotes: [quote('Normal', '0.13'), quote('Holofoil', '2.00')], variant: null });
  expect(view.usd).toBeNull(); expect(view.headline).toBe('版により価格が異なります'); expect(view.others).toHaveLength(2);
});
it('multiple subtypes TCGdex cannot tell apart: no single headline, all subtypes listed (SYNTHETIC 1st Edition / Unlimited)', () => {
  const quotes = [quote('1st Edition', '5.00'), quote('Unlimited', '1.00')];
  for (const variant of ['normal', null]) {
    const view = priceView({ ...base, quotes, variant });
    expect(view.headline).toBe('版により価格が異なります'); expect(view.usd).toBeNull();
    expect(view.others).toEqual(['1st Edition $5.00 USD（概算 ￥750）', 'Unlimited $1.00 USD（概算 ￥150）']);
  }
  const noMatch = priceView({ ...base, quotes: [quote('Holofoil', '2.00'), quote('Reverse Holofoil', '0.50')], variant: 'normal' });
  expect(noMatch.usd).toBeNull(); expect(noMatch.headline).toBe('版により価格が異なります'); expect(noMatch.others).toHaveLength(2);
});
