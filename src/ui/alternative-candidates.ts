import type { PokeCard } from '../data/pokemon.js';
export const ALTERNATIVES_MAX = 4;
// One recognition match; `card` is null until/unless TCGdex resolves it (never shown then).
export type ResolvedMatch = { cardId: string; score: number; card: PokeCard | null };
export type AlternativeCandidate = { cardId: string; score: number; card: PokeCard; current: boolean };
// Resolved top matches only, one entry per TCGdex card (another product of the same card is not an
// alternative), best score first, at most ALTERNATIVES_MAX. The current candidate is always kept.
export function alternativeCandidates(current: ResolvedMatch & { card: PokeCard }, matches: readonly ResolvedMatch[]): AlternativeCandidate[] {
  const seen = new Set<string>([current.card.tcgdexId]);
  const others: AlternativeCandidate[] = [];
  for (const match of [...matches].sort((a, b) => b.score - a.score)) {
    if (!match.card || seen.has(match.card.tcgdexId)) continue;
    seen.add(match.card.tcgdexId);
    others.push({ cardId: match.cardId, score: match.score, card: structuredClone(match.card), current: false });
  }
  const self: AlternativeCandidate = { cardId: current.cardId, score: current.score, card: structuredClone(current.card), current: true };
  return [self, ...others.slice(0, ALTERNATIVES_MAX - 1)].sort((a, b) => b.score - a.score);
}
