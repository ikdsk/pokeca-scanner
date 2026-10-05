import { hare2SearchUrl, type PokeCard } from '../data/pokemon.js';
export type CandidateView = {
  name: string;
  expansion: string;
  rarity: string | null;
  regulation: { label: string; aria: string } | null;
  imageUrl: string | null;
  matchNote: string | null;
  hare2: { href: string; label: string };
};
const pad = (value: number): string => String(value).padStart(3, '0');
export function candidateView(card: PokeCard): CandidateView {
  const number = card.officialCount === null ? card.localId : `${card.localId}/${pad(card.officialCount)}`;
  return {
    name: card.nameJa,
    expansion: `${card.setNameJa} ${card.setId} ${number}`,
    rarity: card.rarity,
    regulation: card.regulationMark ? { label: card.regulationMark, aria: `レギュレーションマーク ${card.regulationMark}` } : null,
    imageUrl: card.imageUrl,
    matchNote: card.matchMethod === 'set_number' ? '番号で照合' : null,
    hare2: { href: hare2SearchUrl(card), label: '晴れる屋2で探す ↗' },
  };
}
// History rows use the small TCGdex rendition; only the validated image host is accepted.
export function thumbnailUrl(imageUrl: string | null): string | null {
  if (!imageUrl) return null;
  try {
    const url = new URL(imageUrl);
    if (url.protocol !== 'https:' || url.hostname !== 'assets.tcgdex.net' || !url.pathname.endsWith('/high.webp')) return null;
    return `https://assets.tcgdex.net${url.pathname.replace(/high\.webp$/, 'low.webp')}`;
  } catch { return null; }
}
