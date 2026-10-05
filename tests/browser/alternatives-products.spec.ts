import { test, expect } from '@playwright/test';
import { installPokemonFlow, setProbe, frames } from './pokemon-synthetic.js';
import { dialog, scanA, openDetail, closeDetail } from './detail-flow.js';
// SYNTHETIC topMatches/TCGdex/price data. Proves UI behavior on routed fixtures, not real catalog neighbours.
const top = (...rows: [string, number][]) => rows.map(([id, score]) => ({ id, score }));
const list = (page: import('@playwright/test').Page) => page.getByRole('dialog', { name: '他の候補', exact: true });

test('他の候補 lists resolved topMatches, deduped by card, best first, max 4, unresolved hidden (SYNTHETIC)', async ({ page }) => {
  const { tcgdexRequests } = await installPokemonFlow(page);
  await page.goto('/'); await setProbe(page, { top: top(['900001', .9], ['900011', .89], ['900002', .8], ['900099', .75], ['900007', .74], ['900003', .7], ['900004', .6], ['900005', .5]), score: .9 });
  await page.getByRole('button', { name: 'スキャン開始', exact: true }).click(); await expect(page.locator('.tentative')).toContainText('テストA');
  await page.getByRole('button', { name: '他の候補', exact: true }).click(); await expect(list(page)).toBeVisible();
  const items = list(page).locator('.alternative-item'); await expect(items).toHaveCount(4);
  await expect(items.nth(0)).toContainText('テストA'); await expect(items.nth(0)).toContainText('現在の候補'); await expect(items.nth(0)).toContainText('類似度 0.900');
  await expect(items.nth(1)).toContainText('テストB'); await expect(items.nth(2)).toContainText('テストC'); await expect(items.nth(3)).toContainText('テストE');
  await expect(items.nth(1)).toContainText('テスト拡張 TST 002/066'); await expect(items.nth(1)).toContainText('類似度 0.800');
  await expect(list(page)).not.toContainText('900099'); await expect(list(page)).not.toContainText('900007'); await expect(list(page)).not.toContainText('テストF');
  await expect(page.locator('.scan-history-row')).toHaveCount(0);
  expect(tcgdexRequests.filter(id => id === 'TST-001')).toHaveLength(1);
});
test('only the current candidate when nothing else resolves; it opens its detail (SYNTHETIC)', async ({ page }) => {
  await installPokemonFlow(page); await scanA(page);
  await page.getByRole('button', { name: '他の候補', exact: true }).click(); const items = list(page).locator('.alternative-item'); await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText('現在の候補'); await items.first().click();
  await expect(dialog(page)).toBeVisible(); await expect(dialog(page)).toContainText('テストA'); await expect(list(page)).toBeHidden();
});
test('choosing another candidate shows it as the current card, with its price; save stores it (SYNTHETIC)', async ({ page }) => {
  await installPokemonFlow(page); await page.goto('/'); await setProbe(page, { top: top(['900001', .9], ['900002', .8]), score: .9 });
  await page.getByRole('button', { name: 'スキャン開始', exact: true }).click(); await expect(page.locator('.tentative')).toContainText('テストA');
  await page.getByRole('button', { name: '他の候補', exact: true }).click(); await list(page).locator('.alternative-item').filter({ hasText: 'テストB' }).click();
  await expect(list(page)).toBeHidden(); const panel = page.locator('.tentative');
  await expect(panel).toContainText('テストB'); await expect(panel).not.toContainText('テストA'); await expect(panel.locator('.usd')).toHaveText('$2.00 USD'); await expect(panel.locator('.regulation-badge')).toHaveText('H');
  await expect(panel).toContainText('類似度 0.800');
  const before = await frames(page); await expect.poll(() => frames(page)).toBeGreaterThan(before + 3); await expect(panel).toContainText('テストB');
  await expect(page.getByRole('button', { name: '停止', exact: true })).toBeEnabled(); await expect(page.locator('.scan-history-row')).toHaveCount(0);
  await panel.getByRole('button', { name: '履歴に保存', exact: true }).click(); await page.getByRole('button', { name: '履歴', exact: true }).click();
  await expect(page.locator('.scan-history-row')).toHaveCount(1); await expect(page.locator('.scan-history-row')).toContainText('テストB');
});
test('a newer verified candidate cannot replace the list while 他の候補 is open (SYNTHETIC)', async ({ page }) => {
  await installPokemonFlow(page); await page.goto('/'); await setProbe(page, { top: top(['900001', .9], ['900002', .8]), score: .9 });
  await page.getByRole('button', { name: 'スキャン開始', exact: true }).click(); await expect(page.locator('.tentative')).toContainText('テストA');
  await page.getByRole('button', { name: '他の候補', exact: true }).click(); await expect(list(page).locator('.alternative-item')).toHaveCount(2);
  await setProbe(page, { id: '900003', top: [] }); const before = await frames(page); await expect.poll(() => frames(page)).toBeGreaterThan(before + 4);
  await expect(list(page).locator('.alternative-item')).toHaveCount(2); await expect(list(page)).not.toContainText('テストC');
  await list(page).getByRole('button', { name: '閉じる', exact: true }).click(); await expect(page.locator('.tentative')).toContainText('テストC');
});

test('「同じカードの別商品」 shows the other TCGplayer product with its own USD price (SYNTHETIC)', async ({ page }) => {
  await installPokemonFlow(page); await page.goto('/'); await setProbe(page, { top: top(['900001', .9], ['900011', .89], ['900002', .8]), score: .9 });
  await page.getByRole('button', { name: 'スキャン開始', exact: true }).click(); await expect(page.locator('.tentative')).toContainText('テストA'); await openDetail(page);
  const section = dialog(page).locator('.same-card-products'); await expect(section).toBeVisible(); await expect(section.getByRole('heading', { name: '同じカードの別商品' })).toBeVisible();
  const rows = section.locator('.same-card-product'); await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('モンスターボール柄'); await expect(rows.first()).toContainText('$4.00 USD'); await expect(rows.first()).toContainText('参考価格 ￥600');
  await expect(section).toContainText('国内販売・買取価格ではありません'); await expect(section).not.toContainText('テストB');
  await expect(dialog(page).locator('.candidate-price .usd')).toHaveText('$1.00 USD');
});
test('section is omitted when no other product of the card is known (SYNTHETIC)', async ({ page }) => {
  await installPokemonFlow(page); await scanA(page); await openDetail(page);
  await expect(dialog(page).locator('.same-card-products')).toHaveCount(0); await expect(dialog(page)).not.toContainText('同じカードの別商品');
  await closeDetail(page);
});
