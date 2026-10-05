import type { PokeCard } from '../data/pokemon.js';
import type { ResolvedMatch } from './alternative-candidates.js';
export type SameCardProduct = { tcgplayerId: string; card: PokeCard; label: string; score: number };
const LABELS: Record<string, string> = { normal: 'ノーマル', reverse: 'リバース', holo: 'ホロ', pokeball: 'モンスターボール柄', masterball: 'マスターボール柄' };
export const variantLabel = (variant: string | null): string => (variant && LABELS[variant.toLowerCase()]) || '別商品';
// Other TCGplayer products of the displayed TCGdex card (e.g. Poke Ball Pattern): resolved matches
// with the same tcgdexId but a different product id, each carrying its own product id for pricing.
export function sameCardProducts(current: PokeCard, matches: readonly ResolvedMatch[]): SameCardProduct[] {
  const seen = new Set<string>([current.tcgplayerId]);
  const list: SameCardProduct[] = [];
  for (const match of [...matches].sort((a, b) => b.score - a.score)) {
    if (!match.card || match.card.tcgdexId !== current.tcgdexId || seen.has(match.cardId)) continue;
    seen.add(match.cardId);
    list.push({ tcgplayerId: match.cardId, card: structuredClone(match.card), label: variantLabel(match.card.variant), score: match.score });
  }
  return list;
}
