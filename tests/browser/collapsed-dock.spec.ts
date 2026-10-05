import { test, expect } from '@playwright/test';
import { installPokemonFlow, setProbe } from './pokemon-synthetic.js';
import { scanA } from './detail-flow.js';
// SYNTHETIC data. The collapsed dock is the only candidate surface; there is no expand/collapse toggle.
test('collapsed dock shows the regulation mark badge and expansion name + code (SYNTHETIC)', async ({ page }) => {
  await installPokemonFlow(page); await scanA(page);
  const panel = page.locator('.candidate-dock .tentative'); await expect(panel).toBeVisible();
  const badge = panel.locator('.regulation-badge'); await expect(badge).toBeInViewport(); await expect(badge).toHaveText('G');
  await expect(badge).toHaveAttribute('aria-label', 'レギュレーションマーク G');
  await expect(panel).toContainText('テスト拡張 TST 001/066'); await expect(panel.locator('.rarity')).toBeInViewport();
  await expect(panel.locator('.price')).toHaveText('参考価格 ￥150'); await expect(panel.locator('.usd')).toHaveText('$1.00 USD');
  await expect(panel.getByRole('button', { name: '履歴に保存', exact: true })).toBeInViewport(); await expect(panel.getByRole('button', { name: '他の候補', exact: true })).toBeInViewport();
  await expect(page.getByRole('button', { name: '候補パネルを拡大' })).toHaveCount(0); await expect(page.getByRole('button', { name: '候補パネルを縮小' })).toHaveCount(0);
  await expect(page.locator('.dock-toolbar')).toHaveCount(0);
  await setProbe(page, { id: '900002' }); await expect(panel.locator('.regulation-badge')).toHaveText('H');
});
for (const width of [320, 390]) test(`badge, expansion and actions fit the dock at ${width}px (SYNTHETIC)`, async ({ page }) => {
  await page.setViewportSize({ width, height: 740 }); await installPokemonFlow(page); await scanA(page);
  const dock = (await page.locator('.candidate-dock').boundingBox())!;
  for (const target of [page.locator('.tentative .regulation-badge'), page.locator('.tentative .meta'), page.getByRole('button', { name: '履歴に保存', exact: true })]) {
    const box = (await target.boundingBox())!; expect(box.y).toBeGreaterThanOrEqual(dock.y); expect(box.y + box.height).toBeLessThanOrEqual(dock.y + dock.height + 1);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
});
