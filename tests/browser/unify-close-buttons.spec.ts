import { test, expect } from '@playwright/test';
import { installPokemonFlow } from './pokemon-synthetic.js';
import { dialog, scanA, openDetail } from './detail-flow.js';
// SYNTHETIC. Drawer and detail sheet share one × icon helper (aria-label 閉じる).
test('drawer and detail sheet close with the same × icon button (SYNTHETIC)', async ({ page }) => {
  await installPokemonFlow(page); await scanA(page);
  await page.getByRole('button', { name: '履歴', exact: true }).click();
  const drawerClose = page.locator('.utility-drawer').getByRole('button', { name: '閉じる', exact: true }); await expect(drawerClose).toBeVisible();
  await expect(drawerClose.locator('svg')).toHaveCount(1); await expect(drawerClose).toHaveText(''); await expect(drawerClose).toHaveAttribute('title', '閉じる'); await expect(drawerClose).toHaveClass(/close-icon-button/);
  const dc = (await drawerClose.boundingBox())!; expect(dc.width).toBeGreaterThanOrEqual(44); expect(dc.height).toBeGreaterThanOrEqual(44);
  await drawerClose.click(); await expect(page.locator('.utility-drawer')).toBeHidden();
  await openDetail(page);
  const sheetClose = dialog(page).getByRole('button', { name: '閉じる', exact: true }); await expect(sheetClose.locator('svg')).toHaveCount(1); await expect(sheetClose).toHaveClass(/close-icon-button/);
  const sc = (await sheetClose.boundingBox())!; expect(sc.width).toBeGreaterThanOrEqual(44); expect(sc.height).toBeGreaterThanOrEqual(44);
  expect(await page.locator('.close-icon-button').evaluateAll(nodes => nodes.map(n => n.innerHTML.replace(/\s+/g, ' ')).filter((v, i, a) => a.indexOf(v) === i).length)).toBe(1);
  await page.getByRole('button', { name: '補助画面を閉じる' }).count().then(n => expect(n).toBe(0));
  await sheetClose.click(); await expect(dialog(page)).toBeHidden();
});
