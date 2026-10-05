import { test, expect } from '@playwright/test';
import { installPokemonFlow, startScan } from './pokemon-synthetic.js';
// SYNTHETIC camera/worker. Geometry is checked in Chromium only; it is not iPhone Safari evidence.
test('one camera button toggles スキャン開始 ↔ 停止 in the same place (SYNTHETIC)', async ({ page }) => {
  await installPokemonFlow(page); await page.goto('/');
  const start = page.getByRole('button', { name: 'スキャン開始', exact: true });
  await expect(start).toBeVisible(); await expect(start.locator('svg')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'カメラでスキャン', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '停止', exact: true })).toHaveCount(0);
  const before = (await start.boundingBox())!;
  await startScan(page);
  const stop = page.getByRole('button', { name: '停止', exact: true }); await expect(stop).toBeVisible(); await expect(page.getByRole('button', { name: 'スキャン開始', exact: true })).toHaveCount(0);
  const after = (await stop.boundingBox())!;
  expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(1); expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(1); expect(Math.abs(after.height - before.height)).toBeLessThanOrEqual(1);
  await stop.click(); await expect(page.getByRole('button', { name: 'スキャン開始', exact: true })).toBeVisible();
});
test('settings is an accessible gear on the same row as the camera button (SYNTHETIC)', async ({ page }) => {
  await installPokemonFlow(page); await page.goto('/');
  const gear = page.getByRole('button', { name: '情報・設定', exact: true }); await expect(gear.locator('svg')).toHaveCount(1);
  const g = (await gear.boundingBox())!; const s = (await page.getByRole('button', { name: 'スキャン開始', exact: true }).boundingBox())!;
  expect(Math.abs((g.y + g.height / 2) - (s.y + s.height / 2))).toBeLessThanOrEqual(1);
  expect(g.height).toBeGreaterThanOrEqual(44); expect(g.width).toBeGreaterThanOrEqual(44);
  await gear.click(); await expect(page.getByRole('dialog', { name: '設定', exact: true })).toBeVisible();
});
test('no detection or similarity diagnostics line is shown while scanning (SYNTHETIC)', async ({ page }) => {
  await installPokemonFlow(page); await page.goto('/'); await startScan(page); await expect(page.locator('.tentative')).toContainText('テストA');
  await expect(page.locator('.camera-info')).not.toContainText('四隅を検出'); await expect(page.locator('.camera-info')).not.toContainText('カード検出なし');
  await expect(page.locator('.camera-info')).not.toContainText('margin'); await expect(page.locator('.camera-info')).not.toContainText('類似度 —');
  await expect(page.locator('.detection-overlay')).toBeAttached();
});
