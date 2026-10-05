import { expect, it, vi } from 'vitest';
import { createSnapshotLoader, SnapshotMissingError, SNAPSHOT_URL } from '../../src/ui/snapshot-loader.js';
// SYNTHETIC responses; no network.
it('requests the local snapshot path and returns the parsed JSON', async () => {
  const fetcher = vi.fn(async (_url: string) => new Response('{"a":1}', { headers: { 'Content-Type': 'application/json' } }));
  await expect(createSnapshotLoader(fetcher as unknown as typeof fetch)()).resolves.toEqual({ a: 1 });
  expect(fetcher.mock.calls[0]![0]).toBe('/prices/pokemon-japan-usd.json'); expect(SNAPSHOT_URL).toBe('/prices/pokemon-japan-usd.json');
});
it('404 and an HTML fallback page both mean the snapshot is missing', async () => {
  const notFound = vi.fn(async () => new Response('nope', { status: 404 }));
  await expect(createSnapshotLoader(notFound as unknown as typeof fetch)()).rejects.toBeInstanceOf(SnapshotMissingError);
  const spa = vi.fn(async () => new Response('<!doctype html><html></html>', { headers: { 'Content-Type': 'text/html' } }));
  await expect(createSnapshotLoader(spa as unknown as typeof fetch)()).rejects.toBeInstanceOf(SnapshotMissingError);
});
it('other failures are not reported as a missing snapshot', async () => {
  const server = vi.fn(async () => new Response('', { status: 500 }));
  const error = await createSnapshotLoader(server as unknown as typeof fetch)().catch(e => e);
  expect(error).toBeInstanceOf(Error); expect(error).not.toBeInstanceOf(SnapshotMissingError);
  const offline = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
  await expect(createSnapshotLoader(offline as unknown as typeof fetch)()).rejects.toThrow('Failed to fetch');
});
