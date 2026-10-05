import { describe, expect, it } from 'vitest';
import { cardTextView } from '../../src/ui/card-text.js';
import type { CardText } from '../../src/data/pokemon.js';

// SYNTHETIC-from-real: values mirror TCGdex ja JSON for SV4K-015 / M2a-216 / SV4K-001 (checked 2026-10-05).
const pokemon: CardText = {
  category: 'Pokemon', illustrator: 'takuyoa', hp: 260, types: ['Fire'], stage: 'Stage1', evolveFrom: 'ヒノアラシ',
  abilities: [{ type: 'Ability', name: 'グレンアーマー', effect: '「-80」される。' }],
  attacks: [{ cost: ['Colorless', 'Colorless'], name: 'しゃくねつバズーカ', effect: 'エネルギーの数×40ダメージ追加。\n二行目', damage: '40+' }],
  weaknesses: [{ type: 'Water', value: '×2' }], resistances: [{ type: 'Fighting', value: '-30' }], retreat: 2, description: '図鑑文',
};

describe('cardTextView', () => {
  it('builds Japanese labels for a Pokémon', () => {
    expect(cardTextView(pokemon)).toEqual({
      empty: false,
      header: '1進化 · HP260 · 炎',
      evolveFrom: '進化元：ヒノアラシ',
      abilities: [{ label: '特性', name: 'グレンアーマー', effect: '「-80」される。' }],
      attacks: [{ name: 'しゃくねつバズーカ', cost: '無色 無色', damage: '40+', effect: 'エネルギーの数×40ダメージ追加。\n二行目' }],
      stats: ['弱点 水×2', '抵抗力 闘-30', 'にげる 2'],
      description: '図鑑文',
      illustrator: 'イラスト：takuyoa',
    });
  });
  it('labels Trainer and Energy text', () => {
    expect(cardTextView({ category: 'Trainer', trainerType: 'Item', effect: '山札を切る。\n二行目', illustrator: 'Studio Bora Inc.' })).toMatchObject({ empty: false, header: 'グッズ', effect: '山札を切る。\n二行目', illustrator: 'イラスト：Studio Bora Inc.' });
    for (const [type, label] of [['Supporter', 'サポート'], ['Stadium', 'スタジアム'], ['Tool', 'ポケモンのどうぐ'], ['Future', 'Future']]) expect(cardTextView({ trainerType: type!, effect: 'e' }).header).toBe(label);
    expect(cardTextView({ category: 'Energy', energyType: 'Special', effect: 'e' }).header).toBe('特殊エネルギー');
  });
  it('maps every energy type and keeps unknown ones', () => {
    const jp = cardTextView({ types: ['Grass', 'Fire', 'Water', 'Lightning', 'Psychic', 'Fighting', 'Darkness', 'Metal', 'Dragon', 'Fairy', 'Colorless', 'Cosmic'] }).header;
    expect(jp).toBe('草/炎/水/雷/超/闘/悪/鋼/ドラゴン/フェアリー/無色/Cosmic');
  });
  it('keeps unknown stages and non-Ability ability types, shows retreat 0, omits absent retreat', () => {
    expect(cardTextView({ stage: 'VSTAR', hp: 280 }).header).toBe('VSTAR · HP280');
    expect(cardTextView({ stage: 'Basic' }).header).toBe('たね');
    expect(cardTextView({ stage: 'Stage2' }).header).toBe('2進化');
    expect(cardTextView({ abilities: [{ type: 'Poke-POWER', name: 'n', effect: 'e' }] }).abilities[0]!.label).toBe('Poke-POWER');
    expect(cardTextView({ retreat: 0 }).stats).toEqual(['にげる 0']);
    expect(cardTextView({ hp: 70 }).stats).toEqual([]);
  });
  it('shows an attack with no damage or effect as name and cost only', () => {
    expect(cardTextView({ attacks: [{ cost: [], name: 'ワザ' }] }).attacks).toEqual([{ name: 'ワザ', cost: '' }]);
  });
  it('is empty without text or with only a category', () => {
    expect(cardTextView(undefined).empty).toBe(true);
    expect(cardTextView({ category: 'Pokemon' }).empty).toBe(true);
  });
});
