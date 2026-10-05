import { test, expect } from '@playwright/test';
import { installPokemonFlow, startScan, setProbe, frames } from './pokemon-synthetic.js';
// SYNTHETIC worker/provider data. The sticky rule: a shown (verified) candidate stays until the next
// verified candidate replaces it.
const more = async (page: import('@playwright/test').Page, n = 4) => { const before = await frames(page); await expect.poll(() => frames(page)).toBeGreaterThanOrEqual(before + n); };

test('shown candidate stays through absent, invalid and weak frames (SYNTHETIC)', async ({ page }) => {
  await installPokemonFlow(page); await page.goto('/'); await startScan(page);
  const panel = page.locator('.tentative'); await expect(panel).toContainText('テストA');
  await page.evaluate(() => { const p = document.querySelector<HTMLElement>('.tentative')!; const log: boolean[] = []; Object.assign(window, { hiddenLog: log }); new MutationObserver(() => log.push(p.hidden === true)).observe(p, { attributes: true, attributeFilter: ['hidden'] }); });
  await setProbe(page, { present: false }); await more(page, 6); await expect(panel).toBeVisible(); await expect(panel).toContainText('テストA');
  await setProbe(page, { present: true, score: .1 }); await more(page); await expect(panel).toContainText('テストA');
  await setProbe(page, { score: .623, id: 'unknown-product' }); await more(page); await expect(panel).toContainText('テストA');
  expect(await page.evaluate(() => (window as unknown as { hiddenLog: boolean[] }).hiddenLog)).not.toContain(true);
});
test('a verified replacement swaps in without passing through an empty panel (SYNTHETIC)', async ({ page }) => {
  await installPokemonFlow(page); await page.goto('/'); await startScan(page);
  const panel = page.locator('.tentative'); await expect(panel).toContainText('テストA');
  await page.evaluate(() => { const p = document.querySelector<HTMLElement>('.tentative')!; const names: string[] = []; Object.assign(window, { nameLog: names, hiddenLog: [] as boolean[] }); new MutationObserver(() => { names.push(p.querySelector('strong')?.textContent ?? ''); (window as unknown as { hiddenLog: boolean[] }).hiddenLog.push(p.hidden === true); }).observe(p, { subtree: true, childList: true, characterData: true, attributes: true }); });
  await setProbe(page, { id: '900002' }); await expect(panel).toContainText('テストB'); await expect(panel).not.toContainText('テストA');
  const log = await page.evaluate(() => ({ names: (window as unknown as { nameLog: string[] }).nameLog, hidden: (window as unknown as { hiddenLog: boolean[] }).hiddenLog }));
  expect(log.hidden).not.toContain(true); expect(log.names.filter(n => n !== 'テストA' && n !== 'テストB')).toEqual([]);
});
test('an unresolvable or failed replacement never evicts the shown candidate (SYNTHETIC)', async ({ page }) => {
  await installPokemonFlow(page); await page.route('https://api.tcgdex.net/v2/ja/cards/TST-002', route => route.abort());
  await page.goto('/'); await startScan(page); const panel = page.locator('.tentative'); await expect(panel).toContainText('テストA');
  await setProbe(page, { id: '900002' }); await expect(page.locator('.camera-info')).toContainText('通信に失敗しました');
  await expect(panel).toBeVisible(); await expect(panel).toContainText('テストA');
  await setProbe(page, { id: '900099' }); await more(page, 5); await expect(panel).toContainText('テストA');
});
