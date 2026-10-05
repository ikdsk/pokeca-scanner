import { referenceImageSources } from './image-source.js';
import { hare2SearchUrl, type PokeCard } from '../data/pokemon.js';
export type CandidateView = {
  name: string;
  expansion: string;
  rarity: { label: string; aria: string } | null;
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
    // card.rarity holds the printed symbol (see withPrintedRarity), never the TCGdex name.
    rarity: card.rarity ? { label: card.rarity, aria: `レアリティ ${card.rarity}` } : null,
    regulation: card.regulationMark ? { label: card.regulationMark, aria: `レギュレーションマーク ${card.regulationMark}` } : null,
    imageUrl: card.imageUrl,
    matchNote: card.matchMethod === 'set_number' ? '番号で照合' : null,
    hare2: { href: hare2SearchUrl(card), label: '晴れる屋2で探す ↗' },
  };
}
// History rows use the small rendition of each validated source, in fallback order.
export const thumbnailUrls = (card: PokeCard): string[] => referenceImageSources(card).map(source => source.thumbUrl);
