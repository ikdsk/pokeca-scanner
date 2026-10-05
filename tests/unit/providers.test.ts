import { expect, it, vi } from 'vitest';
import { JsonClient, ProviderError } from '../../src/data/http.js';
it('caches successful metadata, rejects abort even on cache hit, and never retries 429 automatically (SYNTHETIC)', async () => {
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ value: 0 })));
  const http = new JsonClient(fetcher as typeof fetch, 0);
  await http.get('https://api.scryfall.com/cards/a'); await http.get('https://api.scryfall.com/cards/a'); expect(fetcher).toHaveBeenCalledTimes(1);
  const abort = new AbortController(); abort.abort(); await expect(http.get('https://api.scryfall.com/cards/a', abort.signal)).rejects.toThrow();
  const limited = vi.fn(async () => new Response('{}', { status: 429 }));
  await expect(new JsonClient(limited as typeof fetch, 0).get('https://api.scryfall.com/cards/a')).rejects.toBeInstanceOf(ProviderError); expect(limited).toHaveBeenCalledTimes(1);
});
it('does not fetch a request cancelled while waiting in the rate-limit queue (SYNTHETIC)', async () => {
  let release!: (r: Response) => void;
  const fetcher = vi.fn(() => new Promise<Response>(resolve => { release = resolve; }));
  const http = new JsonClient(fetcher as typeof fetch, 0);
  const first = http.get('https://api.scryfall.com/cards/a'); await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  const abort = new AbortController(); const second = http.get('https://api.scryfall.com/cards/b', abort.signal); abort.abort();
  release(new Response('{}')); await first; await expect(second).rejects.toThrow(); expect(fetcher).toHaveBeenCalledTimes(1);
});

it('invokes injected transport without a JsonClient receiver (SYNTHETIC browser fetch contract)', async () => {
  const transport = function (this: unknown) {
    if (this !== undefined) throw new TypeError('Illegal invocation');
    return Promise.resolve(new Response('{"ok":true}'));
  };
  await expect(new JsonClient(transport as typeof fetch, 0).get('https://api.scryfall.com/cards/a')).resolves.toEqual({ ok: true });
});
it('paces Scryfall search starts at least 500ms apart (SYNTHETIC fake clock)', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-04T00:00:00Z'));
  try {
    const starts: number[] = [];
    const fetcher = vi.fn(async () => { starts.push(Date.now()); return new Response('{}'); });
    const http = new JsonClient(fetcher as typeof fetch);
    const a = http.get('https://api.scryfall.com/cards/search?q=a');
    const b = http.get('https://api.scryfall.com/cards/search?q=b');
    await vi.runAllTimersAsync(); await Promise.all([a, b]);
    expect(starts[1]! - starts[0]!).toBeGreaterThanOrEqual(500);
  } finally { vi.useRealTimers(); }
});
it('shares 429 cooldown across clients and honors Retry-After (SYNTHETIC fake clock)', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-04T00:00:00Z'));
  try {
    const starts: number[] = [];
    const fetcher = vi.fn(async () => { starts.push(Date.now()); return starts.length === 1 ? new Response('{}', { status: 429, headers: { 'Retry-After': '35' } }) : new Response('{}'); });
    const first = new JsonClient(fetcher as typeof fetch);
    const second = new JsonClient(fetcher as typeof fetch);
    await expect(first.get('https://api.scryfall.com/cards/a')).rejects.toBeInstanceOf(ProviderError);
    const retry = second.get('https://api.scryfall.com/cards/b');
    await vi.runAllTimersAsync(); await retry;
    expect(starts[1]! - starts[0]!).toBeGreaterThanOrEqual(35000);
  } finally { vi.useRealTimers(); }
});
it('shares search pacing and promptly aborts cooldown waits without a fetch (SYNTHETIC fake clock)', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-04T00:00:00Z'));
  try {
    const starts: number[] = [];
    const fetcher = vi.fn(async () => { starts.push(Date.now()); return new Response('{}'); });
    const a = new JsonClient(fetcher as typeof fetch).get('https://api.scryfall.com/cards/search?q=a');
    const b = new JsonClient(fetcher as typeof fetch).get('https://api.scryfall.com/cards/search?q=b');
    await vi.runAllTimersAsync(); await Promise.all([a, b]);
    expect(starts[1]! - starts[0]!).toBeGreaterThanOrEqual(500);
    const limited = vi.fn(async () => new Response('{}', { status: 429 }));
    const http = new JsonClient(limited as typeof fetch);
    await expect(http.get('https://api.scryfall.com/cards/a')).rejects.toThrow();
    const abort = new AbortController();
    const retry = http.get('https://api.scryfall.com/cards/b', abort.signal);
    const outcome = expect(retry).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(100);
    abort.abort(); await outcome;
    expect(limited).toHaveBeenCalledTimes(1);
  } finally { vi.useRealTimers(); }
});
it('aborts a request queued behind another cooldown waiter immediately (SYNTHETIC fake clock)', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-04T00:00:00Z'));
  try {
    const transport = vi.fn().mockResolvedValueOnce(new Response('{}', { status: 429 })).mockImplementation(async () => new Response('{}'));
    const http = new JsonClient(transport as typeof fetch);
    await expect(http.get('https://api.scryfall.com/cards/a')).rejects.toThrow();
    const waiting = http.get('https://api.scryfall.com/cards/b');
    const controller = new AbortController(); let aborted = false;
    const cancelled = http.get('https://api.scryfall.com/cards/c', controller.signal).catch(() => { aborted = true; });
    await vi.advanceTimersByTimeAsync(100); controller.abort();
    await vi.advanceTimersByTimeAsync(1);
    const immediate = aborted;
    await vi.runAllTimersAsync(); await Promise.all([waiting, cancelled]);
    expect(immediate).toBe(true);
    expect(transport).toHaveBeenCalledTimes(2);
  } finally { vi.useRealTimers(); }
});
// Safari < 17.4 has no AbortSignal.any and Safari < 16 has no AbortSignal.timeout (issue #14).
const withoutStatics = async (names: ('any' | 'timeout')[], run: () => Promise<void>) => {
  const saved = names.map(name => [name, (AbortSignal as any)[name]] as const);
  for (const name of names) Object.defineProperty(AbortSignal, name, { value: undefined, configurable: true, writable: true });
  try { await run(); } finally { for (const [name, value] of saved) Object.defineProperty(AbortSignal, name, { value, configurable: true, writable: true }); }
};
const okFetcher = () => vi.fn(async (_url: unknown, init?: RequestInit) => { expect(init?.signal).toBeInstanceOf(AbortSignal); return new Response('{"ok":true}'); });
it('fetches with a caller signal when AbortSignal.any is missing (SYNTHETIC old Safari)', async () => {
  await withoutStatics(['any'], async () => {
    const fetcher = okFetcher();
    await expect(new JsonClient(fetcher as typeof fetch, 0).get('https://api.tcgdex.net/v2/ja/cards/a', new AbortController().signal)).resolves.toEqual({ ok: true });
  });
});
it('fetches when AbortSignal.any and AbortSignal.timeout are both missing, with and without a caller signal (SYNTHETIC)', async () => {
  await withoutStatics(['any', 'timeout'], async () => {
    const fetcher = okFetcher(); const http = new JsonClient(fetcher as typeof fetch, 0);
    await expect(http.get('https://api.tcgdex.net/v2/ja/cards/a')).resolves.toEqual({ ok: true });
    await expect(http.get('https://api.tcgdex.net/v2/ja/cards/b', new AbortController().signal)).resolves.toEqual({ ok: true });
  });
});
it('manual signal composition still honors caller abort and the timeout (SYNTHETIC)', async () => {
  await withoutStatics(['any', 'timeout'], async () => {
    const hang = (_url: unknown, init?: RequestInit) => new Promise<Response>((_, reject) => init!.signal!.addEventListener('abort', () => reject(init!.signal!.reason), { once: true }));
    const abort = new AbortController(); const fetcher = vi.fn(hang);
    const first = new JsonClient(fetcher as typeof fetch, 0, 1000, 5000).get('https://api.tcgdex.net/v2/ja/cards/a', abort.signal);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1)); const reason = new Error('caller'); abort.abort(reason);
    await expect(first).rejects.toBe(reason);
    const slow = new JsonClient(vi.fn(hang) as typeof fetch, 0, 1000, 20);
    await expect(slow.get('https://api.tcgdex.net/v2/ja/cards/b')).rejects.toMatchObject({ name: 'TimeoutError' });
  });
});
it('retries one transient network failure (TypeError) and one timeout, never HTTP 4xx or a second failure (SYNTHETIC)', async () => {
  const url = 'https://api.tcgdex.net/v2/ja/cards/a';
  const flaky = vi.fn().mockRejectedValueOnce(new TypeError('Load failed')).mockResolvedValue(new Response('{"ok":true}'));
  await expect(new JsonClient(flaky as typeof fetch, 0).get(url)).resolves.toEqual({ ok: true }); expect(flaky).toHaveBeenCalledTimes(2);
  const hang = vi.fn((_u: unknown, init?: RequestInit) => new Promise<Response>((resolve, reject) => {
    if (hang.mock.calls.length > 1) resolve(new Response('{"ok":true}')); else init!.signal!.addEventListener('abort', () => reject(init!.signal!.reason), { once: true });
  }));
  await expect(new JsonClient(hang as typeof fetch, 0, 1000, 20).get(url)).resolves.toEqual({ ok: true }); expect(hang).toHaveBeenCalledTimes(2);
  const notFound = vi.fn(async () => new Response('{}', { status: 404 }));
  await expect(new JsonClient(notFound as typeof fetch, 0).get(url)).rejects.toBeInstanceOf(ProviderError); expect(notFound).toHaveBeenCalledTimes(1);
  const down = vi.fn().mockRejectedValue(new TypeError('Load failed'));
  await expect(new JsonClient(down as typeof fetch, 0).get(url)).rejects.toBeInstanceOf(TypeError); expect(down).toHaveBeenCalledTimes(2);
  const abort = new AbortController(); const gone = vi.fn(async () => { abort.abort(); throw new TypeError('Load failed'); });
  await expect(new JsonClient(gone as typeof fetch, 0).get(url, abort.signal)).rejects.toThrow(); expect(gone).toHaveBeenCalledTimes(1);
});
