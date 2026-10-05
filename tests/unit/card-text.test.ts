import { describe, expect, it } from 'vitest';
import { parseTcgdexCard } from '../../src/data/pokemon.js';

// SYNTHETIC-from-real: field shapes copied from TCGdex ja JSON checked 2026-10-05 (SV4K-015, M2a-216, SV4K-001).
// Not live output; they prove parsing only, not provider coverage.
const base = (id: string, name: string, over: Record<string, unknown>) => ({
  id, name, localId: '001', rarity: 'Common', category: 'Pokemon', image: 'https://assets.tcgdex.net/ja/SV/SV4K/001',
  set: { id: 'SV4K', name: '古代の咆哮', cardCount: { official: 66 } },
  variants_detailed: [{ type: 'normal', thirdParty: { tcgplayer: 1 } }], ...over,
});
export const charizardLike = base('SV4K-015', 'グレンアルマex', {
  illustrator: 'takuyoa', hp: 260, types: ['Fire'], stage: 'Stage1',
  abilities: [{ type: 'Ability', name: 'グレンアーマー', effect: 'このポケモンのHPがまんたんの状態なら、「-80」される。' }],
  attacks: [{ cost: ['Colorless', 'Colorless'], name: 'しゃくねつバズーカ', effect: 'エネルギーの数×40ダメージ追加。', damage: '40+' }],
  weaknesses: [{ type: 'Water', value: '×2' }], retreat: 2,
});
export const hyperBall = base('M2a-216', 'ハイパーボール', {
  category: 'Trainer', illustrator: 'Studio Bora Inc.', trainerType: 'Item', effect: 'このカードは、手札を2枚トラッシュしなければ使えない。\n山札を切る。',
});
const parse = (json: unknown) => parseTcgdexCard(json, '1');

describe('card text parsing (SYNTHETIC-from-real)', () => {
  it('parses a Pokémon card text', () => {
    expect(parse(charizardLike)!.text).toEqual({
      category: 'Pokemon', illustrator: 'takuyoa', hp: 260, types: ['Fire'], stage: 'Stage1',
      abilities: [{ type: 'Ability', name: 'グレンアーマー', effect: 'このポケモンのHPがまんたんの状態なら、「-80」される。' }],
      attacks: [{ cost: ['Colorless', 'Colorless'], name: 'しゃくねつバズーカ', effect: 'エネルギーの数×40ダメージ追加。', damage: '40+' }],
      weaknesses: [{ type: 'Water', value: '×2' }], retreat: 2,
    });
  });
  it('parses Trainer text and keeps newlines', () => {
    expect(parse(hyperBall)!.text).toEqual({ category: 'Trainer', illustrator: 'Studio Bora Inc.', trainerType: 'Item', effect: 'このカードは、手札を2枚トラッシュしなければ使えない。\n山札を切る。' });
  });
  it('parses Energy text', () => {
    expect(parse(base('X-1', '基本炎エネルギー', { category: 'Energy', energyType: 'Normal', effect: 'エネルギー効果' }))!.text).toEqual({ category: 'Energy', energyType: 'Normal', effect: 'エネルギー効果' });
  });
  it('keeps evolveFrom, description, resistances, numeric damage and a 0 retreat', () => {
    const t = parse(base('X-2', 'ヤナップ', { hp: 70, evolveFrom: 'タネ', description: '図鑑文', resistances: [{ type: 'Fighting', value: '-30' }], retreat: 0, attacks: [{ cost: ['Grass'], name: 'ワザ', damage: 30 }] }))!.text!;
    expect(t).toMatchObject({ evolveFrom: 'タネ', description: '図鑑文', resistances: [{ type: 'Fighting', value: '-30' }], retreat: 0, attacks: [{ cost: ['Grass'], name: 'ワザ', damage: '30' }] });
    expect(t.attacks![0]).not.toHaveProperty('effect');
  });
  it('drops malformed items and non-string values; never invents text', () => {
    const t = parse(base('X-3', 'テスト', {
      illustrator: 5, hp: '70', types: ['Fire', 3, null], stage: {}, retreat: 'many', effect: ['x'],
      abilities: [null, { type: 'Ability', name: 'a' }, { type: 'Ability', name: 'ok', effect: 'e' }],
      attacks: [{ cost: 'Fire', name: 'bad cost' }, { name: 7 }, 'x'],
      weaknesses: [{ type: 'Water' }, { type: 'Fire', value: '×2' }], resistances: 'none',
    }))!.text!;
    expect(t).toEqual({ category: 'Pokemon', types: ['Fire'], abilities: [{ type: 'Ability', name: 'ok', effect: 'e' }], attacks: [{ cost: [], name: 'bad cost' }], weaknesses: [{ type: 'Fire', value: '×2' }] });
  });
  it('leaves text absent when TCGdex has no text fields', () => {
    expect(parse(base('X-4', '空', { category: undefined }))).not.toHaveProperty('text');
  });
});
