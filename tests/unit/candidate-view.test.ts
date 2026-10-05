import { expect, it } from 'vitest';
import { candidateView, thumbnailUrl } from '../../src/ui/candidate-view.js';
import { pokeCard } from './fixtures.js';
// SYNTHETIC fixtures only.
it('shows the Japanese name, expansion with number, rarity, regulation badge and image (SYNTHETIC)', () => {
  expect(candidateView(pokeCard)).toMatchObject({
    name: 'ヤナップ', expansion: '古代の咆哮 SV4K 001/066', rarity: 'C', imageUrl: pokeCard.imageUrl,
    regulation: { label: 'G', aria: 'レギュレーションマーク G' }, matchNote: null,
  });
});
it('omits the printed count when unknown and the badge/rarity when absent (SYNTHETIC)', () => {
  const view = candidateView({ ...pokeCard, officialCount: null, regulationMark: null, rarity: null, imageUrl: null });
  expect(view.expansion).toBe('古代の咆哮 SV4K 001');
  expect(view.regulation).toBeNull(); expect(view.rarity).toBeNull(); expect(view.imageUrl).toBeNull();
});
it('labels set_number matches with a muted note (SYNTHETIC)', () => {
  expect(candidateView({ ...pokeCard, matchMethod: 'set_number' }).matchNote).toBe('番号で照合');
});
it('builds the 晴れる屋2 link from the card (link only) (SYNTHETIC)', () => {
  const { hare2 } = candidateView(pokeCard);
  expect(hare2.label).toBe('晴れる屋2で探す ↗');
  const url = new URL(hare2.href);
  expect(url.origin).toBe('https://www.hareruya2.com');
  expect(url.searchParams.get('q')).toBe('ヤナップ 001/66 SV4K');
});
it('derives a small thumbnail only from validated TCGdex image URLs', () => {
  expect(thumbnailUrl('https://assets.tcgdex.net/ja/SV/SV4K/001/high.webp')).toBe('https://assets.tcgdex.net/ja/SV/SV4K/001/low.webp');
  expect(thumbnailUrl('https://evil.example/a/high.webp')).toBeNull();
  expect(thumbnailUrl(null)).toBeNull();
});
