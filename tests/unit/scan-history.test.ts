import { expect, test } from 'vitest';
import { ScanHistory } from '../../src/ui/scan-history-model.js';
import { pokeCard as card } from './fixtures.js';
// SYNTHETIC PokeCard snapshots.
test('accepted scan generation records once; independent deliberate rescan records again', () => {
  const h = new ScanHistory();
  h.accept(1, card); h.accept(1, { ...card, tcgplayerId: 'frame' });
  expect(h.entries.map(x => x.card.tcgplayerId)).toEqual(['565756']);
  h.accept(2, card); expect(h.entries.map(x => x.generation)).toEqual([2, 1]);
});
test('snapshots are isolated from caller mutation', () => {
  const h = new ScanHistory(); const mutable = { ...card }; h.accept(1, mutable); mutable.nameJa = 'mutated';
  const entries = h.entries; entries[0]!.card.nameJa = 'mutated too';
  expect(h.entries[0]!.card.nameJa).toBe('ヤナップ');
});
test('bounded collection rejects late generations even after eviction', () => {
  const h = new ScanHistory(2); for (let i = 1; i <= 4; i++) h.accept(i, card);
  h.accept(1, card);
  expect(h.entries.map(x => x.generation)).toEqual([4, 3]);
  expect(() => new ScanHistory(0)).toThrow();
});
test('continuous acceptance reserves each event before delayed metadata; superseded events remain truthful', () => {
  const h = new ScanHistory(); h.reserve(1, 'a'); h.reserve(2, 'b'); h.fail(1, '情報取得を中断しました');
  h.accept(2, { ...card, tcgplayerId: 'b' });
  expect(h.allEntries.map(x => x.generation)).toEqual([2, 1]);
  expect(h.allEntries[1]).toMatchObject({ card: null, cardId: 'a', status: '情報取得を中断しました' });
});
