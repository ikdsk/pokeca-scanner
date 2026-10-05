import { closeRoute } from './immersive-routes.js';
import { test, expect, type Page } from '@playwright/test';
import { installPokemonFlow } from './pokemon-synthetic.js';
// SYNTHETIC camera, worker, TCGdex JSON (pokemon-synthetic.ts). Issue #14: old Safari lacks AbortSignal.any/timeout.
// Chromium/WebKit desktop with the statics deleted emulates the API gap; it is not iPhone Safari.
const startCamera = (page: Page) => page.getByRole('button', { name: 'スキャン開始', exact: true }).click();
const panel = (page: Page) => page.locator('.tentative');

test('still resolves a card when AbortSignal.any and AbortSignal.timeout are missing (SYNTHETIC)', async ({ page }) => {
  await page.addInitScript(() => { delete (AbortSignal as any).any; delete (AbortSignal as any).timeout; });
  await installPokemonFlow(page); await page.goto('/');
  expect(await page.evaluate(() => [typeof (AbortSignal as any).any, typeof (AbortSignal as any).timeout])).toEqual(['undefined', 'undefined']);
  await startCamera(page);
  await expect(panel(page).locator('strong').first()).toHaveText('テストA');
  await expect(panel(page).locator('.price')).toHaveText(/^参考価格 [¥￥]150$/);
  await closeRoute(page); await page.getByRole('button', { name: '停止', exact: true }).click();
});

test('a persistent network failure is logged as card-info-error and explained, after one retry (SYNTHETIC)', async ({ page }) => {
  await installPokemonFlow(page); let calls = 0;
  await page.route('https://api.tcgdex.net/v2/ja/cards/TST-001', async route => { calls++; await route.abort('failed'); });
  await page.goto('/'); await startCamera(page);
  await expect(page.locator('.resolve-status, body')).toContainText('通信に失敗しました');
  expect(calls).toBeGreaterThanOrEqual(2);
  // The log lives in the footer, hidden while scanning: read it through the DOM.
  const log = await page.evaluate(() => { const box = [...document.querySelectorAll('details')].find(d => d.querySelector('summary')?.textContent === '端末内の計測ログ')!; [...box.querySelectorAll('button')].find(b => b.textContent?.trim() === '計測を表示')!.click(); return box.querySelector('pre')!.textContent; });
  expect(log).toContain('card-info-error'); expect(log).toContain('"tcgdexId": "TST-001"'); expect(log).toContain('"name": "TypeError"');
  await page.getByRole('button', { name: '停止', exact: true }).click();
});
