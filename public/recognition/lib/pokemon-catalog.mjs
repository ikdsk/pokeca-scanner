// Pure helpers for the tcgplayer/pokemon-japan catalog (CollectorVision catalog v2, milo1).
// Kept free of worker/DOM globals so they can be unit-tested in Node.

export const POKEMON_CATALOG_KEY = "milo1/tcgplayer/pokemon-japan";

// Rows keep the TCGplayer product id as the identity; metadata is passed through
// so the data layer can resolve Japanese card info. Missing fields are null.
export function indexRecords(records) {
  return {
    cardIds: records.map((record) => record.id),
    cardNames: records.map((record) => record.name),
    catalogMeta: records.map((record) => ({
      set: record.metadata?.set ?? null,
      collectorNumber: record.metadata?.collector_number ?? null,
      rarity: record.metadata?.rarity ?? null,
      group: record.identifiers?.tcgplayer_group ?? null,
    })),
  };
}

// Brute-force dot product over packed float16 rows; returns the k best rows,
// best first, earlier row wins ties. O(rows*dims) with an O(k) insertion.
export function searchTop(embeddings, rows, dims, query, lookup, k = 5) {
  const top = [];
  for (let row = 0; row < rows; row += 1) {
    const offset = row * dims;
    let score = 0;
    for (let col = 0; col < dims; col += 1) score += lookup[embeddings[offset + col]] * query[col];
    if (top.length === k && score <= top[k - 1].score) continue;
    let at = top.length;
    while (at > 0 && top[at - 1].score < score) at -= 1;
    top.splice(at, 0, { index: row, score });
    if (top.length > k) top.pop();
  }
  return top;
}

export function assertCompatibleCatalog(catalog, manifest) {
  if (catalog.catalogKey !== POKEMON_CATALOG_KEY) throw new Error(`Unexpected catalog ${catalog.catalogKey}`);
  if (catalog.embedding.model.split("@sha256:")[1] !== manifest.model_hashes.milo.split(":")[1]) {
    throw new Error("Incompatible embedding model/catalog snapshot");
  }
  if (catalog.dimension !== manifest.catalog.dims) {
    throw new Error(`Catalog dimensions (${catalog.dimension}) do not match the scanner embedder (${manifest.catalog.dims})`);
  }
  const [min, max] = manifest.catalog.versions;
  if (!(catalog.version >= min && catalog.version <= max)) throw new Error(`Unsupported catalog version ${catalog.version}`);
}
