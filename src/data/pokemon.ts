import { JsonClient, ProviderError } from './http.js';
export type CatalogMeta = { set?: unknown; collector_number?: unknown };
export type CardTextCategory = 'Pokemon' | 'Trainer' | 'Energy';
export type CardText = {
  category?: CardTextCategory; illustrator?: string;
  hp?: number; types?: string[]; stage?: string; evolveFrom?: string;
  abilities?: { type: string; name: string; effect: string }[];
  attacks?: { cost: string[]; name: string; effect?: string; damage?: string }[];
  weaknesses?: { type: string; value: string }[]; resistances?: { type: string; value: string }[];
  retreat?: number; description?: string;
  trainerType?: string; energyType?: string; effect?: string;
};
export type PokeCard = {
  tcgplayerId: string;
  tcgdexId: string;
  nameJa: string;
  setId: string;
  setNameJa: string;
  localId: string;
  officialCount: number | null;
  rarity: string | null;
  regulationMark: string | null;
  category: string | null;
  hp: number | null;
  imageUrl: string | null;
  variant: string | null;
  matchMethod: 'tcgplayer_id' | 'set_number';
  text?: CardText;
};
const CODE = /^[A-Za-z0-9][A-Za-z0-9-]*$/;
const IMAGE_HOST = 'assets.tcgdex.net';
const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
const text = (value: unknown): string | null => typeof value === 'string' && value !== '' ? value : null;
const count = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
// Catalog set names/codes that cannot be read as "CODE: Name", mapped to the TCGdex ja set id.
// Only entries verified against https://api.tcgdex.net/v2/ja (docs/reports/resolve-fallback.md); never guess.
// SM1+..SM5+ exist in TCGdex as empty stubs: their cards live under SM1p..SM5p.
const SET_ALIAS: Readonly<Record<string, string>> = {
  'Start Deck 100 Battle Collection': 'MC',
  'SV-P Promotional Cards': 'SV-P',
  'M-P Promotional Cards': 'M-P',
  'sm1+': 'SM1p', 'SM2+': 'SM2p', 'SM3+': 'SM3p', 'SM4+': 'SM4p', 'SM5+': 'SM5p',
};
export function tcgdexSetId(set: string): string | null {
  const name = set.trim();
  const code = name.split(':')[0]!.trim();
  const id = Object.hasOwn(SET_ALIAS, name) ? SET_ALIAS[name] : Object.hasOwn(SET_ALIAS, code) ? SET_ALIAS[code] : code;
  return id !== undefined && CODE.test(id) ? id : null;
}
export function candidateTcgdexId(meta: CatalogMeta): string | null {
  if (typeof meta.set !== 'string' || typeof meta.collector_number !== 'string') return null;
  const setId = tcgdexSetId(meta.set);
  const localId = meta.collector_number.split('/')[0]!.trim();
  return setId !== null && CODE.test(localId) ? `${setId}-${localId}` : null;
}
function imageUrl(image: unknown): string | null {
  if (typeof image !== 'string') return null;
  try {
    const url = new URL(image);
    if (url.protocol !== 'https:' || url.hostname !== IMAGE_HOST || url.port !== '' || url.username !== '' || url.password !== '') return null;
    return `https://${IMAGE_HOST}${url.pathname.replace(/\/+$/, '')}/high.webp`;
  } catch { return null; }
}
const numeric = (value: string): number | null => /^\d+$/.test(value) ? Number(value) : null;
const hasTcgplayerRef = (variants: unknown[]): boolean =>
  variants.some(v => { const id = record(record(v)?.thirdParty)?.tcgplayer; return typeof id === 'number' || typeof id === 'string'; });
function setNumberMatches(c: Record<string, unknown>, variants: unknown[], meta: CatalogMeta | undefined): boolean {
  if (hasTcgplayerRef(variants) || !meta || typeof meta.set !== 'string' || typeof meta.collector_number !== 'string') return false;
  const set = record(c.set);
  const metaSet = tcgdexSetId(meta.set);
  if (typeof set?.id !== 'string' || metaSet === null || set.id.toLowerCase() !== metaSet.toLowerCase()) return false;
  const [left = ''] = meta.collector_number.split('/');
  const wanted = numeric(left.trim());
  return wanted !== null && typeof c.localId === 'string' && numeric(c.localId) === wanted;
}
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const strings = (value: unknown): string[] => list(value).filter((v): v is string => typeof v === 'string' && v !== '');
// Defensive: a malformed item is dropped, an absent/unknown field stays absent. Nothing is invented.
function cardText(c: Record<string, unknown>): CardText | undefined {
  const out: CardText = {};
  const category = c.category === 'Pokemon' || c.category === 'Trainer' || c.category === 'Energy' ? c.category : null;
  if (category) out.category = category;
  const illustrator = text(c.illustrator); if (illustrator) out.illustrator = illustrator;
  const hp = count(c.hp); if (hp !== null) out.hp = hp;
  const types = strings(c.types); if (types.length) out.types = types;
  for (const key of ['stage', 'evolveFrom', 'description', 'trainerType', 'energyType', 'effect'] as const) { const v = text(c[key]); if (v) out[key] = v; }
  const abilities = list(c.abilities).map(record).flatMap(a => { const type = text(a?.type), name = text(a?.name), effect = text(a?.effect); return type && name && effect ? [{ type, name, effect }] : []; });
  if (abilities.length) out.abilities = abilities;
  const attacks = list(c.attacks).map(record).flatMap(a => {
    const name = text(a?.name); if (!name) return [];
    const effect = text(a?.effect), damage = typeof a?.damage === 'number' && Number.isFinite(a.damage) ? String(a.damage) : text(a?.damage);
    return [{ cost: strings(a?.cost), name, ...(effect ? { effect } : {}), ...(damage ? { damage } : {}) }];
  });
  if (attacks.length) out.attacks = attacks;
  for (const key of ['weaknesses', 'resistances'] as const) {
    const items = list(c[key]).map(record).flatMap(w => { const type = text(w?.type), value = text(w?.value); return type && value ? [{ type, value }] : []; });
    if (items.length) out[key] = items;
  }
  const retreat = count(c.retreat); if (retreat !== null) out.retreat = retreat;
  return Object.keys(out).length ? out : undefined;
}
export function parseTcgdexCard(json: unknown, tcgplayerId: string, meta?: CatalogMeta): PokeCard | null {
  const c = record(json);
  if (!c || !Array.isArray(c.variants_detailed)) return null;
  const variant = c.variants_detailed.map(record).find(v => {
    const id = record(v?.thirdParty)?.tcgplayer;
    return (typeof id === 'number' || typeof id === 'string') && String(id) === tcgplayerId;
  });
  const matchMethod = variant ? 'tcgplayer_id' : setNumberMatches(c, c.variants_detailed, meta) ? 'set_number' : null;
  const set = record(c.set);
  const tcgdexId = text(c.id), nameJa = text(c.name), localId = text(c.localId), setId = text(set?.id), setNameJa = text(set?.name);
  if (!matchMethod || !tcgdexId || !nameJa || !localId || !setId || !setNameJa) return null;
  const text_ = cardText(c);
  return {
    tcgplayerId, tcgdexId, nameJa, setId, setNameJa, localId,
    officialCount: count(record(set!.cardCount)?.official),
    rarity: text(c.rarity), regulationMark: text(c.regulationMark), category: text(c.category), hp: count(c.hp),
    imageUrl: imageUrl(c.image), variant: variant ? text(variant.type) : null, matchMethod,
    ...(text_ ? { text: text_ } : {}),
  };
}
const TCGDEX = 'https://api.tcgdex.net/v2/ja/cards';
const defaultClient = new JsonClient();
export async function resolveCard(tcgplayerId: string, catalogMeta: CatalogMeta, signal?: AbortSignal, http: JsonClient = defaultClient): Promise<PokeCard | null> {
  const id = candidateTcgdexId(catalogMeta);
  if (!id) return null;
  try {
    return parseTcgdexCard(await http.get(`${TCGDEX}/${encodeURIComponent(id)}`, signal), tcgplayerId, catalogMeta);
  } catch (error) {
    if (error instanceof ProviderError) return null;
    throw error;
  }
}
export function hare2SearchUrl(card: Pick<PokeCard, 'nameJa' | 'localId' | 'officialCount' | 'setId'>): string {
  const number = card.officialCount === null ? card.localId : `${card.localId}/${card.officialCount}`;
  return `https://www.hareruya2.com/search?type=product&q=${encodeURIComponent(`${card.nameJa} ${number} ${card.setId}`)}`;
}
