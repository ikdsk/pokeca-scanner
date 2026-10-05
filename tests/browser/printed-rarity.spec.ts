import { test, expect } from '@playwright/test';
import { installPokemonFlow, setProbe } from './pokemon-synthetic.js';
// SYNTHETIC worker/TCGdex fixtures: catalogMeta.rarity is TCGplayer's name; the TCGdex fixture rarity differs on purpose.
// Mock passes prove the wiring only, not real catalog rarities.
const top = (...rows: [string, number][]) => rows.map(([id, score]) => ({ id, score }));
const panel = (page: import('@playwright/test').Page) => page.locator('.tentative');
const start = (page: import('@playwright/test').Page) => page.getByRole('button', { name: 'スキャン開始', exact: true }).click();

test('live candidate shows the printed symbol from catalogMeta right after the name, not in the meta row (SYNTHETIC)', async ({ page }) => {
  await installPokemonFlow(page); await page.goto('/'); await start(page);
  await expect(panel(page)).toContainText('テストA');
  await expect(panel(page).locator('.rarity-badge')).toHaveText('SR');
  await expect(panel(page).locator('.rarity-badge')).toHaveAttribute('title', 'レアリティ SR');
  await expect(panel(page).locator('.rarity')).toHaveCount(0);
  expect(await panel(page).locator('.candidate-name + .rarity-badge').count()).toBe(1);
  await expect(panel(page).locator('.meta .rarity-badge')).toHaveCount(0);
  await expect(panel(page).locator('.meta .regulation-badge')).toHaveText('G');
  const name = (await panel(page).locator('.candidate-name').boundingBox())!, badge = (await panel(page).locator('.rarity-badge').boundingBox())!;
  expect(badge.x).toBeGreaterThanOrEqual(name.x + name.width - 1); expect(Math.abs((badge.y + badge.height / 2) - (name.y + name.height / 2))).toBeLessThan(name.height);
});
test('unmapped TCGplayer rarity (None) shows no rarity at all, not the TCGdex one (SYNTHETIC)', async ({ page }) => {
  await installPokemonFlow(page); await page.goto('/'); await setProbe(page, { id: '900003' }); await start(page);
  await expect(panel(page)).toContainText('テストC');
  await expect(panel(page).locator('.rarity-badge')).toHaveCount(0); await expect(panel(page)).not.toContainText('レアリティ');
});
test('a picked alternative shows its own product rarity, and history keeps it (SYNTHETIC)', async ({ page }) => {
  await installPokemonFlow(page); await page.goto('/'); await setProbe(page, { top: top(['900001', .9], ['900002', .8]), score: .9 }); await start(page);
  await expect(panel(page).locator('.rarity-badge')).toHaveText('SR');
  await page.getByRole('button', { name: '他の候補', exact: true }).click();
  await page.getByRole('dialog', { name: '他の候補', exact: true }).locator('.alternative-item').filter({ hasText: 'テストB' }).click();
  await expect(panel(page)).toContainText('テストB'); await expect(panel(page).locator('.rarity-badge')).toHaveText('UR');
  await panel(page).getByRole('button', { name: '履歴に保存', exact: true }).click();
  await page.getByRole('button', { name: '停止', exact: true }).click();
  await page.getByRole('button', { name: '履歴', exact: true }).click(); await page.locator('.scan-history-row').click();
  await expect(panel(page)).toContainText('テストB'); await expect(panel(page).locator('.rarity-badge')).toHaveText('UR');
});
test('他の候補 rows show the rarity right after the name; none when rarity is null (SYNTHETIC)', async ({ page }) => {
  await installPokemonFlow(page); await page.goto('/'); await setProbe(page, { top: top(['900001', .9], ['900002', .8]), score: .9 }); await start(page);
  await expect(panel(page).locator('.rarity-badge')).toHaveText('SR');
  await page.getByRole('button', { name: '他の候補', exact: true }).click();
  const rows = page.getByRole('dialog', { name: '他の候補', exact: true }).locator('.alternative-item');
  await expect(rows.filter({ hasText: 'テストB' }).locator('strong + .rarity-badge')).toHaveText('UR');
  await expect(rows.filter({ hasText: 'テストA' }).locator('strong + .rarity-badge')).toHaveText('SR');
});
for (const width of [320, 390]) test(`a very long name ellipsizes before the rarity badge at ${width}px and the badge stays visible (SYNTHETIC)`, async ({ page }) => {
  await page.setViewportSize({ width, height: 740 }); await installPokemonFlow(page, { longName: 'とても長い名前のテストカードとても長い名前のテストカードとても長い名前のテストカード' });
  await page.goto('/'); await start(page);
  await expect(panel(page)).toContainText('とても長い名前');
  const badge = panel(page).locator('.rarity-badge'); await expect(badge).toBeInViewport({ ratio: 1 });
  const box = (await badge.boundingBox())!, name = (await panel(page).locator('.candidate-name').boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(width); expect(box.x).toBeGreaterThanOrEqual(name.x + name.width - 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
});
