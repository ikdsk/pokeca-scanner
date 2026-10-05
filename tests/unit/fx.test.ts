import { expect, it, vi } from 'vitest';
import { JsonClient } from '../../src/data/http.js';
import { FxProvider, parseFx, FX_URL } from '../../src/data/fx.js';
it('rejects invalid FX and currency direction (SYNTHETIC)', () => {
  expect(parseFx({ base: 'USD', quote: 'JPY', rate: 150, date: '2026-10-02' })).toEqual({ jpyPerUsd: 150, asOf: '2026-10-02' });
  for (const bad of [{ base: 'JPY', quote: 'USD', rate: 150, date: '2026-10-02' }, { base: 'USD', quote: 'JPY', rate: 0, date: '2026-10-02' }, { base: 'USD', quote: 'JPY', rate: 150, date: '2026-02-30' }]) expect(() => parseFx(bad)).toThrow();
});
it('retries malformed FX HTTP200 responses instead of caching errors (SYNTHETIC)', async () => {
  const transport = vi.fn().mockResolvedValueOnce(new Response('{"base":"JPY","quote":"USD","rate":150,"date":"2026-10-02"}')).mockResolvedValueOnce(new Response('{"base":"USD","quote":"JPY","rate":150,"date":"2026-10-02"}'));
  const fx = new FxProvider(new JsonClient(transport as typeof fetch, 0));
  await expect(fx.latest()).rejects.toThrow('為替情報が不正です');
  await expect(fx.latest()).resolves.toEqual({ jpyPerUsd: 150, asOf: '2026-10-02' });
  expect(transport).toHaveBeenCalledTimes(2);
  expect(transport.mock.calls[0]![0]).toBe(FX_URL);
});
