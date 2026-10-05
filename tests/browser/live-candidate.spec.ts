import { openRoute, closeRoute } from './immersive-routes.js';
import { test, expect, type Page } from '@playwright/test';
import { installPokemonFlow } from './pokemon-synthetic.js';
// SYNTHETIC canvas camera, worker results and provider metadata. Not model accuracy evidence.
const installSyntheticFlow=(page:Page)=>installPokemonFlow(page);
test('one observation proposal, dismiss, rearm, keyboard confirm, camera stays live (SYNTHETIC)',async({page},info)=>{
 await installSyntheticFlow(page);await page.goto('/');await page.screenshot({path:info.outputPath('initial.png')});
 await openRoute(page,'設定'); await page.getByText('認識設定（デバッグ）',{exact:true}).click();await page.screenshot({path:info.outputPath('debugopen.png'),fullPage:true});await openRoute(page,'設定'); await page.getByText('認識設定（デバッグ）',{exact:true}).click();await page.evaluate(()=>scrollTo(0,0));
 await closeRoute(page); await page.getByRole('button',{name:'カメラでスキャン',exact:true}).click();
 await expect(page.locator('.tentative')).toContainText('テストA');await expect(page.locator('.tentative')).toContainText('類似度 0.623');
 await expect(page.locator('.scan-history-row')).toHaveCount(0);await expect(page.locator('.result')).toBeHidden();expect(await page.evaluate(()=>scrollY)).toBe(0);
 await page.screenshot({path:info.outputPath('tentative.png')});
 await page.getByRole('button',{name:'違う',exact:true}).click();await page.waitForTimeout(800);await expect(page.locator('.tentative')).toBeHidden();
 await page.evaluate(()=>{(window as any).continuousProbe.present=false;});await page.waitForTimeout(1000);await page.evaluate(()=>{(window as any).continuousProbe.present=true;});
 await expect(page.locator('.tentative')).toContainText('テストA');await page.getByRole('button',{name:'これです',exact:true}).focus();await page.keyboard.press('Enter');
 await expect(page.locator('.result h2')).toHaveText('テストA');await expect(page.locator('.scan-history-row')).toHaveCount(1);await expect(page.locator('.tentative')).toBeHidden();await expect(page.getByRole('button',{name:'停止',exact:true})).toBeEnabled();
 await page.screenshot({path:info.outputPath('confirmed.png')});await closeRoute(page); await page.getByRole('button',{name:'停止',exact:true}).click();
});
test('pointer identity and dismissed delayed metadata cannot select another card (SYNTHETIC)',async({page})=>{
 await installSyntheticFlow(page);await page.goto('/');await closeRoute(page); await page.getByRole('button',{name:'カメラでスキャン',exact:true}).click();await expect(page.locator('.tentative')).toContainText('テストA');
 const confirm=page.getByRole('button',{name:'これです',exact:true});await confirm.dispatchEvent('pointerdown');
 await page.evaluate(()=>{const s=(window as any).continuousProbe;s.id='900002';});await expect(page.locator('.tentative')).toContainText('テストB');
 await confirm.dispatchEvent('click');await expect(page.locator('.scan-history-row')).toHaveCount(0);
 await page.getByRole('button',{name:'違う',exact:true}).click();await page.waitForTimeout(600);await expect(page.locator('.tentative')).toBeHidden();
 await closeRoute(page); await page.getByRole('button',{name:'停止',exact:true}).click();
});
test('dismiss while metadata pending never resurrects or fabricates result (SYNTHETIC)',async({page})=>{
 await installSyntheticFlow(page);let release!:()=>void;const pending=new Promise<void>(r=>release=r);
 await page.route('https://api.tcgdex.net/v2/ja/cards/TST-001',async route=>{await pending;await route.fallback();});
 await page.goto('/');await closeRoute(page); await page.getByRole('button',{name:'カメラでスキャン',exact:true}).click();await expect(page.locator('.tentative')).toContainText('カード情報を確認中…');
 await closeRoute(page); await page.getByRole('button',{name:'これです',exact:true}).click();await expect(page.locator('.scan-history-row')).toHaveCount(0);await expect(page.locator('.tentative')).toContainText('取得完了後');
 await page.getByRole('button',{name:'違う',exact:true}).click();release();await page.waitForTimeout(600);await expect(page.locator('.tentative')).toBeHidden();await expect(page.locator('.scan-history-row')).toHaveCount(0);
 await closeRoute(page); await page.getByRole('button',{name:'停止',exact:true}).click();
});
test('settings invalid/reset and tentative threshold apply with preserved history/manual selection (SYNTHETIC)',async({page})=>{
 await installSyntheticFlow(page);await page.goto('/');await openRoute(page,'設定'); await page.getByText('認識設定（デバッグ）',{exact:true}).click();
 const threshold=page.getByLabel('提案の類似度',{exact:true});await openRoute(page,'設定');await threshold.fill('.7');await threshold.dispatchEvent('change');
 await closeRoute(page); await page.getByRole('button',{name:'カメラでスキャン',exact:true}).click();await page.waitForTimeout(700);await expect(page.locator('.tentative')).toBeHidden();
 await openRoute(page,'設定');await threshold.fill('1.1');await threshold.dispatchEvent('change');await expect(threshold).toHaveValue('0.7');
 await page.getByRole('button',{name:'認識設定を初期値に戻す'}).click();await expect(threshold).toHaveValue('0.5');await expect(page.locator('.tentative')).toContainText('テストA');
 await closeRoute(page); await page.getByRole('button',{name:'これです',exact:true}).click();await openRoute(page,'確定カード'); await expect(page.locator('.result h2')).toHaveText('テストA');
 await openRoute(page,'設定');await page.getByLabel('推論完了後の待ち時間 (ms)',{exact:true}).fill('250');await page.getByLabel('推論完了後の待ち時間 (ms)',{exact:true}).dispatchEvent('change');
 await openRoute(page,'確定カード');await expect(page.locator('.result h2')).toHaveText('テストA');await expect(page.locator('.scan-history-row')).toHaveCount(1);await expect(page.getByRole('button',{name:'停止',exact:true})).toBeEnabled();
 await closeRoute(page); await page.getByRole('button',{name:'停止',exact:true}).click();
});
test('all obsolete automatic controls are removed (SYNTHETIC)',async({page})=>{
 await installSyntheticFlow(page);await page.goto('/');await openRoute(page,'設定'); await page.getByText('認識設定（デバッグ）',{exact:true}).click();
 for(const name of ['自動受付の類似度','異なるOracleとの最小 margin','自動受付の同じ印刷版の連続観測数'])await expect(page.getByLabel(name,{exact:true})).toHaveCount(0);
 await expect(page.locator('.recognition-settings input')).toHaveCount(5);
});
test('delay and both absence controls change capture/rearm; overlay expiry changes painting (SYNTHETIC)',async({page})=>{
 await installSyntheticFlow(page);await page.goto('/');await openRoute(page,'設定'); await page.getByText('認識設定（デバッグ）',{exact:true}).click();
 const set=async(name:string,value:string)=>{await openRoute(page,'設定');const input=page.getByLabel(name,{exact:true});await input.fill(value);await input.dispatchEvent('change');};
 await set('推論完了後の待ち時間 (ms)','700');await set('同じカードの再受付に必要な不在観測数','2');await set('不在の最小継続時間 (ms)','0');await set('四隅の表示期限 (ms)','100');
 await closeRoute(page); await page.getByRole('button',{name:'カメラでスキャン',exact:true}).click();await expect(page.locator('.tentative')).toContainText('テストA');await page.getByRole('button',{name:'違う',exact:true}).click();
 const before=await page.evaluate(()=>(window as any).continuousProbe.frames);await page.waitForTimeout(400);expect(await page.evaluate(()=>(window as any).continuousProbe.frames)).toBe(before);await expect(page.locator('.detection-overlay')).toHaveAttribute('data-detected','false');
 await page.evaluate(()=>{(window as any).continuousProbe.present=false;});await expect.poll(()=>page.evaluate(()=>(window as any).continuousProbe.frames)).toBeGreaterThanOrEqual(before+2);await page.evaluate(()=>{(window as any).continuousProbe.present=true;});await expect(page.locator('.tentative')).toContainText('テストA');
 await closeRoute(page); await page.getByRole('button',{name:'停止',exact:true}).click();
});
test('320px proposal stays in immersive viewport and network is coalesced (SYNTHETIC)',async({page},info)=>{
 await page.setViewportSize({width:320,height:740});await installSyntheticFlow(page);let requests=0;let providerRequests=0;page.on('request',r=>{if(r.url().endsWith('/cards/TST-001'))requests++;if(r.url().includes('api.tcgdex.net')||r.url().includes('api.frankfurter.dev'))providerRequests++;});
 await page.goto('/');await closeRoute(page); await page.getByRole('button',{name:'カメラでスキャン',exact:true}).click();await expect(page.locator('.tentative')).toContainText('テストA');await expect.poll(()=>page.evaluate(()=>(window as any).continuousProbe.frames)).toBeGreaterThanOrEqual(6);expect(requests).toBe(1);expect(providerRequests).toBe(2);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(320);await page.screenshot({path:info.outputPath('tentative-320.png')});await closeRoute(page); await page.getByRole('button',{name:'停止',exact:true}).click();
});
test('settings discard in-flight old evidence without restarting camera (SYNTHETIC)',async({page})=>{
 await installSyntheticFlow(page);await page.goto('/');await openRoute(page,'設定'); await page.getByText('認識設定（デバッグ）',{exact:true}).click();await page.evaluate(()=>{(window as any).continuousProbe.latency=1000;});
 await closeRoute(page); await page.getByRole('button',{name:'カメラでスキャン',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).continuousProbe.frames)).toBe(1);
 await page.evaluate(()=>{Object.assign(window,{oldStream:document.querySelector('video')!.srcObject});Object.assign((window as any).continuousProbe,{score:.4});});
 await openRoute(page,'設定');const input=page.getByLabel('推論完了後の待ち時間 (ms)',{exact:true});await input.fill('200');await input.dispatchEvent('change');await page.waitForTimeout(1100);await expect(page.locator('.tentative')).toBeHidden();await expect.poll(()=>page.evaluate(()=>(window as any).continuousProbe.frames)).toBeGreaterThanOrEqual(2);
 expect(await page.evaluate(()=>document.querySelector('video')!.srcObject===(window as any).oldStream)).toBe(true);await closeRoute(page); await page.getByRole('button',{name:'停止',exact:true}).click();
});
test('file proposal confirms exactly one observation with no automatic repeat (SYNTHETIC)',async({page})=>{
 await installSyntheticFlow(page);await page.goto('/');await page.evaluate(()=>{Object.assign((window as any).continuousProbe,{score:.95,margin:.1,latency:600});});
 const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=2;return c.toDataURL().split(',')[1]!;});
 await page.locator('#local-image').setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
 await expect(page.locator('.tentative')).toContainText('テストA');await expect(page.locator('.scan-history-row')).toHaveCount(0);await closeRoute(page); await page.getByRole('button',{name:'これです',exact:true}).click();await openRoute(page,'確定カード'); await expect(page.locator('.result h2')).toHaveText('テストA');
 expect(await page.evaluate(()=>(window as any).continuousProbe.frames)).toBe(1);await page.waitForTimeout(800);await expect(page.locator('.result h2')).toHaveText('テストA');await expect(page.locator('.scan-history-row')).toHaveCount(1);
});
test('absence elapsed control alone delays rearm and reset restores every real value (SYNTHETIC)',async({page})=>{
 await installSyntheticFlow(page);await page.goto('/');await openRoute(page,'設定'); await page.getByText('認識設定（デバッグ）',{exact:true}).click();
 const set=async(name:string,value:string)=>{await openRoute(page,'設定');const input=page.getByLabel(name,{exact:true});await input.fill(value);await input.dispatchEvent('change');};
 await set('同じカードの再受付に必要な不在観測数','2');await set('不在の最小継続時間 (ms)','2000');
 await closeRoute(page); await page.getByRole('button',{name:'カメラでスキャン',exact:true}).click();await expect(page.locator('.tentative')).toContainText('テストA');await page.getByRole('button',{name:'違う',exact:true}).click();
 await page.evaluate(()=>{(window as any).continuousProbe.present=false;});await page.waitForTimeout(650);await page.evaluate(()=>{(window as any).continuousProbe.present=true;});await page.waitForTimeout(300);await expect(page.locator('.tentative')).toBeHidden();
 await set('不在の最小継続時間 (ms)','0');await page.evaluate(()=>{(window as any).continuousProbe.present=false;});await page.waitForTimeout(650);await page.evaluate(()=>{(window as any).continuousProbe.present=true;});await expect(page.locator('.tentative')).toContainText('テストA');
 await page.getByRole('button',{name:'認識設定を初期値に戻す'}).click();
 for(const [name,value] of [['提案の類似度','0.5'],['推論完了後の待ち時間 (ms)','180'],['同じカードの再受付に必要な不在観測数','3'],['不在の最小継続時間 (ms)','600'],['四隅の表示期限 (ms)','1500']])await expect(page.getByLabel(name!,{exact:true})).toHaveValue(value!);
 await closeRoute(page); await page.getByRole('button',{name:'停止',exact:true}).click();
});
test('mobile proposal confirmation is visible without scrolling and panel text has contrast (SYNTHETIC)',async({page})=>{
 await page.setViewportSize({width:390,height:844});await installSyntheticFlow(page);await page.goto('/');await closeRoute(page); await page.getByRole('button',{name:'カメラでスキャン',exact:true}).click();await expect(page.locator('.tentative')).toContainText('テストA');
 await expect(page.getByRole('button',{name:'これです',exact:true})).toBeInViewport();expect(await page.evaluate(()=>scrollY)).toBe(0);
 const contrast=await page.locator('.tentative').evaluate(node=>{
  const rgb=(value:string)=>value.match(/[\d.]+/g)!.slice(0,3).map(Number);
  const lum=(values:number[])=>values.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i]!,0);
  const style=getComputedStyle(node);const fg=lum(rgb(style.color));let parent:Element|null=node;let bg='';while(parent){bg=getComputedStyle(parent).backgroundColor;if(bg!=='rgba(0, 0, 0, 0)')break;parent=parent.parentElement;}const background=lum(rgb(bg));return (Math.max(fg,background)+.05)/(Math.min(fg,background)+.05);
 });expect(contrast).toBeGreaterThanOrEqual(4.5);await closeRoute(page); await page.getByRole('button',{name:'停止',exact:true}).click();
});

for (const key of ['Space', 'Enter'] as const) test(`held ${key} autorepeat cannot confirm replacement B (SYNTHETIC native keyboard)`, async ({page}, info) => {
 await installSyntheticFlow(page);await page.goto('/');await closeRoute(page); await page.getByRole('button',{name:'カメラでスキャン',exact:true}).click();
 await expect(page.locator('.tentative')).toContainText('テストA');
 // Enter clicks on keydown. Keep A metadata pending so that its first activation
 // cannot accept A; replacement must still not let the held gesture accept B.
 if(key==='Enter') {
  await closeRoute(page); await page.getByRole('button',{name:'停止',exact:true}).click();await page.reload();
  await page.route('https://api.tcgdex.net/v2/ja/cards/TST-001',async()=>{await new Promise(()=>{});});
  await closeRoute(page); await page.getByRole('button',{name:'カメラでスキャン',exact:true}).click();await expect(page.locator('.tentative')).toContainText('カード情報を確認中…');
 }
 await page.evaluate(()=>{Object.assign(window,{activationEvents:[]});document.addEventListener('keydown',event=>{(window as any).activationEvents.push({key:event.key,repeat:event.repeat});});});
 const confirm=page.getByRole('button',{name:'これです',exact:true});await confirm.focus();await page.keyboard.down(key);
 await page.evaluate(()=>{Object.assign((window as any).continuousProbe,{id:'900002'});});await expect(page.locator('.tentative')).toContainText('テストB');
 await page.keyboard.down(key);await page.keyboard.up(key);
 await info.attach('native-key-events',{body:JSON.stringify(await page.evaluate(()=>(window as any).activationEvents)),contentType:'application/json'});
 expect(await page.evaluate(()=>(window as any).activationEvents.map((event:any)=>event.repeat))).toEqual([false,true]);
 await expect(page.locator('.tentative')).toContainText('テストB');await expect(page.locator('.scan-history-row')).toHaveCount(0);await expect(page.locator('.result')).toBeHidden();
 // A new gesture after release can confirm the current verified candidate.
 await page.keyboard.press(key);await expect(page.locator('.result h2')).toHaveText('テストB');await expect(page.locator('.scan-history-row')).toHaveCount(1);
 await closeRoute(page); await page.getByRole('button',{name:'停止',exact:true}).click();
});

for(const cancel of ['blur','window blur','pointercancel'] as const) test(`canceled Space gesture via ${cancel} cannot activate replacement (SYNTHETIC)`,async({page})=>{
 await installSyntheticFlow(page);await page.goto('/');await closeRoute(page); await page.getByRole('button',{name:'カメラでスキャン',exact:true}).click();await expect(page.locator('.tentative')).toContainText('テストA');
 const confirm=page.getByRole('button',{name:'これです',exact:true});await confirm.focus();await page.keyboard.down('Space');
 if(cancel==='blur'){await page.getByRole('button',{name:'違う',exact:true}).focus();await confirm.focus();}
 else if(cancel==='window blur')await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
 else await confirm.dispatchEvent('pointercancel');
 await page.evaluate(()=>Object.assign((window as any).continuousProbe,{id:'900002'}));await expect(page.locator('.tentative')).toContainText('テストB');
 await page.keyboard.down('Space');await page.keyboard.up('Space');await expect(page.locator('.scan-history-row')).toHaveCount(0);await expect(page.locator('.result')).toBeHidden();
 await page.keyboard.press('Space');await expect(page.locator('.result h2')).toHaveText('テストB');await expect(page.locator('.scan-history-row')).toHaveCount(1);await closeRoute(page); await page.getByRole('button',{name:'停止',exact:true}).click();
});

test('high score repeated observations never confirm; obsolete auto controls absent (SYNTHETIC)',async({page})=>{
 await installSyntheticFlow(page);await page.goto('/');await page.evaluate(()=>Object.assign((window as any).continuousProbe,{score:.99,margin:.9}));
 await closeRoute(page); await page.getByRole('button',{name:'カメラでスキャン',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).continuousProbe.frames)).toBeGreaterThanOrEqual(5);
 await expect(page.locator('.tentative')).toContainText('テストA');await expect(page.locator('.scan-history-row')).toHaveCount(0);await expect(page.locator('.result')).toBeHidden();
 await expect(page.getByLabel('自動受付の類似度',{exact:true})).toHaveCount(0);
 await closeRoute(page); await page.getByRole('button',{name:'これです',exact:true}).click();await expect(page.locator('.scan-history-row')).toHaveCount(1);await expect(page.getByRole('button',{name:'停止',exact:true})).toBeEnabled();
 await closeRoute(page); await page.getByRole('button',{name:'停止',exact:true}).click();
});

