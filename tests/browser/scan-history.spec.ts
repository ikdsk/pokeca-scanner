import { openRoute, closeRoute } from './immersive-routes.js';
import { test, expect, type Page } from '@playwright/test';
import { installPokemonFlow, setProbe, tinyPng } from './pokemon-synthetic.js';
// SYNTHETIC worker, input pixels, TCGdex metadata, prices and FX. No recognition accuracy evidence.
const A = '900001'; const B = '900002'; const C = '900003';
async function scan(page: Page, id: string, confirm = true) {
  await setProbe(page, { id, score: .95 });
  await page.locator('#local-image').setInputFiles({ name: 'SYNTHETIC.png', mimeType: 'image/png', buffer: Buffer.from(await tinyPng(page), 'base64') });
  const name = { [A]: 'テストA', [B]: 'テストB', [C]: 'テストC' }[id]!;
  if (confirm) { await expect(page.locator('.tentative')).toContainText(name); await closeRoute(page); await page.getByRole('button', { name: 'これです', exact: true }).click(); }
}
test.beforeEach(async ({ page }) => {
  await installPokemonFlow(page);
  await page.addInitScript(() => { Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: async () => { throw new DOMException('SYNTHETIC denied', 'NotAllowedError'); } } }); });
});
test('session history preserves scans, newest first, and reopens without a new event', async ({ page }, info) => {
  await page.goto('/'); await expect(page.locator('.scan-history')).toBeHidden();
  await scan(page, A); await expect(page.locator('.scan-history-row')).toHaveCount(1);
  await expect(page.locator('.scan-history-row')).toContainText('テストA'); await expect(page.locator('.scan-history-row')).toContainText('テスト拡張 TST 001/066');
  await openRoute(page, '確定カード'); await expect(page.locator('.result h2')).toHaveText('テストA');
  await page.getByRole('button', { name: '価格・為替を再確認', exact: true }).click(); await expect(page.locator('.scan-history-row')).toHaveCount(1);
  await page.getByRole('button', { name: '次のカードをスキャン', exact: true }).click();
  await expect(page.locator('.result')).toBeHidden(); await expect(page.locator('.scan-history-row')).toHaveCount(1);
  await scan(page, B); await expect(page.locator('.scan-history-row')).toHaveCount(2);
  await scan(page, A); await expect(page.locator('.scan-history-row')).toHaveCount(3);
  await expect(page.locator('.scan-history-row').nth(0)).toContainText('テストA');
  await expect(page.locator('.scan-history-row').nth(1)).toContainText('テストB');
  await expect(page.locator('.scan-history-row').nth(2)).toContainText('テストA');
  const old = page.locator('.scan-history-row').nth(1); await openRoute(page, '履歴'); await old.click();
  await expect(page.locator('.result h2')).toHaveText('テストB'); await expect(page.locator('.result h2')).toBeInViewport();
  await expect(page.locator('.result .price')).toHaveText('概算 ￥300');
  await expect(page.locator('.scan-history-row')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'カメラでスキャン', exact: true })).toBeEnabled();
  await openRoute(page, '履歴');
  await expect(page.getByRole('heading', { name: 'スキャン履歴', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator('.scan-history-list').evaluate(node => getComputedStyle(node.closest('.drawer-body')!).overflowY)).toBe('auto');
  if (info.project.name === 'mobile-viewport') await page.screenshot({ path: info.outputPath('mobile-history.png'), fullPage: false });
  await page.reload(); await expect(page.locator('.scan-history')).toBeHidden();
});
test('a delayed old scan cannot insert history after a new scan or history reopen', async ({ page }) => {
  let release!: () => void; const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('https://api.tcgdex.net/v2/ja/cards/TST-002', async route => { await pending; await route.fallback().catch(() => {}); });
  await page.goto('/'); await scan(page, A); await expect(page.locator('.scan-history-row')).toHaveCount(1);
  const requested = page.waitForRequest('https://api.tcgdex.net/v2/ja/cards/TST-002');
  await scan(page, B, false); await requested;
  await openRoute(page, '履歴'); await page.locator('.scan-history-row').click(); release();
  await expect(page.locator('.result h2')).toHaveText('テストA');
  await page.waitForTimeout(200); // Controlled stale response delivery, not live timing evidence.
  await expect(page.locator('.scan-history-row')).toHaveCount(1); await expect(page.locator('.result h2')).toHaveText('テストA');
});
test('public thumbnail loads lazily and keyboard reopen records nothing', async ({ page }) => {
  await page.route('https://assets.tcgdex.net/**', route => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64') }));
  await page.goto('/'); await scan(page, A);
  const row = page.locator('.scan-history-row'); await expect(row).toHaveCount(1);
  const thumbnail = row.locator('img'); await expect(thumbnail).toHaveAttribute('loading', 'lazy');
  await expect(thumbnail).toHaveAttribute('src', 'https://assets.tcgdex.net/ja/TST/TST/001/low.webp');
  await openRoute(page, '履歴'); await row.scrollIntoViewIfNeeded();
  await expect.poll(() => thumbnail.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBe(1);
  await row.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('.result h2')).toHaveText('テストA'); await expect(page.locator('.result h2')).toBeInViewport(); await expect(row).toHaveCount(1);
});
test('history remains reachable while camera runs; reopening stops it and never restarts it', async ({ page }) => {
  await page.goto('/'); await scan(page, A); await expect(page.locator('.scan-history-row')).toHaveCount(1);
  await page.evaluate(() => {
    const state = window as unknown as { cameraCalls: number; historyStream: MediaStream };
    state.cameraCalls = 0;
    navigator.mediaDevices.getUserMedia = async () => {
      state.cameraCalls++; const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 480;
      canvas.getContext('2d')!.fillRect(0, 0, 640, 480); state.historyStream = canvas.captureStream(5); return state.historyStream;
    };
  });
  await setProbe(page, { id: '', present: false });
  await closeRoute(page); await page.getByRole('button', { name: 'カメラでスキャン', exact: true }).click();
  await expect(page.getByRole('button', { name: '停止', exact: true })).toBeEnabled();
  await expect(page.locator('video')).toHaveJSProperty('videoWidth', 640);
  await expect(page.locator('.result')).toBeHidden(); await expect(page.locator('.scan-history-row')).toHaveCount(1);
  await openRoute(page, '履歴'); await page.locator('.scan-history-row').click();
  await expect(page.locator('.result h2')).toHaveText('テストA');
  await expect(page.getByRole('button', { name: '停止', exact: true })).toBeDisabled();
  expect(await page.evaluate(() => (window as unknown as { cameraCalls: number }).cameraCalls)).toBe(1);
  expect(await page.evaluate(() => (window as unknown as { historyStream: MediaStream }).historyStream.getTracks().every(track => track.readyState === 'ended'))).toBe(true);
  await expect(page.locator('.scan-history-row')).toHaveCount(1);
  await setProbe(page, { id: B, present: true });
  await closeRoute(page); await page.getByRole('button', { name: 'カメラでスキャン', exact: true }).click();
  await expect(page.locator('.tentative')).toContainText('テストB'); await closeRoute(page); await page.getByRole('button', { name: 'これです', exact: true }).click();
  await expect(page.locator('.scan-history-row')).toHaveCount(2); await expect(page.locator('.scan-history-row').first()).toContainText('テストB');
  // Live acceptance preserves the camera and does not reveal/scroll the result.
  await expect(page.getByRole('button', { name: '停止', exact: true })).toBeEnabled();
});
test('101 deliberate scans retain only the newest 100 rows', async ({ page }) => {
  test.setTimeout(90000);
  await page.goto('/'); await scan(page, C); await expect(page.locator('.scan-history-row')).toHaveCount(1);
  for (let index = 1; index <= 100; index++) {
    await scan(page, A);
    await expect(page.locator('.scan-history-row')).toHaveCount(Math.min(index + 1, 100));
    await openRoute(page, '確定カード'); await expect(page.locator('.result')).toBeVisible();
  }
  await expect(page.locator('.scan-history-row')).toHaveCount(100);
  await expect(page.locator('.scan-history-row').filter({ hasText: 'テストC' })).toHaveCount(0);
});
