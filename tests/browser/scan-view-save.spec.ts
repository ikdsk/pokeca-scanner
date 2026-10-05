import { test, expect } from '@playwright/test';
import { installPokemonFlow, setProbe, frames } from './pokemon-synthetic.js';
import { dialog, scanA, openDetail, closeDetail } from './detail-flow.js';
// SYNTHETIC. かざす → 見る → 任意保存: nothing is saved unless the reader asks.
test('showing a candidate never saves; the camera keeps running (SYNTHETIC)', async ({ page }) => {
  await installPokemonFlow(page); await scanA(page);
  await expect(page.locator('.scan-history-row')).toHaveCount(0); await expect(page.getByRole('button', { name: '停止', exact: true })).toBeEnabled();
  const before = await frames(page); await expect.poll(() => frames(page)).toBeGreaterThan(before + 2);
  await expect(page.locator('.scan-history-row')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'これです', exact: true })).toHaveCount(0); await expect(page.getByRole('button', { name: '違う', exact: true })).toHaveCount(0);
});
test('tapping the image or name opens the detail sheet; 詳細を見る button does not exist (SYNTHETIC)', async ({ page }) => {
  await installPokemonFlow(page); await scanA(page);
  await expect(page.getByRole('button', { name: '詳細を見る', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => [...document.querySelectorAll('[aria-controls]')].filter(n => !document.getElementById(n.getAttribute('aria-controls')!)).map(n => n.getAttribute('aria-label') ?? n.textContent))).toEqual([]);
  for (const label of ['画像から詳細を見る', 'カード名から詳細を見る']) {
    const target = page.getByRole('button', { name: label, exact: true });
    await expect(target).toHaveAttribute('aria-controls', 'candidate-detail-sheet'); await expect(target).toHaveAttribute('aria-expanded', 'false');
    await target.click(); await expect(dialog(page)).toBeVisible(); await expect(dialog(page)).toContainText('テストA'); await expect(dialog(page)).toContainText('海外参考価格（TCGplayer）');
    await expect(dialog(page)).toContainText('国内販売・買取価格ではありません');
    await closeDetail(page); await expect(dialog(page)).toBeHidden(); await expect(target).toBeFocused();
  }
});
test('the sheet freezes the shown card while a newer verified card arrives; close resumes it (SYNTHETIC)', async ({ page }) => {
  await installPokemonFlow(page); await scanA(page); await openDetail(page);
  await expect(page.getByRole('button', { name: '閉じる', exact: true })).toBeFocused();
  await setProbe(page, { id: '900002' }); const before = await frames(page); await expect.poll(() => frames(page)).toBeGreaterThan(before + 4);
  await expect(dialog(page)).toContainText('テストA'); await expect(dialog(page)).not.toContainText('テストB');
  await page.keyboard.press('Escape'); await expect(dialog(page)).toBeHidden();
  await expect(page.locator('.tentative')).toContainText('テストB'); await expect(page.getByRole('button', { name: '停止', exact: true })).toBeEnabled();
  await expect(page.locator('.scan-history-row')).toHaveCount(0);
});
test('履歴に保存 saves once with brief feedback; 他の候補 replaces 違う (SYNTHETIC)', async ({ page }) => {
  await installPokemonFlow(page); await scanA(page); await openDetail(page);
  const save = dialog(page).getByRole('button', { name: '履歴に保存', exact: true }); await save.click();
  await expect(dialog(page)).toContainText('保存しました ✓'); await save.dispatchEvent('click');
  await closeDetail(page); await expect(page.locator('.tentative')).toContainText('テストA');
  const dock = page.getByRole('button', { name: '履歴に保存', exact: true }).or(page.getByRole('button', { name: '保存しました ✓', exact: true })); await expect(dock.first()).toBeVisible();
  await page.getByRole('button', { name: '履歴', exact: true }).click(); await expect(page.locator('.scan-history-row')).toHaveCount(1); await expect(page.locator('.scan-history-row')).toContainText('テストA');
  await expect(page.getByRole('button', { name: '停止', exact: true })).toHaveCount(1);
});
test('the sheet closes by × and by a downward swipe on its header only (SYNTHETIC)', async ({ page }) => {
  await installPokemonFlow(page); await scanA(page); await openDetail(page);
  const body = page.locator('.detail-sheet-body'); await body.dispatchEvent('pointerdown', { pointerId: 1, isPrimary: true, clientX: 100, clientY: 150 }); await body.dispatchEvent('pointerup', { pointerId: 1, isPrimary: true, clientX: 100, clientY: 260 });
  await expect(dialog(page)).toBeVisible();
  const header = (await page.locator('.detail-sheet-header').boundingBox())!;
  await page.mouse.move(header.x + 30, header.y + 10); await page.mouse.down(); await page.mouse.move(header.x + 30, header.y + 90); await page.mouse.up();
  await expect(dialog(page)).toBeHidden(); await expect(page.getByRole('button', { name: '画像から詳細を見る', exact: true })).toBeFocused();
  await expect(page.locator('.scan-history-row')).toHaveCount(0);
});
