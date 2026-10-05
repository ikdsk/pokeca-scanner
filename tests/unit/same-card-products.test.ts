import { expect, it } from 'vitest';
import { sameCardProducts, variantLabel } from '../../src/ui/same-card-products.js';
import type { ResolvedMatch } from '../../src/ui/alternative-candidates.js';
import type { PokeCard } from '../../src/data/pokemon.js';
// SYNTHETIC cards: product 2 is another TCGplayer product (pattern variant) of the same TCGdex card as product 1.
const card = (tcgplayerId: string, tcgdexId: string, variant: string | null = 'normal'): PokeCard => ({ tcgplayerId, tcgdexId, nameJa: 'テスト', setId: 'TST', setNameJa: 'テスト', localId: '001', officialCount: 66, rarity: null, regulationMark: null, category: null, hp: null, imageUrl: null, variant, matchMethod: 'tcgplayer_id' });
const match = (id: string, dex: string | null, score: number, variant: string | null = 'normal'): ResolvedMatch => ({ cardId: id, score, card: dex ? card(id, dex, variant) : null });
const current = card('1', 'TST-1');

it('lists other products resolving to the same TCGdex card with their own product id', () => {
  const list = sameCardProducts(current, [match('1', 'TST-1', .9), match('2', 'TST-1', .88, 'pokeball'), match('3', 'TST-3', .8)]);
  expect(list.map(x => x.tcgplayerId)).toEqual(['2']); expect(list[0]!.card.tcgplayerId).toBe('2');
});
it('omits unresolved matches, other cards and the current product; empty when none are known', () => {
  expect(sameCardProducts(current, [match('1', 'TST-1', .9), match('4', null, .8), match('3', 'TST-3', .7)])).toEqual([]);
  expect(sameCardProducts(current, [])).toEqual([]);
});
it('dedupes by product id and orders by score', () => {
  const list = sameCardProducts(current, [match('5', 'TST-1', .5), match('2', 'TST-1', .88), match('2', 'TST-1', .6)]);
  expect(list.map(x => x.tcgplayerId)).toEqual(['2', '5']);
});
it('labels variants in Japanese and never leaks an unknown raw value', () => {
  expect(variantLabel('pokeball')).toBe('モンスターボール柄'); expect(variantLabel('reverse')).toBe('リバース');
  expect(variantLabel('weird-x')).toBe('別商品'); expect(variantLabel(null)).toBe('別商品');
});
