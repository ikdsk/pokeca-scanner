export const SNAPSHOT_URL = `${import.meta.env.BASE_URL}prices/pokemon-japan-usd.json`;
export class SnapshotMissingError extends Error {
  constructor() { super('価格スナップショットがありません'); this.name = 'SnapshotMissingError'; }
}
// A static host that falls back to index.html answers 200 for a missing file, so non-JSON also means "missing".
export function createSnapshotLoader(fetcher: typeof fetch = (...args) => fetch(...args), url = SNAPSHOT_URL) {
  return async (signal?: AbortSignal): Promise<unknown> => {
    const response = await fetcher(url, signal ? { signal } : {});
    if (response.status === 404) throw new SnapshotMissingError();
    if (!response.ok) throw new Error(`価格データを取得できません（HTTP ${response.status}）`);
    try { return await response.json(); } catch { throw new SnapshotMissingError(); }
  };
}
