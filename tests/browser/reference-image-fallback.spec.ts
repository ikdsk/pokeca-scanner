import { openRoute, closeRoute } from './immersive-routes.js';
import { test, expect, type Page } from '@playwright/test';
import { installPokemonFlow, setProbe, tinyPng, cardSvg } from './pokemon-synthetic.js';
// SYNTHETIC worker, input pixels, metadata and routed images (TCGdex 404 -> TCGplayer 200).
// Proves fallback wiring only, not real recognition or real image coverage.
const TCGPLAYER = 'https://tcgplayer-cdn.tcgplayer.com/**';
async function scan(page: Page, id: string, name: string) {
  await setProbe(page, { id, score: .95 });
  await page.locator('#local-image').setInputFiles({ name: 'SYNTHETIC.png', mimeType: 'image/png', buffer: Buffer.from(await tinyPng(page), 'base64') });
  await expect(page.locator('.tentative')).toContainText(name); await closeRoute(page);
  await page.getByRole('button', { name: 'これです', exact: true }).click();
}
test.beforeEach(async ({ page }) => {
  await installPokemonFlow(page);
  await page.addInitScript(() => { Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: async () => { throw new DOMException('SYNTHETIC denied', 'NotAllowedError'); } } }); });
});
test('TCGdex image is used when it loads (no TCGplayer request)', async ({ page }) => {
  const cdn: string[] = []; await page.route(TCGPLAYER, route => { cdn.push(route.request().url()); return route.fulfill({ contentType: 'image/svg+xml', body: cardSvg }); });
  await page.goto('/'); await scan(page, '900001', 'テストA'); await openRoute(page, '確定カード');
  const image = page.locator('.result .reference-image img').first();
  await expect(image).toBeVisible(); await expect(image).toHaveAttribute('src', /assets\.tcgdex\.net/);
  await expect(page.locator('.result .reference-image')).toContainText('画像提供：TCGdex');
  expect(cdn).toEqual([]);
});
test('falls back to the TCGplayer product image when TCGdex fails, crediting TCGplayer', async ({ page }) => {
  await page.route('https://assets.tcgdex.net/**', route => route.fulfill({ status: 404, body: 'nope' }));
  const cdn: string[] = []; await page.route(TCGPLAYER, route => { cdn.push(route.request().url()); return route.fulfill({ contentType: 'image/svg+xml', body: cardSvg }); });
  await page.goto('/'); await scan(page, '900001', 'テストA'); await openRoute(page, '確定カード');
  const reference = page.locator('.result .reference-image').first(); const image = reference.locator('img');
  await expect(image).toBeVisible(); await expect(image).toHaveAttribute('src', 'https://tcgplayer-cdn.tcgplayer.com/product/900001_in_600x600.jpg');
  await expect(image).toHaveAttribute('referrerpolicy', 'no-referrer'); await expect(image).toHaveAttribute('width', '488'); await expect(image).toHaveAttribute('height', '680');
  await expect(reference).toContainText('画像提供：TCGplayer'); await expect(reference).not.toContainText('TCGdex');
  await expect(reference.getByRole('link', { name: 'TCGplayer' })).toHaveAttribute('href', 'https://www.tcgplayer.com/product/900001');
  expect(cdn.length).toBeGreaterThan(0);
});
test('keeps the unavailable message when every source fails', async ({ page }) => {
  await page.route('https://assets.tcgdex.net/**', route => route.fulfill({ status: 404, body: 'nope' }));
  await page.route(TCGPLAYER, route => route.fulfill({ status: 404, body: 'nope' }));
  await page.goto('/'); await scan(page, '900001', 'テストA'); await openRoute(page, '確定カード');
  await expect(page.locator('.result .reference-image').first()).toContainText('参照画像を読み込めません。カード情報・価格は引き続き確認できます。');
  await expect(page.locator('.result .reference-image img').first()).toBeHidden();
});
test('history thumbnails fall back to the TCGplayer 200w image', async ({ page }) => {
  await page.route('https://assets.tcgdex.net/**', route => route.fulfill({ status: 404, body: 'nope' }));
  const cdn: string[] = []; await page.route(TCGPLAYER, route => { cdn.push(route.request().url()); return route.fulfill({ contentType: 'image/svg+xml', body: cardSvg }); });
  await page.goto('/'); await scan(page, '900001', 'テストA'); await openRoute(page, '履歴');
  const thumb = page.locator('.scan-history-row img');
  await expect(thumb).toHaveAttribute('src', 'https://tcgplayer-cdn.tcgplayer.com/product/900001_200w.jpg');
  await expect(page.locator('.scan-history-thumbnail > span')).toBeHidden();
});
