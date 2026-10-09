import { openRoute, closeRoute } from './immersive-routes.js';
import { test, expect, type Page } from '@playwright/test';
import { installPokemonFlow, setProbe, frames, tinyPng } from './pokemon-synthetic.js';
// SYNTHETIC camera, worker, TCGdex JSON, price snapshot and FX (see pokemon-synthetic.ts). Mocked passes do not
// prove real recognition, provider coverage or iPhone Safari behavior.
const startCamera = (page: Page) => page.getByRole('button', { name: 'スキャン開始', exact: true }).click();
const stopCamera = async (page: Page) => { await closeRoute(page); await page.getByRole('button', { name: '停止', exact: true }).click(); };
const panel = (page: Page) => page.locator('.tentative');
const openSheet = (page: Page) => page.getByRole('button', { name: '画像から詳細を見る', exact: true }).click();
const saveButton = (page: Page) => page.locator('.tentative').getByRole('button', { name: /履歴に保存|保存しました/ });

test('candidate shows Japanese name, expansion+number, rarity, regulation badge, image, overseas price (SYNTHETIC)', async ({ page }, info) => {
  await installPokemonFlow(page); await page.goto('/'); await startCamera(page);
  await expect(panel(page).locator('strong').first()).toHaveText('テストA');
  await expect(panel(page)).toContainText('テスト拡張 TST 001/066');
  await expect(panel(page).locator('.rarity-badge')).toHaveText('SR'); // TCGplayer 'Super Rare', not the TCGdex 'C'
  await expect(panel(page).locator('.rarity-badge')).toHaveAttribute('aria-label', 'レアリティ SR'); await expect(panel(page)).not.toContainText('レアリティ C');
  await expect(panel(page).locator('.regulation-badge')).toHaveText('G');
  await expect(panel(page).locator('.regulation-badge')).toHaveAttribute('aria-label', 'レギュレーションマーク G');
  await expect(panel(page).locator('.match-note')).toHaveCount(0); await expect(page.locator('body')).not.toContainText('番号で照合');
  await expect(panel(page).locator('img')).toHaveAttribute('src', 'https://assets.tcgdex.net/ja/TST/TST/001/high.webp');
  await expect(panel(page).locator('.price')).toHaveText('参考価格 ￥150');
  await expect(panel(page).locator('.usd')).toHaveText('$1.00 USD');
  await expect(panel(page)).toContainText('海外参考価格（TCGplayer）');
  await expect(panel(page)).toContainText('国内販売・買取価格ではありません');
  await page.screenshot({ path: info.outputPath('candidate.png') });
  await openSheet(page);
  await expect(panel(page)).toContainText('価格更新 2026/10/05 05:05（日本時間）');
  await expect(panel(page)).toContainText('Frankfurter / ECB');
  await stopCamera(page);
});

test('until the card resolves the raw id is never shown and nothing can be saved (SYNTHETIC)', async ({ page }) => {
  await installPokemonFlow(page); let release!: () => void; const pending = new Promise<void>(r => { release = r; });
  await page.route('https://api.tcgdex.net/v2/ja/cards/TST-001', async route => { await pending; await route.fallback(); });
  await page.goto('/'); await startCamera(page);
  await expect(page.locator('.empty-candidate')).toContainText('カード情報を確認中…'); await expect(panel(page)).toBeHidden();
  await expect(page.locator('body')).not.toContainText('900001'); await expect(page.locator('body')).not.toContainText('TST-001');
  await expect(page.getByRole('button', { name: '履歴に保存', exact: true })).toBeHidden(); await expect(page.locator('.scan-history-row')).toHaveCount(0);
  release(); await expect(panel(page).locator('strong').first()).toHaveText('テストA');
  await stopCamera(page);
});

test('set_number matches show no match note and still price by product id (SYNTHETIC)', async ({ page }) => {
  await installPokemonFlow(page); await page.goto('/'); await setProbe(page, { id: '900021' }); await startCamera(page);
  await expect(panel(page).locator('strong').first()).toHaveText('テストD');
  await expect(panel(page)).toContainText('テスト拡張2 TST2 161/165');
  await expect(panel(page).locator('.match-note')).toHaveCount(0); await expect(page.locator('body')).not.toContainText('番号で照合');
  await expect(panel(page).locator('.usd')).toHaveText('$0.50 USD');
  await stopCamera(page);
});

for (const id of ['900099', 'unknown-product']) test(`candidate with no resolvable Japanese card (${id}) stays hidden, never an id-only candidate (SYNTHETIC)`, async ({ page }) => {
  await installPokemonFlow(page); await page.goto('/'); await setProbe(page, { id }); await startCamera(page);
  await expect(page.locator('.camera-info')).toContainText('カード情報を確認できない候補は表示しません');
  await expect(panel(page)).toBeHidden(); await expect(page.locator('.empty-candidate')).toBeVisible();
  await expect(page.locator('body')).not.toContainText(id);
  await expect(page.locator('.scan-history-row')).toHaveCount(0);
  await stopCamera(page);
});

test('metadata provider failure hides the candidate and says so without inventing a card (SYNTHETIC)', async ({ page }) => {
  await installPokemonFlow(page); await page.route('https://api.tcgdex.net/v2/ja/cards/TST-001', route => route.abort());
  await page.goto('/'); await startCamera(page);
  await expect(page.locator('.camera-info')).toContainText('通信に失敗しました'); await expect(panel(page)).toBeHidden();
  await stopCamera(page);
});

for (const mode of ['missing', 'html'] as const) test(`price snapshot ${mode === 'missing' ? '404' : 'HTML fallback'} shows the generation hint and no price (SYNTHETIC)`, async ({ page }) => {
  await installPokemonFlow(page, { prices: mode }); await page.goto('/'); await startCamera(page);
  await expect(panel(page).locator('.price')).toHaveText('価格データなし（npm run prices:snapshot で生成）');
  await expect(panel(page).locator('.usd')).toHaveCount(0); await expect(panel(page)).not.toContainText('参考価格 ￥');
  await expect(panel(page)).toContainText('国内販売・買取価格ではありません');
  await expect(panel(page)).toContainText('テストA');
  await stopCamera(page);
});

test('FX failure keeps USD; a real zero price stays zero (SYNTHETIC)', async ({ page }) => {
  await installPokemonFlow(page, { fx: 'fail' }); await page.goto('/'); await setProbe(page, { id: '900003' }); await startCamera(page);
  await expect(panel(page).locator('.price')).toHaveText('概算JPYは利用できません');
  await expect(panel(page).locator('.usd')).toHaveText('$0.00 USD');
  await openSheet(page);
  await expect(panel(page)).toContainText('為替を取得できません。USDのみ表示します。');
  await stopCamera(page);
});

test('several subtypes: Normal is shown, the others are listed small, none is silently substituted (SYNTHETIC)', async ({ page }) => {
  await installPokemonFlow(page); await page.goto('/'); await setProbe(page, { id: '900002' }); await startCamera(page);
  await expect(panel(page).locator('.price')).toHaveText('参考価格 ￥300'); await expect(panel(page).locator('.usd')).toHaveText('$2.00 USD');
  await openSheet(page);
  await expect(panel(page).locator('.others')).toHaveText('他の価格区分：Reverse Holofoil $3.50 USD（参考価格 ￥525）');
  await stopCamera(page);
});

test('several subtypes without a matching row: no price headline, never a substituted subtype (SYNTHETIC)', async ({ page }) => {
  const ambiguous = { source: 'tcgcsv/tcgplayer', category: 85, fetchedAt: '2026-10-05T00:00:00Z', providerUpdatedAt: null, prices: { '900001': [['Holofoil', 9], ['Reverse Holofoil', 8]] } };
  await installPokemonFlow(page, { prices: ambiguous }); await page.goto('/'); await startCamera(page);
  await expect(panel(page).locator('.price')).toHaveText('版により価格が異なります'); await expect(panel(page).locator('.usd')).toHaveCount(0);
  await stopCamera(page);
});

test('same card under another product id does not flicker or get re-proposed (SYNTHETIC Poke Ball Pattern case)', async ({ page }) => {
  const { tcgdexRequests } = await installPokemonFlow(page); await page.goto('/'); await setProbe(page, { id: '900021' });
  await page.evaluate(() => {
    const log: string[] = []; Object.assign(window, { nameLog: log });
    new MutationObserver(() => { const n = document.querySelector('.tentative strong'); if (n && !document.querySelector('.tentative')!.hasAttribute('hidden')) log.push(n.textContent ?? ''); })
      .observe(document.querySelector('.tentative')!, { subtree: true, childList: true, characterData: true, attributes: true });
  });
  await startCamera(page); await expect(panel(page).locator('strong').first()).toHaveText('テストD');
  await page.evaluate(() => { (window as unknown as { nameLog: string[] }).nameLog.length = 0; });
  for (const id of ['900022', '900021', '900022']) { await setProbe(page, { id }); const before = await frames(page); await expect.poll(() => frames(page)).toBeGreaterThanOrEqual(before + 2); }
  await expect(panel(page).locator('strong').first()).toHaveText('テストD'); await expect(panel(page)).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { nameLog: string[] }).nameLog.filter(t => t !== 'テストD'))).toEqual([]);
  expect(tcgdexRequests.filter(id => id === 'TST2-161')).toHaveLength(1);
  // Saving records one event and the other product id stays suppressed afterwards (the card stays shown).
  await saveButton(page).click(); await expect(page.locator('.scan-history-row')).toHaveCount(1);
  for (const id of ['900022', '900021']) { await setProbe(page, { id }); const before = await frames(page); await expect.poll(() => frames(page)).toBeGreaterThanOrEqual(before + 3); await expect(panel(page).locator('strong').first()).toHaveText('テストD'); await saveButton(page).click(); }
  await expect(page.locator('.scan-history-row')).toHaveCount(1);
  await stopCamera(page);
});

test('saving a card also suppresses its other product ids until the card leaves the view (SYNTHETIC)', async ({ page }) => {
  await installPokemonFlow(page); await page.goto('/'); await setProbe(page, { id: '900021' }); await startCamera(page);
  await expect(panel(page).locator('strong').first()).toHaveText('テストD');
  await saveButton(page).click(); await expect(page.locator('.scan-history-row')).toHaveCount(1);
  await setProbe(page, { id: '900022' }); const before = await frames(page); await expect.poll(() => frames(page)).toBeGreaterThanOrEqual(before + 4);
  await saveButton(page).click(); await expect(page.locator('.scan-history-row')).toHaveCount(1);
  await setProbe(page, { present: false }); await page.waitForTimeout(1000); await setProbe(page, { present: true });
  await expect.poll(async () => { await saveButton(page).click(); return page.locator('.scan-history-row').count(); }).toBe(2);
  await stopCamera(page);
});

test('detail sheet and history sheet carry the 晴れる屋2 link only (no Hareruya2 request) (SYNTHETIC)', async ({ page }) => {
  await installPokemonFlow(page); const hosts: string[] = []; page.on('request', r => hosts.push(new URL(r.url()).hostname));
  await page.goto('/'); await startCamera(page); await expect(panel(page)).toContainText('テストA');
  await openSheet(page);
  const candidateLink = panel(page).getByRole('link', { name: '晴れる屋2で探す ↗' });
  await expect(candidateLink).toHaveAttribute('target', '_blank'); await expect(candidateLink).toHaveAttribute('rel', 'noopener noreferrer');
  await saveButton(page).click(); await expect(page.locator('.scan-history-row')).toHaveCount(1);
  await closeRoute(page); await stopCamera(page);
  await openRoute(page, '履歴'); await page.locator('.scan-history-row').click();
  const sheet = page.getByRole('dialog', { name: 'カードの詳細', exact: true });
  await expect(sheet.locator('.candidate-name')).toHaveText('テストA'); await expect(sheet).toContainText('テスト拡張 TST 001/066');
  await expect(sheet.locator('.price')).toHaveText('参考価格 ￥150'); await expect(sheet).toContainText('国内販売・買取価格ではありません');
  const link = sheet.getByRole('link', { name: '晴れる屋2で探す ↗' });
  await expect(link).toHaveAttribute('target', '_blank'); await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  const href = new URL((await link.getAttribute('href'))!); expect(href.origin).toBe('https://www.hareruya2.com'); expect(href.searchParams.get('q')).toBe('テストA 001/66 TST');
  expect(hosts.filter(h => h.includes('hareruya'))).toEqual([]);
});

test('branding, sources, rights and privacy text are Pokémon-specific; no MTG, search or format UI remains (SYNTHETIC)', async ({ page }) => {
  await installPokemonFlow(page); await page.goto('/');
  await expect(page.locator('header h1')).toHaveText('ポケカスキャナー'); await expect(page).toHaveTitle('ポケカスキャナー');
  await openRoute(page, '設定'); const info = page.locator('.information'); await expect(info).toBeVisible();
  for (const name of ['TCGdex', 'TCGplayer（TCGCSV経由）', 'Frankfurter / ECB', 'CollectorVision']) await expect(info.getByRole('link', { name })).toBeVisible();
  await expect(info).toContainText('ポケモンカードの権利は株式会社ポケモン等の権利者に帰属します');
  await info.getByText('通信・プライバシーの詳細').click();
  for (const text of ['api.tcgdex.net', 'assets.tcgdex.net', '/prices/pokemon-japan-usd.json', 'Frankfurter', 'Hugging Face', '晴れる屋2']) await expect(info).toContainText(text);
  const sister = info.getByRole('link', { name: 'MTGカード版の Mana Peek もあります' });
  await expect(sister).toHaveAttribute('href', 'https://ikdsk.github.io/mtg-card-scanner/'); await expect(sister).toHaveAttribute('target', '_blank'); await expect(sister).toHaveAttribute('rel', 'noopener noreferrer');
  // The sister-app link intentionally names MTG; strip it so the leftover-MTG check still covers everything else.
  const text = ((await page.locator('body').innerText()) + (await page.locator('.utility-drawer').innerText())).replaceAll('MTGカード版の Mana Peek もあります', '').replaceAll('MTG版はこちら →', '');
  for (const banned of ['MTG', 'Scryfall', 'Oracle', 'Wizards', 'フォーマット', 'Foil']) expect(text).not.toContain(banned);
  await closeRoute(page);
  await expect(page.getByRole('searchbox')).toHaveCount(0); await expect(page.locator('.format-icon, .format-legality, .intro-logo')).toHaveCount(0);
  for (const name of ['名前検索']) await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
});

test('local image scan resolves a candidate without any camera (SYNTHETIC)', async ({ page }) => {
  await installPokemonFlow(page); await page.addInitScript(() => { Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: async () => { throw new DOMException('SYNTHETIC denied', 'NotAllowedError'); } } }); });
  await page.goto('/'); await setProbe(page, { score: .95, latency: 50 });
  await page.locator('#local-image').setInputFiles({ name: 'SYNTHETIC.png', mimeType: 'image/png', buffer: Buffer.from(await tinyPng(page), 'base64') });
  await expect(panel(page)).toContainText('テストA'); await expect(panel(page).locator('.price')).toHaveText('参考価格 ￥150');
  expect(await frames(page)).toBe(1);
  await expect(page.locator('.camera-status')).toContainText('画像の処理が完了');
});

test('camera permission denial leaves the local image scan usable', async ({ page }) => {
  await installPokemonFlow(page);
  await page.addInitScript(() => { Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: async () => { throw new DOMException('Denied', 'NotAllowedError'); } } }); });
  await page.goto('/'); await startCamera(page);
  await expect(page.getByText(/カメラの許可がありません/)).toBeVisible(); await expect(page.locator('.camera-status')).not.toContainText('名前検索');
  await openRoute(page, '画像'); await expect(page.locator('#local-image')).toBeAttached(); await expect(page.getByText('端末の画像でスキャン', { exact: true }).first()).toBeVisible();
});

test('reference image: failure keeps info and price; late FX keeps the same image node, focus and scroll (SYNTHETIC)', async ({ page }) => {
  await installPokemonFlow(page); let release!: () => void; const pending = new Promise<void>(r => { release = r; });
  await page.route('https://api.frankfurter.dev/**', async route => { await pending; await route.fulfill({ json: { base: 'USD', quote: 'JPY', rate: 150, date: '2026-10-02' } }); });
  await page.goto('/'); await startCamera(page); await expect(panel(page).locator('.usd')).toHaveText('$1.00 USD');
  await expect(panel(page).locator('img')).toBeVisible();
  await openSheet(page);
  const confirm = page.getByRole('button', { name: '履歴に保存', exact: true }); await confirm.focus();
  await page.evaluate(() => { (window as unknown as { img: Element | null }).img = document.querySelector('.tentative img'); });
  release(); await expect(panel(page).locator('.price')).toHaveText('参考価格 ￥150');
  await expect(confirm).toBeFocused(); expect(await page.evaluate(() => (window as unknown as { img: Element | null }).img === document.querySelector('.tentative img'))).toBe(true);
  await stopCamera(page);
  await page.route('https://assets.tcgdex.net/**', route => route.fulfill({ status: 404 }));
  await page.reload(); await startCamera(page);
  await expect(panel(page)).toContainText('参照画像を読み込めません'); await expect(panel(page).locator('.price')).toHaveText('参考価格 ￥150');
  await stopCamera(page);
});
