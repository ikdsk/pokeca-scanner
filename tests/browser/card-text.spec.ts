import { test, expect } from '@playwright/test';
import { installPokemonFlow, setProbe } from './pokemon-synthetic.js';
import { dialog, scanA, openDetail, closeDetail } from './detail-flow.js';
// SYNTHETIC routed TCGdex JSON (field shapes from real ja API, wording invented). Proves rendering only,
// not TCGdex coverage, real recognition or phone behavior.
const top = (...rows: [string, number][]) => rows.map(([id, score]) => ({ id, score }));
const section = (page: import('@playwright/test').Page) => dialog(page).locator('.card-text');

test('detail sheet shows Pokémon card text in Japanese; the compact dock does not (SYNTHETIC)', async ({ page }) => {
  await installPokemonFlow(page); await scanA(page);
  await expect(page.locator('.card-text')).toBeHidden();
  await openDetail(page);
  await expect(section(page).getByRole('heading', { name: 'カードテキスト', exact: true })).toBeVisible();
  await expect(section(page).locator('.card-text-header')).toHaveText('1進化 · HP70 · 炎');
  await expect(section(page)).toContainText('進化元：テスト進化前');
  const ability = section(page).locator('.card-text-ability'); await expect(ability).toContainText('特性'); await expect(ability).toContainText('テスト特性');
  await expect(ability.locator('.card-text-effect')).toHaveCSS('white-space', 'pre-line');
  await expect(ability.locator('.card-text-effect')).toContainText('二行目の効果文。');
  const attacks = section(page).locator('.card-text-attack'); await expect(attacks).toHaveCount(2);
  await expect(attacks.nth(0)).toContainText('テストワザ'); await expect(attacks.nth(0)).toContainText('無色 無色'); await expect(attacks.nth(0)).toContainText('40+'); await expect(attacks.nth(0)).toContainText('ワザの効果文。');
  await expect(attacks.nth(1)).toContainText('ダメージだけ'); await expect(attacks.nth(1)).toContainText('炎'); await expect(attacks.nth(1)).toContainText('30');
  await expect(section(page).locator('.card-text-stats')).toHaveText('弱点 水×2抵抗力 闘-30にげる 0');
  await expect(section(page).locator('.card-text-description')).toHaveText('合成の図鑑文です。');
  await expect(section(page).locator('.card-text-illustrator')).toHaveText('イラスト：合成イラスト太郎');
  expect(await dialog(page).evaluate(d => !!(d.querySelector('.price')!.compareDocumentPosition(d.querySelector('.card-text')!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  await closeDetail(page); await expect(page.locator('.card-text')).toBeHidden();
});

test('Trainer text shows type label, effect with newlines and illustrator; picked alternative and history sheet too (SYNTHETIC)', async ({ page }) => {
  await installPokemonFlow(page); await page.goto('/'); await setProbe(page, { top: top(['900001', .9], ['900002', .8]), score: .9 });
  await page.getByRole('button', { name: 'スキャン開始', exact: true }).click(); await expect(page.locator('.tentative')).toContainText('テストA');
  await page.getByRole('button', { name: '他の候補', exact: true }).click(); await page.getByRole('dialog', { name: '他の候補', exact: true }).locator('.alternative-item').filter({ hasText: 'テストB' }).click();
  await expect(page.locator('.tentative')).toContainText('テストB');
  await page.locator('.tentative').getByRole('button', { name: '履歴に保存', exact: true }).click();
  await openDetail(page);
  await expect(section(page).locator('.card-text-header')).toHaveText('サポート');
  await expect(section(page).locator('.card-text-effect')).toHaveText('トレーナーの効果文。\n山札を切る。');
  await expect(section(page).locator('.card-text-effect')).toHaveCSS('white-space', 'pre-line');
  await expect(section(page).locator('.card-text-illustrator')).toHaveText('イラスト：合成トレーナー絵');
  await expect(section(page).locator('.card-text-attack')).toHaveCount(0);
  await closeDetail(page);
  await page.getByRole('button', { name: '停止', exact: true }).click();
  await page.getByRole('button', { name: '履歴', exact: true }).click(); await page.locator('.scan-history-row').first().click();
  await expect(dialog(page)).toBeVisible(); await expect(section(page).locator('.card-text-header')).toHaveText('サポート');
  await expect(section(page).locator('.card-text-illustrator')).toHaveText('イラスト：合成トレーナー絵');
});

test('a card without TCGdex text says so and invents nothing (SYNTHETIC)', async ({ page }) => {
  await installPokemonFlow(page); await page.goto('/'); await setProbe(page, { id: '900004', score: .9 });
  await page.getByRole('button', { name: 'スキャン開始', exact: true }).click(); await expect(page.locator('.tentative')).toContainText('テストE');
  await openDetail(page);
  await expect(section(page)).toContainText('カードテキストは未収録です');
  await expect(section(page).locator('.card-text-attack, .card-text-ability, .card-text-header, .card-text-illustrator')).toHaveCount(0);
});
