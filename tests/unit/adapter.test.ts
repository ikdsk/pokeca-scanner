import { expect, it, vi } from 'vitest';
import { Recognizer } from '../../src/recognition/adapter.js';
it('dispose rejects pending initialization instead of leaving a loading promise forever (SYNTHETIC Worker)', async () => {
  vi.stubGlobal('location', new URL('https://localhost/'));
  vi.stubGlobal('Worker', class { terminate() {} postMessage() {} });
  const r = new Recognizer(() => {}); let outcome = 'pending';
  const init = r.init().then(() => { outcome = 'ready'; }, () => { outcome = 'cancelled'; });
  r.dispose(); await Promise.resolve(); await Promise.resolve();
  expect(outcome).toBe('cancelled');
  await init; vi.unstubAllGlobals();
});
it('allows only one frame even while the model is still loading (SYNTHETIC)', async () => {
  vi.stubGlobal('location', new URL('https://localhost/'));
  let worker!: { onmessage: (message: { data: unknown }) => void; messages: { type: string }[] };
  vi.stubGlobal('Worker', class {
    messages: { type: string }[] = []; onmessage!: (message: { data: unknown }) => void;
    constructor() { worker = this; }
    terminate() {} postMessage(message: { type: string }) { this.messages.push(message); }
  });
  const r = new Recognizer(() => {});
  const bitmap = () => ({ close: vi.fn() } as unknown as ImageBitmap);
  const first = r.frame(bitmap()); const secondBitmap = bitmap();
  const second = r.frame(secondBitmap).then(() => 'accepted', () => 'rejected');
  worker.onmessage({ data: { type: 'ready', catalogVersion: 52 } }); await Promise.resolve(); await Promise.resolve();
  expect(worker.messages.filter(x => x.type === 'frame')).toHaveLength(1);
  expect(await second).toBe('rejected'); expect(secondBitmap.close).toHaveBeenCalledOnce();
  worker.onmessage({ data: { type: 'result', cardId: null } }); await first; r.dispose(); vi.unstubAllGlobals();
});
it('cleans a worker and frame slot when bitmap transfer fails (SYNTHETIC)', async () => {
  vi.stubGlobal('location', new URL('https://localhost/'));
  let worker!: { onmessage: (message: { data: unknown }) => void; terminated: boolean };
  vi.stubGlobal('Worker', class {
    onmessage!: (message: { data: unknown }) => void; terminated = false;
    constructor() { worker = this; }
    terminate() { this.terminated = true; }
    postMessage(message: { type: string }) { if (message.type === 'frame') throw new Error('Transfer failed'); }
  });
  const r = new Recognizer(() => {}); const bitmap = { close: vi.fn() } as unknown as ImageBitmap;
  const frame = r.frame(bitmap); worker.onmessage({ data: { type: 'ready', catalogVersion: 52 } });
  await expect(frame).rejects.toThrow('Transfer failed'); expect(bitmap.close).toHaveBeenCalledOnce(); expect(worker.terminated).toBe(true);
  r.dispose(); vi.unstubAllGlobals();
});
it('manifest matches the bundled tcgplayer/pokemon-japan feed snapshot (rows and supported versions)', async () => {
  const { manifest } = await import('../../src/recognition/manifest.js');
  const { readFile } = await import('node:fs/promises');
  const feed = JSON.parse(await readFile(new URL('../../public/recognition/catalog-feed-v2.json', import.meta.url), 'utf8'));
  const catalog = feed.families.milo1.catalogs['tcgplayer/pokemon-japan'];
  expect(manifest.catalog.rows).toBe(catalog.rows);
  expect(manifest.catalog.versions).toEqual([catalog.base.version, catalog.current_version]);
  expect(manifest.catalog.dims).toBe(feed.families.milo1.embedding.dimensions);
  expect(manifest.model_hashes.milo.split(':')[1]).toBe(feed.families.milo1.embedding.model.split('@sha256:')[1]);
  expect(manifest.version).toContain('pokemon-japan');
});
it('announces the real first-load size of the pokemon-japan payload (about 17 MB) (SYNTHETIC Worker)', () => {
  vi.stubGlobal('location', new URL('https://localhost/'));
  vi.stubGlobal('Worker', class { terminate() {} postMessage() {} });
  const messages: string[] = [];
  const r = new Recognizer(m => messages.push(m)); void r.init().catch(() => {});
  expect(messages[0]).toContain('約17MB'); expect(messages[0]).not.toContain('45MB');
  r.dispose(); vi.unstubAllGlobals();
});
