import { JsonClient, ProviderError } from './http.js';
export type CatalogMeta = { set?: unknown; collector_number?: unknown };
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
};
const CODE = /^[A-Za-z0-9][A-Za-z0-9-]*$/;
const IMAGE_HOST = 'assets.tcgdex.net';
const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
const text = (value: unknown): string | null => typeof value === 'string' && value !== '' ? value : null;
const count = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
export function candidateTcgdexId(meta: CatalogMeta): string | null {
  if (typeof meta.set !== 'string' || typeof meta.collector_number !== 'string') return null;
  const setId = meta.set.split(':')[0]!.trim();
  const localId = meta.collector_number.split('/')[0]!.trim();
  return CODE.test(setId) && CODE.test(localId) ? `${setId}-${localId}` : null;
}
function imageUrl(image: unknown): string | null {
  if (typeof image !== 'string') return null;
  try {
    const url = new URL(image);
    if (url.protocol !== 'https:' || url.hostname !== IMAGE_HOST || url.port !== '' || url.username !== '' || url.password !== '') return null;
    return `https://${IMAGE_HOST}${url.pathname.replace(/\/+$/, '')}/high.webp`;
  } catch { return null; }
}
export function parseTcgdexCard(json: unknown, tcgplayerId: string): PokeCard | null {
  const c = record(json);
  if (!c || !Array.isArray(c.variants_detailed)) return null;
  const variant = c.variants_detailed.map(record).find(v => {
    const id = record(v?.thirdParty)?.tcgplayer;
    return (typeof id === 'number' || typeof id === 'string') && String(id) === tcgplayerId;
  });
  const set = record(c.set);
  const tcgdexId = text(c.id), nameJa = text(c.name), localId = text(c.localId), setId = text(set?.id), setNameJa = text(set?.name);
  if (!variant || !tcgdexId || !nameJa || !localId || !setId || !setNameJa) return null;
  return {
    tcgplayerId, tcgdexId, nameJa, setId, setNameJa, localId,
    officialCount: count(record(set!.cardCount)?.official),
    rarity: text(c.rarity), regulationMark: text(c.regulationMark), category: text(c.category), hp: count(c.hp),
    imageUrl: imageUrl(c.image), variant: text(variant.type),
  };
}
const TCGDEX = 'https://api.tcgdex.net/v2/ja/cards';
const defaultClient = new JsonClient();
export async function resolveCard(tcgplayerId: string, catalogMeta: CatalogMeta, signal?: AbortSignal, http: JsonClient = defaultClient): Promise<PokeCard | null> {
  const id = candidateTcgdexId(catalogMeta);
  if (!id) return null;
  try {
    return parseTcgdexCard(await http.get(`${TCGDEX}/${encodeURIComponent(id)}`, signal), tcgplayerId);
  } catch (error) {
    if (error instanceof ProviderError) return null;
    throw error;
  }
}
export function hare2SearchUrl(card: Pick<PokeCard, 'nameJa' | 'localId' | 'officialCount' | 'setId'>): string {
  const number = card.officialCount === null ? card.localId : `${card.localId}/${card.officialCount}`;
  return `https://www.hareruya2.com/search?type=product&q=${encodeURIComponent(`${card.nameJa} ${number} ${card.setId}`)}`;
}
