import { test, expect } from '@playwright/test';
import { installPokemonFlow, startScan, setProbe } from './pokemon-synthetic.js';
// SYNTHETIC worker: proves only that the app asks for recognition data at startup (camera-first,
// not camera-gated). It says nothing about real model download time or phone performance.
const probe = (page: import('@playwright/test').Page) => page.evaluate(() => { const s = (window as unknown as { continuousProbe: { inits: number; frames: number } }).continuousProbe; return { inits: s.inits, frames: s.frames }; });

test('recognition data is requested at startup, before the camera is started (SYNTHETIC)', async ({ page }) => {
  await installPokemonFlow(page); await page.goto('/');
  await expect.poll(async () => (await probe(page)).inits).toBe(1);
  await expect(page.locator('.camera-info')).toContainText('端末内認識の準備完了');
  expect((await probe(page)).frames).toBe(0);
});

test('starting the camera reuses the preloaded recognizer and scans immediately (SYNTHETIC)', async ({ page }) => {
  await installPokemonFlow(page); await page.goto('/');
  await expect(page.locator('.camera-info')).toContainText('端末内認識の準備完了');
  await startScan(page);
  await expect(page.locator('.tentative')).toContainText('テストA');
  expect((await probe(page)).inits).toBe(1);
  await page.getByRole('button', { name: '停止', exact: true }).click();
  await startScan(page); await setProbe(page, { id: '900002' }); await expect(page.locator('.tentative')).toContainText('テストB');
  expect((await probe(page)).inits).toBe(1);
});

test('preload does not depend on camera permission (SYNTHETIC)', async ({ page }) => {
  await installPokemonFlow(page);
  await page.addInitScript(() => { Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: async () => { throw new DOMException('SYNTHETIC denied', 'NotAllowedError'); } } }); });
  await page.goto('/'); await startScan(page);
  await expect(page.getByText(/カメラの許可がありません/)).toBeVisible();
  await expect(page.locator('.camera-info')).toContainText('端末内認識の準備完了'); expect((await probe(page)).inits).toBe(1);
});
