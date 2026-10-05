// Local-only price snapshot: TCGCSV (TCGplayer mirror) category 85 (Pokemon Japan) -> public/prices/pokemon-japan-usd.json.
// Sequential requests with a >=200ms gap. Writes a tmp file then renames, so a failure never leaves a partial snapshot.
// The generated file is not committed.
import { mkdir, writeFile, rename, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const base = 'https://tcgcsv.com';
const category = 85;
const gapMs = 200;
const target = resolve(process.argv[2] ?? 'public/prices/pokemon-japan-usd.json');
let last = 0;
async function get(url, parse) {
  const wait = last + gapMs - Date.now();
  if (wait > 0) await new Promise(done => setTimeout(done, wait));
  last = Date.now();
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000), headers: { 'User-Agent': 'pokeca-scanner-price-snapshot' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return parse(response);
}
const started = Date.now();
const tmp = `${target}.partial`;
try {
  const updatedText = await get(`${base}/last-updated.txt`, r => r.text()).catch(() => null);
  const updated = updatedText && Number.isFinite(Date.parse(updatedText.trim())) ? new Date(updatedText.trim()).toISOString() : null;
  const groups = (await get(`${base}/tcgplayer/${category}/groups`, r => r.json())).results;
  if (!Array.isArray(groups) || groups.length === 0) throw new Error('No groups returned');
  const prices = {};
  let rows = 0;
  for (const [index, group] of groups.entries()) {
    const results = (await get(`${base}/tcgplayer/${category}/${group.groupId}/prices`, r => r.json())).results;
    if (!Array.isArray(results)) throw new Error(`Bad prices for group ${group.groupId}`);
    for (const row of results) {
      const price = typeof row.marketPrice === 'number' && Number.isFinite(row.marketPrice) && row.marketPrice >= 0 ? row.marketPrice : null;
      (prices[String(row.productId)] ??= []).push([String(row.subTypeName), price]);
      rows += 1;
    }
    if ((index + 1) % 50 === 0) console.log(`${index + 1}/${groups.length} groups`);
  }
  const snapshot = { source: 'tcgcsv/tcgplayer', category, fetchedAt: new Date().toISOString(), providerUpdatedAt: updated, prices };
  await mkdir(dirname(target), { recursive: true });
  const body = JSON.stringify(snapshot);
  await writeFile(tmp, body);
  await rename(tmp, target);
  console.log(`${target}: ${Buffer.byteLength(body)} bytes, ${groups.length} groups, ${Object.keys(prices).length} products, ${rows} rows, ${((Date.now() - started) / 1000).toFixed(1)}s`);
} catch (error) {
  await rm(tmp, { force: true });
  console.error(error);
  process.exitCode = 1;
}
