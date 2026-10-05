import { test, expect } from '@playwright/test';
import { installPokemonFlow, startScan, tinyPng } from './pokemon-synthetic.js';
// SYNTHETIC camera/worker. Layout checks are Chromium viewport checks, not iPhone Safari evidence.
test('idle camera shows the app name, a one-line hint and no MTG wording or mana wheel (SYNTHETIC)', async ({ page }) => {
  await installPokemonFlow(page); await page.goto('/');
  const intro = page.locator('.camera-intro'); await expect(intro).toBeVisible();
  await expect(intro.locator('h2')).toHaveText('ポケカスキャナー'); await expect(intro).toContainText('ポケモンカードをかざして');
  await expect(intro).toContainText('履歴に保存'); await expect(page.locator('.intro-logo, img[src*="mana"]')).toHaveCount(0);
  const text = await page.locator('body').innerText(); for (const banned of ['Mana Peek', 'MTG', 'マナ', 'Scryfall', 'フォーマット']) expect(text).not.toContain(banned);
  await expect(page).toHaveTitle('ポケカスキャナー'); await expect(page.locator('header h1')).toHaveText('ポケカスキャナー');
  await startScan(page); await expect(intro).toBeHidden();
  await page.getByRole('button', { name: '停止', exact: true }).click(); await expect(intro).toBeVisible();
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
