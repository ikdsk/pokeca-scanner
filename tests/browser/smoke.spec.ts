import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
// SYNTHETIC runtime module; no network. Pokémon end-to-end behavior lives in pokemon-flow.spec.ts.
test.beforeEach(async ({ context }) => {
  // Optional no-listen mode serves the real built app inside Playwright's route handler (transport only).
  if (process.env.PLAYWRIGHT_NO_SERVER) await context.route(`http://127.0.0.1:${process.env.MVP_PORT ?? 4187}/**`, async route => {
    const path = new URL(route.request().url()).pathname;
    const target = resolve('dist', path === '/' ? 'index.html' : '.' + path);
    if (!target.startsWith(resolve('dist') + '/')) return route.abort();
    try {
      const body = await readFile(target); const contentType = target.endsWith('.js') || target.endsWith('.mjs') ? 'text/javascript' : target.endsWith('.css') ? 'text/css' : target.endsWith('.json') ? 'application/json' : 'text/html';
      await route.fulfill({ body, contentType });
    } catch { await route.fulfill({ status: 404, body: 'Not found' }); }
  });
});
test('worker retains init sent while runtime module import is pending (SYNTHETIC runtime)', async ({ page, context }) => {
  await context.route('**/recognition/vendor/ort.webgpu.min.mjs', route => route.fulfill({ contentType: 'text/javascript', body: 'await new Promise(resolve => setTimeout(resolve, 200)); export const env = { wasm: {} };' }));
  await page.goto('/');
  const messages = await page.evaluate(() => new Promise<string[]>(resolve => {
    const worker = new Worker('/recognition/scanner.worker.mjs?local', { type: 'module' });
    const seen: string[] = [];
    const timer = setTimeout(() => { worker.terminate(); resolve(seen); }, 3000);
    worker.onmessage = ({ data }) => {
      seen.push(data.type);
      if (data.type === 'error') { clearTimeout(timer); worker.terminate(); resolve(seen); }
    };
    worker.postMessage({ type: 'init', manifest: { models: { detector: 'unused' }, detector: { input_size: -1 } } });
  }));
  expect(messages).toContain('progress');
  expect(messages).toContain('error'); // Invalid fixture manifest must reach validation.
});

test('no analytics beacon is injected on local hosts', async ({ page }) => {
  const beaconRequests: string[] = [];
  page.on('request', r => { if (r.url().includes('cloudflareinsights.com')) beaconRequests.push(r.url()); });
  await page.goto('/'); await page.waitForLoadState('networkidle');
  await expect(page.locator('script[data-cf-beacon]')).toHaveCount(0);
  expect(beaconRequests).toEqual([]);
});
