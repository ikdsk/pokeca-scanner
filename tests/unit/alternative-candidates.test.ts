import { expect, it } from 'vitest';
import { alternativeCandidates, ALTERNATIVES_MAX, type ResolvedMatch } from '../../src/ui/alternative-candidates.js';
import type { PokeCard } from '../../src/data/pokemon.js';
// SYNTHETIC cards and scores.
const card = (tcgplayerId: string, tcgdexId: string): PokeCard => ({ tcgplayerId, tcgdexId, nameJa: `カード${tcgdexId}`, setId: 'TST', setNameJa: 'テスト', localId: '001', officialCount: 66, rarity: null, regulationMark: 'G', category: null, hp: null, imageUrl: null, variant: 'normal', matchMethod: 'tcgplayer_id' });
const match = (id: string, dex: string | null, score: number): ResolvedMatch => ({ cardId: id, score, card: dex ? card(id, dex) : null });
const current = { cardId: '1', score: .8, card: card('1', 'TST-1') };

it('lists the current candidate first-class even when no other match resolves', () => {
  const list = alternativeCandidates(current, []);
  expect(list).toHaveLength(1); expect(list[0]).toMatchObject({ cardId: '1', current: true, score: .8 });
});
it('shows only resolved cards: unresolved matches are dropped, never shown by id', () => {
  const list = alternativeCandidates(current, [match('2', null, .79), match('3', 'TST-3', .7)]);
  expect(list.map(x => x.cardId)).toEqual(['1', '3']);
});
it('dedupes by TCGdex id; the current candidate wins and another product of it is not an alternative', () => {
  const list = alternativeCandidates(current, [match('9', 'TST-1', .95), match('3', 'TST-3', .7), match('4', 'TST-3', .75)]);
  expect(list.map(x => x.cardId)).toEqual(['1', '4']); expect(list[0]!.current).toBe(true); expect(list[1]!.current).toBe(false);
});
it('sorts by score descending and caps at four while always keeping the current candidate', () => {
  expect(ALTERNATIVES_MAX).toBe(4);
  const others = [2, 3, 4, 5, 6].map(n => match(String(n), `TST-${n}`, .9 - n / 100));
  const low = alternativeCandidates({ ...current, score: .1 }, others);
  expect(low).toHaveLength(4); expect(low.some(x => x.current)).toBe(true);
  expect(low.map(x => x.score)).toEqual([...low.map(x => x.score)].sort((a, b) => b - a));
  const top = alternativeCandidates(current, others);
  expect(top.map(x => x.cardId)).toEqual(['2', '3', '4', '1']);
});
it('returns independent copies of the cards', () => {
  const list = alternativeCandidates(current, []); list[0]!.card.nameJa = 'changed';
  expect(current.card.nameJa).not.toBe('changed');
});
