// Different TCGplayer products (e.g. Poke Ball Pattern) can resolve to the same TCGdex card.
// The first product id seen for a TCGdex card is the displayed identity; later ones alias it so
// the live candidate does not flicker or get proposed twice.
export class CardIdentity {
  private byDex = new Map<string, string>();
  private alias = new Map<string, string>();
  canonical(cardId: string): string { return this.alias.get(cardId) ?? cardId; }
  learn(cardId: string, tcgdexId: string): string {
    const first = this.byDex.get(tcgdexId) ?? cardId;
    this.byDex.set(tcgdexId, first);
    if (first !== cardId) this.alias.set(cardId, first);
    return first;
  }
  sameCard(a: string, b: string): boolean { return this.canonical(a) === this.canonical(b); }
  clear(): void { this.byDex.clear(); this.alias.clear(); }
}
