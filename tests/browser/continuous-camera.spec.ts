import { openRoute, closeRoute } from './immersive-routes.js';
import { test, expect, type Page } from '@playwright/test';
import { installPokemonFlow } from './pokemon-synthetic.js';
// SYNTHETIC canvas camera, worker results and provider metadata. Not model accuracy evidence.
async function installSyntheticFlow(page: Page) {
 await installPokemonFlow(page,{fx:'fail'}); await page.addInitScript(()=>{Object.assign((window as any).continuousProbe,{score:.95,margin:.1});});
}
test('continuous camera shows A→B, suppresses stationary/saved jitter, rearms removal and clears overlay',async({page},info)=>{
 await installSyntheticFlow(page);
 await page.goto('/');await page.screenshot({path:info.outputPath('initial.png')});
 await page.getByRole('button',{name:'スキャン開始',exact:true}).click();
 await expect(page.locator('.detection-overlay')).toHaveAttribute('data-detected','true');
 await page.screenshot({path:info.outputPath('scanning.png')});
 const save=()=>page.locator('.tentative').getByRole('button',{name:/履歴に保存|保存しました/});
 await expect(page.locator('.tentative')).toContainText('テストA');await expect(page.locator('.scan-history-row')).toHaveCount(0);await save().click();
 await expect(page.locator('.scan-history-row')).toHaveCount(1);
 await expect(page.getByRole('button',{name:'停止',exact:true})).toBeEnabled();
 expect(await page.evaluate(()=>scrollY)).toBe(0);
 await page.screenshot({path:info.outputPath('accepted.png')});
 await page.waitForTimeout(800);await expect(page.locator('.scan-history-row')).toHaveCount(1);await expect(page.locator('.tentative')).toContainText('テストA');
 await page.evaluate(()=>{const s=(window as any).continuousProbe;s.id='900002';});
 await expect(page.locator('.tentative')).toContainText('テストB');await expect(page.locator('.scan-history-row')).toHaveCount(1);await save().click();
 await expect(page.locator('.scan-history-row')).toHaveCount(2);
 await page.evaluate(()=>{(window as any).continuousProbe.present=false;});
 await expect(page.locator('.detection-overlay')).toHaveAttribute('data-detected','false');await page.waitForTimeout(1000);
 await page.evaluate(()=>{(window as any).continuousProbe.present=true;});await expect.poll(async()=>{await save().click();return page.locator('.scan-history-row').count();}).toBe(3);
 await page.evaluate(()=>{(window as any).continuousProbe.hold=true;});await expect(page.locator('.detection-overlay')).toHaveAttribute('data-detected','false',{timeout:4000});
 await page.getByRole('button',{name:'停止',exact:true}).click();await expect(page.locator('video')).toHaveJSProperty('srcObject',null);
 await page.evaluate(()=>{(window as any).continuousProbe.hold=false; window.dispatchEvent(new Event('pagehide'));});
 await page.getByRole('button',{name:'スキャン開始',exact:true}).click();
 await expect(page.locator('.detection-overlay')).toHaveAttribute('data-detected','true');
 await page.evaluate(()=>{const tracks=(document.querySelector('video')!.srcObject as MediaStream).getTracks();Object.assign(window,{pagehideTracks:tracks});window.dispatchEvent(new Event('pagehide'));});
 expect(await page.evaluate(()=>(window as any).pagehideTracks.every((t:MediaStreamTrack)=>t.readyState==='ended'))).toBe(true);
 await expect(page.locator('.detection-overlay')).toHaveAttribute('data-detected','false');
});

test('a slow verified A is replaced by B once B resolves; late A metadata cannot resurrect A (SYNTHETIC)',async({page})=>{
 await installSyntheticFlow(page);
 let release!:()=>void;const pending=new Promise<void>(resolve=>{release=resolve;});
 await page.route('https://api.tcgdex.net/v2/ja/cards/TST-001',async route=>{await pending;await route.fallback().catch(()=>{});});
 await page.goto('/');await page.getByRole('button',{name:'スキャン開始',exact:true}).click();
 await expect(page.locator('.empty-candidate')).toContainText('カード情報を確認中…');await expect(page.locator('.tentative')).toBeHidden();
 await page.evaluate(()=>{const s=(window as any).continuousProbe;s.id='900002';});
 await expect(page.locator('.tentative')).toContainText('テストB');await expect(page.locator('.scan-history-row')).toHaveCount(0);
 await page.locator('.tentative').getByRole('button',{name:'履歴に保存',exact:true}).click();await expect(page.locator('.scan-history-row')).toHaveCount(1);
 release();await page.waitForTimeout(500);await expect(page.locator('.scan-history-row')).toHaveCount(1);
 await expect(page.locator('.tentative')).toContainText('テストB');await expect(page.getByRole('button',{name:'停止',exact:true})).toBeEnabled();
});
