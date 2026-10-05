import { expect, it } from 'vitest';
import { referenceImageSources } from '../../src/ui/image-source.js';
import { pokeCard } from './fixtures.js';
// SYNTHETIC fixtures only.
it('orders TCGdex first, then the TCGplayer product image, with credits (SYNTHETIC)', () => {
  expect(referenceImageSources(pokeCard)).toEqual([
    { url: 'https://assets.tcgdex.net/ja/SV/SV4K/001/high.webp', thumbUrl: 'https://assets.tcgdex.net/ja/SV/SV4K/001/low.webp', source: 'tcgdex', creditLabel: 'TCGdex', creditHref: 'https://www.tcgdex.net' },
    { url: 'https://tcgplayer-cdn.tcgplayer.com/product/565756_in_600x600.jpg', thumbUrl: 'https://tcgplayer-cdn.tcgplayer.com/product/565756_200w.jpg', source: 'tcgplayer', creditLabel: 'TCGplayer', creditHref: 'https://www.tcgplayer.com/product/565756' },
  ]);
});
it('uses only TCGplayer when TCGdex has no image (SYNTHETIC)', () => {
  expect(referenceImageSources({ ...pokeCard, imageUrl: null }).map(s => s.source)).toEqual(['tcgplayer']);
});
it('rejects foreign hosts, non-https and non-numeric ids (SYNTHETIC)', () => {
  const bad = { ...pokeCard, imageUrl: 'https://evil.example/a/high.webp', tcgplayerId: '12/../x' };
  expect(referenceImageSources(bad)).toEqual([]);
  expect(referenceImageSources({ ...pokeCard, imageUrl: 'http://assets.tcgdex.net/a/high.webp', tcgplayerId: '' })).toEqual([]);
  expect(referenceImageSources({ ...pokeCard, imageUrl: 'https://assets.tcgdex.net.evil.example/a/high.webp', tcgplayerId: '１２' })).toEqual([]);
  expect(referenceImageSources({ ...pokeCard, imageUrl: 'https://user@assets.tcgdex.net/a/high.webp' }).map(s => s.source)).toEqual(['tcgplayer']);
});
