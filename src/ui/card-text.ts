import { el } from './dom.js';
import type { CardText } from '../data/pokemon.js';
export type CardTextView = {
  empty: boolean;
  header?: string;
  evolveFrom?: string;
  abilities: { label: string; name: string; effect: string }[];
  attacks: { name: string; cost: string; damage?: string; effect?: string }[];
  stats: string[];
  effect?: string;
  description?: string;
  illustrator?: string;
};
const TYPES: Record<string, string> = {
  Grass: '草', Fire: '炎', Water: '水', Lightning: '雷', Psychic: '超', Fighting: '闘', Darkness: '悪', Metal: '鋼', Dragon: 'ドラゴン', Fairy: 'フェアリー', Colorless: '無色',
};
const STAGES: Record<string, string> = { Basic: 'たね', Stage1: '1進化', Stage2: '2進化' };
const TRAINERS: Record<string, string> = { Item: 'グッズ', Supporter: 'サポート', Stadium: 'スタジアム', Tool: 'ポケモンのどうぐ' };
const ENERGIES: Record<string, string> = { Normal: '基本エネルギー', Special: '特殊エネルギー' };
const typeLabel = (type: string): string => TYPES[type] ?? type;
// Pure view model: Japanese labels only, text is passed through untouched (newlines preserved).
export function cardTextView(text: CardText | undefined): CardTextView {
  const view: CardTextView = { empty: true, abilities: [], attacks: [], stats: [] };
  if (!text) return view;
  const header = [
    text.trainerType ? (TRAINERS[text.trainerType] ?? text.trainerType) : text.energyType ? (ENERGIES[text.energyType] ?? text.energyType) : undefined,
    text.stage ? (STAGES[text.stage] ?? text.stage) : undefined,
    text.hp !== undefined ? `HP${text.hp}` : undefined,
    text.types?.length ? text.types.map(typeLabel).join('/') : undefined,
  ].filter((part): part is string => part !== undefined);
  if (header.length) view.header = header.join(' · ');
  if (text.evolveFrom) view.evolveFrom = `進化元：${text.evolveFrom}`;
  view.abilities = (text.abilities ?? []).map(a => ({ label: a.type === 'Ability' ? '特性' : a.type, name: a.name, effect: a.effect }));
  view.attacks = (text.attacks ?? []).map(a => ({ name: a.name, cost: a.cost.map(typeLabel).join(' '), ...(a.damage ? { damage: a.damage } : {}), ...(a.effect ? { effect: a.effect } : {}) }));
  for (const w of text.weaknesses ?? []) view.stats.push(`弱点 ${typeLabel(w.type)}${w.value}`);
  for (const r of text.resistances ?? []) view.stats.push(`抵抗力 ${typeLabel(r.type)}${r.value}`);
  if (text.retreat !== undefined) view.stats.push(`にげる ${text.retreat}`);
  if (text.effect) view.effect = text.effect;
  if (text.description) view.description = text.description;
  if (text.illustrator) view.illustrator = `イラスト：${text.illustrator}`;
  view.empty = !(view.header || view.evolveFrom || view.abilities.length || view.attacks.length || view.stats.length || view.effect || view.description || view.illustrator);
  return view;
}
// Detail sheet section. Effects use white-space:pre-line (style.css), so newlines in the source text survive.
export function renderCardText(text: CardText | undefined): HTMLElement {
  const view = cardTextView(text);
  const section = el('section', '', 'card-text'); section.setAttribute('aria-label', 'カードテキスト');
  section.append(el('h3', 'カードテキスト'));
  if (view.empty) { section.append(el('p', 'カードテキストは未収録です', 'small muted card-text-empty')); return section; }
  if (view.header) section.append(el('p', view.header, 'card-text-header'));
  if (view.evolveFrom) section.append(el('p', view.evolveFrom, 'small card-text-evolve'));
  for (const ability of view.abilities) {
    const block = el('div', '', 'card-text-ability'); const title = el('p', '', 'card-text-title');
    title.append(el('span', ability.label, 'card-text-badge'), el('strong', ability.name));
    block.append(title, el('p', ability.effect, 'card-text-effect')); section.append(block);
  }
  for (const attack of view.attacks) {
    const block = el('div', '', 'card-text-attack'); const title = el('p', '', 'card-text-title');
    if (attack.cost) title.append(el('span', attack.cost, 'card-text-cost'));
    title.append(el('strong', attack.name)); if (attack.damage) title.append(el('span', attack.damage, 'card-text-damage'));
    block.append(title); if (attack.effect) block.append(el('p', attack.effect, 'card-text-effect')); section.append(block);
  }
  if (view.effect) section.append(el('p', view.effect, 'card-text-effect'));
  if (view.stats.length) { const stats = el('p', '', 'small card-text-stats'); stats.append(...view.stats.map(stat => el('span', stat))); section.append(stats); }
  if (view.description) section.append(el('p', view.description, 'small muted card-text-description'));
  if (view.illustrator) section.append(el('p', view.illustrator, 'small muted card-text-illustrator'));
  return section;
}
