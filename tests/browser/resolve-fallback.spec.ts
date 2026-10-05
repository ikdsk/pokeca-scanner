import { test, expect } from '@playwright/test';
import { installPokemonFlow, setProbe, startScan } from './pokemon-synthetic.js';
// SYNTHETIC topMatches/TCGdex/price data (issue #16). Proves the fallback UI behavior on routed fixtures,
// not real catalog neighbours. Top match 900099 has no TCGdex card; 900098 has no catalog meta; 900002 resolves.
const top = (...rows: [string, number][]) => rows.map(([id, score]) => ({ id, score }));

test('unresolvable top match falls back to the next resolvable one, with that product\'s own score/rarity/price (SYNTHETIC)', async ({ page }) => {
  const { tcgdexRequests } = await installPokemonFlow(page); await page.goto('/');
  await setProbe(page, { id: '900099', top: top(['900099', .83], ['900098', .67], ['900002', .66], ['900004', .65]), score: .83 }); await startScan(page);
  const panel = page.locator('.tentative');
  await expect(panel).toContainText('テストB'); await expect(panel).not.toContainText('テストA');
  await expect(panel).toContainText('類似度 0.660'); await expect(panel.locator('.usd')).toHaveText('$2.00 USD');
  await expect(page.locator('.camera-info')).not.toContainText('カード情報を確認できない候補は表示しません');
  await expect(page.locator('body')).not.toContainText('900099'); await expect(page.locator('body')).not.toContainText('900098');
  await page.getByRole('button', { name: '他の候補', exact: true }).click();
  const items = page.getByRole('dialog', { name: '他の候補', exact: true }).locator('.alternative-item');
  await expect(items).toHaveCount(2); await expect(items.nth(0)).toContainText('テストB'); await expect(items.nth(0)).toContainText('現在の候補'); await expect(items.nth(1)).toContainText('テストE');
  expect(tcgdexRequests.filter(id => id === 'TST-002')).toHaveLength(1);
});
test('fallback considers at most the first 5 top matches (SYNTHETIC)', async ({ page }) => {
  await installPokemonFlow(page); await page.goto('/');
  await setProbe(page, { id: '900099', top: top(['900099', .9], ['900098', .8], ['900097', .7], ['900096', .6], ['900095', .5], ['900002', .4]), score: .9 }); await startScan(page);
  await expect(page.locator('.camera-info')).toContainText('カード情報を確認できない候補は表示しません');
  await expect(page.locator('.tentative')).toBeHidden(); await expect(page.locator('.scan-history-row')).toHaveCount(0);
});
