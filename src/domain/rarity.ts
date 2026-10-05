// TCGplayer rarity (catalogMeta.rarity of the recognized product) -> printed rarity symbol.
// Exact table lookup; anything unlisted ('None', null, TCGdex-only names) shows nothing.
const PRINTED: ReadonlyMap<string, string> = new Map([
  ['Common', 'C'], ['Uncommon', 'U'], ['Rare', 'R'], ['Double Rare', 'RR'], ['Triple Rare', 'RRR'], ['Art Rare', 'AR'],
  ['Special Art Rare', 'SAR'], ['Super Rare', 'SR'], ['Ultra Rare', 'UR'], ['Hyper Rare', 'HR'], ['Shiny Rare', 'S'],
  ['Shiny Secret Rare', 'SSR'], ['Character Rare', 'CHR'], ['Character Super Rare', 'CSR'], ['Mega Ultra Rare', 'MUR'],
  ['Mega Attack Rare', 'MA'], ['ACE Rare', 'ACE'], ['Black White Rare', 'BWR'], ['Trainer Rare', 'TR'], ['Prism Rare', 'PR'],
  ['Kagayaku', 'K'], ['Amazing Rare', 'A'], ['Promo', 'PROMO'],
]);
export const printedRarity = (tcgplayerRarity: string | null | undefined): string | null =>
  typeof tcgplayerRarity === 'string' ? PRINTED.get(tcgplayerRarity.trim()) ?? null : null;
// In the UI layer a card's `rarity` holds the printed symbol (or null), never the TCGdex name.
export const withPrintedRarity = <T extends { rarity: string | null }>(card: T, tcgplayerRarity: string | null | undefined): T =>
  ({ ...card, rarity: printedRarity(tcgplayerRarity) });
