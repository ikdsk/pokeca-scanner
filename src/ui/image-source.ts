import type { PokeCard } from '../data/pokemon.js';
export type ImageSource = { url: string; thumbUrl: string; source: 'tcgdex' | 'tcgplayer'; creditLabel: string; creditHref: string };
const TCGDEX_HOST = 'assets.tcgdex.net';
const TCGPLAYER_CDN = 'https://tcgplayer-cdn.tcgplayer.com/product';
function tcgdexSource(imageUrl: string | null): ImageSource | null {
  if (!imageUrl) return null;
  try {
    const url = new URL(imageUrl);
    if (url.protocol !== 'https:' || url.hostname !== TCGDEX_HOST || url.port !== '' || url.username !== '' || url.password !== '') return null;
    const clean = `https://${TCGDEX_HOST}${url.pathname}`;
    const thumbUrl = clean.endsWith('/high.webp') ? clean.replace(/high\.webp$/, 'low.webp') : clean;
    return { url: clean, thumbUrl, source: 'tcgdex', creditLabel: 'TCGdex', creditHref: 'https://www.tcgdex.net' };
  } catch { return null; }
}
function tcgplayerSource(id: string): ImageSource | null {
  if (!/^[0-9]+$/.test(id)) return null;
  return { url: `${TCGPLAYER_CDN}/${id}_in_600x600.jpg`, thumbUrl: `${TCGPLAYER_CDN}/${id}_200w.jpg`, source: 'tcgplayer', creditLabel: 'TCGplayer', creditHref: `https://www.tcgplayer.com/product/${id}` };
}
// Ordered fallback chain: TCGdex ja artwork first, then the recognized TCGplayer product image.
export function referenceImageSources(card: PokeCard): ImageSource[] {
  return [tcgdexSource(card.imageUrl), tcgplayerSource(card.tcgplayerId)].filter((s): s is ImageSource => s !== null);
}
