import { openRoute, closeRoute } from './immersive-routes.js';
import { test, expect } from '@playwright/test';
import { installPokemonFlow } from './pokemon-synthetic.js';
// SYNTHETIC provider/image fixtures (pokemon-synthetic.ts); no real recognition or prices.
test('functional neutral camera-first shell has visible actions without automatic permission', async ({ page }, info) => {
  let permissions = 0;
  await page.exposeFunction('permissionRequested', () => permissions++);
  await page.addInitScript(() => { Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: async () => { await (window as unknown as { permissionRequested: () => Promise<void> }).permissionRequested(); throw new DOMException('SYNTHETIC denial', 'NotAllowedError'); } } }); });
  await page.goto('/');
  await expect(page.locator('header')).toHaveText('ポケカスキャナー情報・設定');
  await expect(page.getByText('この1枚を、もっと知る。')).toHaveCount(0);
  await expect(page.getByText('カードをかざす。知りたいことが見える。')).toHaveCount(0);
  await expect(page.locator('.intro')).toHaveCount(0);
  for (const width of [info.project.name === 'desktop' ? 1280 : 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.getByRole('button', { name: 'スキャン開始', exact: true })).toBeInViewport();
    await openRoute(page,'画像');
    await expect(page.locator('.file-button')).toBeInViewport();await closeRoute(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  expect(permissions).toBe(0);
  const background = await page.locator('.viewport').evaluate(node => getComputedStyle(node).backgroundColor);
  expect(background).toBe('rgb(25, 27, 32)');
  await page.setViewportSize(info.project.name === 'desktop' ? { width: 1280, height: 900 } : { width: 390, height: 844 });
  await page.screenshot({ path: info.outputPath(`${info.project.name}-initial.png`) });
  await page.route('https://cdn.jsdelivr.net/**', route => route.abort());
  await closeRoute(page); await page.getByRole('button', { name: 'スキャン開始', exact: true }).click();
  await expect(page.locator('.camera-status')).toContainText('カメラの許可がありません');
  await openRoute(page,'画像');await expect(page.locator('#local-image')).toBeEnabled();
});
test('detail sheet retains price, link, focus and scroll through late FX (SYNTHETIC)', async ({ page }, info) => {
  await installPokemonFlow(page);
  let release!: () => void; const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('https://api.frankfurter.dev/**', async route => { await pending; await route.fulfill({ json: { date: '2026-10-02', base: 'USD', quote: 'JPY', rate: 150 } }); });
  await page.goto('/'); await page.getByRole('button', { name: 'スキャン開始', exact: true }).click();
  await expect(page.locator('.tentative')).toContainText('テストA'); await page.getByRole('button', { name: '画像から詳細を見る', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'カードの詳細', exact: true }); await expect(sheet).toBeVisible();
  await expect(sheet.locator('.price')).toHaveText('概算JPYは利用できません'); await expect(sheet.locator('.usd')).toHaveText('$1.00 USD');
  await page.screenshot({ path: info.outputPath(`${info.project.name}-loading-fx.png`) });
  const save = sheet.getByRole('button', { name: '履歴に保存', exact: true }); await save.focus();
  const y = await page.evaluate(() => { (window as unknown as { img: Element | null }).img = document.querySelector('.tentative img'); return scrollY; });
  release(); await expect(sheet.locator('.price')).toHaveText('参考価格 ￥150');
  await expect(save).toBeFocused(); expect(await page.evaluate(() => scrollY)).toBe(y);
  expect(await page.evaluate(() => (window as unknown as { img: Element | null }).img === document.querySelector('.tentative img'))).toBe(true);
  await expect(sheet.locator('.reference-image img')).toBeVisible();
  const link = sheet.getByRole('link', { name: '晴れる屋2で探す ↗' }); await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  for (const width of [info.project.name === 'desktop' ? 1280 : 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 320) await page.screenshot({ path: info.outputPath(`${info.project.name}-narrow320.png`), fullPage: true });
  }
  await page.screenshot({ path: info.outputPath(`${info.project.name}-result.png`) });
});
