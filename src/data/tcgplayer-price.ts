export type UsdQuote = { tcgplayerId: string; subType: string; usdMarket: string | null; source: 'tcgplayer'; providerUpdatedAt: string | null };
export type PriceRow = readonly [subType: string, marketPrice: number | null];
export type PriceSnapshot = { fetchedAt: string; providerUpdatedAt: string | null; prices: Map<string, PriceRow[]> };

const invalid = (why: string) => new Error(`Invalid price snapshot: ${why}`);
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isTimestamp = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));

export function parseSnapshot(raw: unknown): PriceSnapshot {
  if (!isRecord(raw)) throw invalid('not an object');
  if (raw.source !== 'tcgcsv/tcgplayer') throw invalid('unexpected source');
  if (raw.category !== 85) throw invalid('unexpected category');
  if (!isTimestamp(raw.fetchedAt)) throw invalid('fetchedAt');
  if (raw.providerUpdatedAt !== null && !isTimestamp(raw.providerUpdatedAt)) throw invalid('providerUpdatedAt');
  if (!isRecord(raw.prices)) throw invalid('prices');
  const prices = new Map<string, PriceRow[]>();
  for (const [id, rows] of Object.entries(raw.prices)) {
    if (!/^\d+$/.test(id)) throw invalid(`product id ${id}`);
    if (!Array.isArray(rows)) throw invalid(`rows for ${id}`);
    const seen = new Set<string>();
    const parsed: PriceRow[] = rows.map(row => {
      if (!Array.isArray(row) || row.length !== 2) throw invalid(`row for ${id}`);
      const [subType, price] = row as [unknown, unknown];
      if (typeof subType !== 'string' || subType === '' || seen.has(subType)) throw invalid(`subtype for ${id}`);
      seen.add(subType);
      if (price !== null && (typeof price !== 'number' || !Number.isFinite(price) || price < 0)) throw invalid(`price for ${id}`);
      return [subType, price];
    });
    prices.set(id, parsed);
  }
  return { fetchedAt: raw.fetchedAt, providerUpdatedAt: raw.providerUpdatedAt, prices };
}

// Whole cents, so the result always matches formatReferencePrice's /^\d+(\.\d{1,2})?$/.
function toUsdString(price: number | null): string | null {
  if (price === null) return null;
  const cents = Math.round(price * 100);
  if (!Number.isSafeInteger(cents)) return null;
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

export type SnapshotLoader = (signal?: AbortSignal) => Promise<unknown>;

export function createTcgplayerPrice(load: SnapshotLoader) {
  let cached: Promise<PriceSnapshot> | null = null;
  const snapshot = (signal?: AbortSignal): Promise<PriceSnapshot> => {
    if (!cached) {
      // The shared load is not tied to one caller's signal; each caller aborts its own wait.
      const job = load().then(parseSnapshot);
      cached = job;
      job.catch(() => { if (cached === job) cached = null; });
    }
    return cached;
  };
  return {
    // groupId is accepted for contract compatibility; the snapshot is keyed by product id alone.
    async quote(tcgplayerId: string, _groupId?: string, signal?: AbortSignal): Promise<UsdQuote[]> {
      signal?.throwIfAborted();
      const data = await snapshot(signal);
      signal?.throwIfAborted();
      return (data.prices.get(tcgplayerId) ?? []).map(([subType, price]) => ({
        tcgplayerId, subType, usdMarket: toUsdString(price), source: 'tcgplayer' as const, providerUpdatedAt: data.providerUpdatedAt,
      }));
    },
  };
}

// TCGdex variant type -> TCGplayer subTypeName. Anything not listed (e.g. 1st Edition vs Unlimited) is unmappable.
const SUBTYPE_BY_VARIANT: ReadonlyMap<string, string> = new Map([['normal', 'Normal'], ['holo', 'Holofoil'], ['reverse', 'Reverse Holofoil']]);

// A product id identifies one printing, so a sole quote is used whatever the variant.
// With several subtypes only the explicit table above may select one; otherwise null (never guess).
export function chooseQuote(quotes: readonly UsdQuote[], variant?: string | null): UsdQuote | null {
  if (quotes.length === 1) return quotes[0]!;
  const subType = variant ? SUBTYPE_BY_VARIANT.get(variant.toLowerCase()) : undefined;
  if (!subType) return null;
  const matches = quotes.filter(quote => quote.subType === subType);
  return matches.length === 1 ? matches[0]! : null;
}
