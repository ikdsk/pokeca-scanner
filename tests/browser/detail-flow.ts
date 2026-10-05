import { expect, type Page } from '@playwright/test';
import { startScan } from './pokemon-synthetic.js';
export const dialog = (page: Page) => page.getByRole('dialog', { name: 'カードの詳細', exact: true });
export const scanA = async (page: Page) => { await page.goto('/'); await startScan(page); await expect(page.locator('.tentative')).toContainText('テストA'); };
export const openDetail = async (page: Page) => { await page.getByRole('button', { name: '画像から詳細を見る', exact: true }).click(); await expect(dialog(page)).toBeVisible(); };
export const closeDetail = (page: Page) => dialog(page).getByRole('button', { name: '閉じる', exact: true }).click();
