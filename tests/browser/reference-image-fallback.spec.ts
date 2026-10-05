import { openRoute, closeRoute } from './immersive-routes.js';
import { test, expect, type Page } from '@playwright/test';
import { installPokemonFlow, setProbe, tinyPng, cardSvg } from './pokemon-synthetic.js';
import { dialog, openDetail, closeDetail } from './detail-flow.js';
// SYNTHETIC worker, input pixels, metadata and routed images (TCGdex 404 -> TCGplayer 200).
// Proves fallback wiring only, not real recognition or real image coverage.
const TCGPLAYER = 'https://tcgplayer-cdn.tcgplayer.com/**';
const TCGDEX = 'https://assets.tcgdex.net/**';
const svg = (cdn: string[]) => (route: import('@playwright/test').Route) => { cdn.push(route.request().url()); return route.fulfill({ contentType: 'image/svg+xml', body: cardSvg }); };
const fail = (route: import('@playwright/test').Route) => route.fulfill({ status: 404, body: 'nope' });
async function scan(page: Page, id: string, name: string, save = false) {
  await setProbe(page, { id, score: .95 });
  await page.locator('#local-image').setInputFiles({ name: 'SYNTHETIC.png', mimeType: 'image/png', buffer: Buffer.from(await tinyPng(page), 'base64') });
  await expect(page.locator('.tentative')).toContainText(name); await closeRoute(page);
  if (save) await page.locator('.tentative').getByRole('button', { name: '履歴に保存', exact: true }).click();
}
test.beforeEach(async ({ page }) => {
  await installPokemonFlow(page);
  await page.addInitScript(() => { Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: async () => { throw new DOMException('SYNTHETIC denied', 'NotAllowedError'); } } }); });
});
test('TCGdex image is used when it loads (no TCGplayer request)', async ({ page }) => {
  const cdn: string[] = []; await page.route(TCGPLAYER, svg(cdn));
  await page.goto('/'); await scan(page, '900001', 'テストA');
  const dockImage = page.locator('.candidate-dock .reference-image img').first();
  await expect(dockImage).toBeVisible(); await expect(dockImage).toHaveAttribute('src', /assets\.tcgdex\.net/);
  await openDetail(page);
  const image = dialog(page).locator('.reference-image img').first();
  await expect(image).toBeVisible(); await expect(image).toHaveAttribute('src', /assets\.tcgdex\.net/);
  await expect(dialog(page).locator('.reference-image')).toContainText('画像提供：TCGdex');
  await expect(dialog(page).locator('.reference-image')).toBeVisible();
  expect(cdn).toEqual([]);
});
test('falls back to the TCGplayer product image when TCGdex fails, crediting TCGplayer (dock and detail sheet)', async ({ page }) => {
  await page.route(TCGDEX, fail);
  const cdn: string[] = []; await page.route(TCGPLAYER, svg(cdn));
  await page.goto('/'); await scan(page, '900001', 'テストA');
  const dockImage = page.locator('.candidate-dock .reference-image img').first();
  await expect(dockImage).toBeVisible(); await expect(dockImage).toHaveAttribute('src', 'https://tcgplayer-cdn.tcgplayer.com/product/900001_in_600x600.jpg');
  await openDetail(page);
  const reference = dialog(page).locator('.reference-image').first(); const image = reference.locator('img');
  await expect(image).toBeVisible(); await expect(image).toHaveAttribute('src', 'https://tcgplayer-cdn.tcgplayer.com/product/900001_in_600x600.jpg');
  await expect(image).toHaveAttribute('referrerpolicy', 'no-referrer'); await expect(image).toHaveAttribute('width', '488'); await expect(image).toHaveAttribute('height', '680');
  await expect(reference).toContainText('画像提供：TCGplayer'); await expect(reference).not.toContainText('TCGdex');
  const credit = reference.getByRole('link', { name: 'TCGplayer' });
  await expect(credit).toBeVisible(); await expect(credit).toHaveAttribute('href', 'https://www.tcgplayer.com/product/900001');
  expect(cdn.length).toBeGreaterThan(0);
});
test('history-opened sheet shows the fallback image and TCGplayer credit', async ({ page }) => {
  await page.route(TCGDEX, fail); await page.route(TCGPLAYER, svg([]));
  await page.goto('/'); await scan(page, '900001', 'テストA', true);
  await openRoute(page, '履歴'); await page.locator('.scan-history-row').first().click();
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).locator('.reference-image img').first()).toHaveAttribute('src', 'https://tcgplayer-cdn.tcgplayer.com/product/900001_in_600x600.jpg');
  await expect(dialog(page).locator('.reference-image')).toContainText('画像提供：TCGplayer');
  await expect(dialog(page).locator('.reference-image').getByRole('link', { name: 'TCGplayer' })).toBeVisible();
});
test('keeps the unavailable message when every source fails', async ({ page }) => {
  await page.route(TCGDEX, fail); await page.route(TCGPLAYER, fail);
  await page.goto('/'); await scan(page, '900001', 'テストA'); await openDetail(page);
  await expect(dialog(page).locator('.reference-image').first()).toContainText('参照画像を読み込めません。カード情報・価格は引き続き確認できます。');
  await expect(dialog(page).locator('.reference-image img').first()).toBeHidden();
  await closeDetail(page);
});
test('history thumbnails fall back to the TCGplayer 200w image', async ({ page }) => {
  await page.route(TCGDEX, fail); await page.route(TCGPLAYER, svg([]));
  await page.goto('/'); await scan(page, '900001', 'テストA', true); await openRoute(page, '履歴');
  await expect(page.locator('.scan-history-row img')).toHaveAttribute('src', 'https://tcgplayer-cdn.tcgplayer.com/product/900001_200w.jpg');
  await expect(page.locator('.scan-history-thumbnail > span')).toBeHidden();
});
test('alternatives thumbnails fall back to the TCGplayer 200w image; the image is removed only after all fail', async ({ page }) => {
  await page.route(TCGDEX, fail); await page.route(TCGPLAYER, route => route.request().url().includes('900002') ? fail(route) : route.fulfill({ contentType: 'image/svg+xml', body: cardSvg }));
  await page.goto('/'); await setProbe(page, { top: [{ id: '900001', score: .9 }, { id: '900002', score: .8 }] });
  await scan(page, '900001', 'テストA');
  await page.getByRole('button', { name: '他の候補', exact: true }).click();
  const items = page.getByRole('dialog', { name: '他の候補', exact: true }).locator('.alternative-item'); await expect(items).toHaveCount(2);
  await expect(items.nth(0).locator('img')).toHaveAttribute('src', 'https://tcgplayer-cdn.tcgplayer.com/product/900001_200w.jpg');
  await expect(items.nth(1).locator('img')).toHaveCount(0);
});
