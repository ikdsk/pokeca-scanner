import { expect, it } from 'vitest';
import { printedRarity, withPrintedRarity } from '../../src/domain/rarity.js';
// SYNTHETIC inputs; the table is the user-approved mapping from issue #12.
it('maps TCGplayer rarity names to printed symbols', () => {
  const table: Record<string, string> = {
    Common: 'C', Uncommon: 'U', Rare: 'R', 'Double Rare': 'RR', 'Triple Rare': 'RRR', 'Art Rare': 'AR', 'Special Art Rare': 'SAR',
    'Super Rare': 'SR', 'Ultra Rare': 'UR', 'Hyper Rare': 'HR', 'Shiny Rare': 'S', 'Shiny Secret Rare': 'SSR', 'Character Rare': 'CHR',
    'Character Super Rare': 'CSR', 'Mega Ultra Rare': 'MUR', 'Mega Attack Rare': 'MA', 'ACE Rare': 'ACE', 'Black White Rare': 'BWR',
    'Trainer Rare': 'TR', 'Prism Rare': 'PR', Kagayaku: 'K', 'Amazing Rare': 'A', Promo: 'PROMO',
  };
  for (const [name, symbol] of Object.entries(table)) expect(printedRarity(name)).toBe(symbol);
});
it('trims whitespace but is otherwise exact and case-sensitive', () => {
  expect(printedRarity('  Super Rare ')).toBe('SR');
  expect(printedRarity('super rare')).toBeNull();
});
it('never guesses: unknown, None, empty and missing values show nothing', () => {
  for (const value of ['None', '', '  ', 'Holo Rare', 'Rare Holo LV.X', 'Rare Holo', null, undefined]) expect(printedRarity(value)).toBeNull();
  expect(printedRarity('toString')).toBeNull(); expect(printedRarity('constructor')).toBeNull();
});
it('withPrintedRarity replaces the TCGdex rarity with the printed symbol (SYNTHETIC)', () => {
  const card = { rarity: 'Ultra Rare', nameJa: 'x' };
  expect(withPrintedRarity(card, 'Super Rare')).toEqual({ rarity: 'SR', nameJa: 'x' });
  expect(withPrintedRarity(card, null).rarity).toBeNull(); expect(withPrintedRarity(card, 'None').rarity).toBeNull();
  expect(card.rarity).toBe('Ultra Rare');
});
