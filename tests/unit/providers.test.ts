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