import { test, expect } from '@playwright/test';
import { installPokemonFlow, startScan, tinyPng } from './pokemon-synthetic.js';
// SYNTHETIC camera/worker. Layout checks are Chromium viewport checks, not iPhone Safari evidence.
test('idle camera shows the app name, a one-line hint and no MTG wording or mana wheel (SYNTHETIC)', async ({ page }) => {
  await installPokemonFlow(page); await page.goto('/');
  const intro = page.locator('.camera-intro'); await expect(intro).toBeVisible();
  await expect(intro.locator('h2')).toHaveText('ポケカスキャナー'); await expect(intro).toContainText('ポケモンカードをかざして');
  await expect(intro).toContainText('履歴に保存'); await expect(page.locator('.intro-logo, img[src*="mana"]')).toHaveCount(0);
  // The sister-app link intentionally names MTG / Mana Peek; strip its text so the banned-word check still covers everything else.
  const text = (await page.locator('body').innerText()).replaceAll('MTG版はこちら →', '').replaceAll('MTGカード版の Mana Peek もあります', ''); for (const banned of ['Mana Peek', 'MTG', 'マナ', 'Scryfall', 'フォーマット']) expect(text).not.toContain(banned);
  await expect(page).toHaveTitle('ポケカスキャナー'); await expect(page.locator('header h1')).toHaveText('ポケカスキャナー');
  await startScan(page); await expect(intro).toBeHidden();
  await page.getByRole('button', { name: '停止', exact: true }).click(); await expect(intro).toBeVisible();
});
test('idle intro links to the MTG sister app in a new tab, below the history-save hint (SYNTHETIC)', async ({ page }) => {
  await installPokemonFlow(page); await page.goto('/');
  const link = page.locator('.camera-intro').getByRole('link', { name: 'MTG版はこちら →' }); await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', 'https://ikdsk.github.io/mtg-card-scanner/'); await expect(link).toHaveAttribute('target', '_blank'); await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  const hint = (await page.getByText('残したいカードは「履歴に保存」。').boundingBox())!; const l = (await link.boundingBox())!;
  expect(l.y).toBeGreaterThanOrEqual(hint.y + hint.height - 2);
  await startScan(page); await expect(link).toBeHidden();
});
for (const width of [320, 390]) test(`start hint arrow sits under the scan button only while idle at ${width}px (SYNTHETIC)`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 844 }); await installPokemonFlow(page); await page.goto('/');
  const hint = page.locator('.start-hint'); const start = page.getByRole('button', { name: 'スキャン開始', exact: true });
  await expect(hint).toBeVisible(); await expect(hint).toContainText('タップしてスタート！'); await expect(hint.locator('svg')).toHaveCount(1);
  const h = (await hint.boundingBox())!; const s = (await start.boundingBox())!;
  expect(h.y).toBeGreaterThanOrEqual(s.y + s.height - 2); expect(h.y - (s.y + s.height)).toBeLessThanOrEqual(40); expect(h.x < s.x + s.width && h.x + h.width > s.x).toBe(true);
  const gear = (await page.getByRole('button', { name: '情報・設定', exact: true }).boundingBox())!;
  expect(h.x < gear.x + gear.width && h.x + h.width > gear.x && h.y < gear.y + gear.height && h.y + h.height > gear.y).toBe(false);
  await page.screenshot({ path: info.outputPath(`start-hint-${width}.png`) });
  await start.click(); await expect(hint).toBeHidden(); await page.getByRole('button', { name: '停止', exact: true }).click(); await expect(hint).toBeVisible();
});
test('intro and hint hide when a candidate is shown from a local image without the camera (SYNTHETIC)', async ({ page }) => {
  await installPokemonFlow(page); await page.goto('/'); await expect(page.locator('.start-hint')).toBeVisible();
  await page.getByRole('button', { name: '画像', exact: true }).click();
  await page.locator('#local-image').setInputFiles({ name: 's.png', mimeType: 'image/png', buffer: Buffer.from(await tinyPng(page), 'base64') });
  await expect(page.locator('.tentative')).toContainText('テストA'); await expect(page.locator('.camera-intro')).toBeHidden(); await expect(page.locator('.start-hint')).toBeHidden();
});
