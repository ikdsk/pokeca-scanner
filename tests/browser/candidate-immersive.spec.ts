import { openRoute, closeRoute } from './immersive-routes.js';
import { test, expect, type Page } from '@playwright/test';
import { installPokemonFlow } from './pokemon-synthetic.js';
const evidence=process.env.EVIDENCE_DIR ?? 'test-results/evidence/candidate-immersive';
// SYNTHETIC portrait camera pixels, worker, reference image and providers (pokemon-synthetic.ts).
async function setup(page:Page){
 await installPokemonFlow(page,{portrait:true});await page.addInitScript(()=>{Object.assign((window as any).continuousProbe,{score:.99,margin:.9});});
 await page.goto('/');await page.getByRole('button',{name:'カメラでスキャン',exact:true}).click();await expect(page.locator('.tentative')).toContainText('テストA');await expect(page.locator('.tentative .price')).toHaveText('概算 ￥150');
}
async function fitted(page:Page){
 await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
 await expect.poll(()=>page.locator('#app').evaluate(n=>Math.abs(n.getBoundingClientRect().height-(visualViewport?.height??innerHeight)))).toBeLessThan(1);
 expect(await page.evaluate(()=>({height:document.documentElement.scrollHeight,client:document.documentElement.clientHeight,width:document.documentElement.scrollWidth,w:document.documentElement.clientWidth,y:scrollY}))).toEqual(expect.objectContaining({y:0}));
 const dimensions=await page.evaluate(()=>({height:document.documentElement.scrollHeight,client:document.documentElement.clientHeight,width:document.documentElement.scrollWidth,w:document.documentElement.clientWidth}));expect(dimensions.height).toBeLessThanOrEqual(dimensions.client+1);expect(dimensions.width).toBeLessThanOrEqual(dimensions.w);
 const camera=(await page.locator('.viewport').boundingBox())!;const panel=(await page.locator('.candidate-dock').boundingBox())!;expect(Math.abs(camera.y+camera.height-panel.y)).toBeLessThanOrEqual(1);expect(camera.height).toBeGreaterThan(0);
 await expect(page.getByRole('button',{name:'これです',exact:true})).toBeInViewport();await expect(page.locator('.tentative strong').first()).toBeInViewport();
 for(const selector of ['.candidate-summary strong:first-of-type','.candidate-summary .usd','.candidate-summary .price','.candidate-summary>div>.small','.action-panel button','.viewport header button']) {
  const clipped=await page.locator(selector).evaluateAll(nodes=>nodes.flatMap(node=>{const rect=node.getBoundingClientRect();if(!rect.height)return [`${node.className}: hidden`];let parent=node.parentElement;while(parent){const style=getComputedStyle(parent);if(['auto','hidden','scroll'].includes(style.overflowY)){const bounds=parent.getBoundingClientRect();if(rect.top<bounds.top-1||rect.bottom>bounds.bottom+1)return [`${node.className} ${rect.top}..${rect.bottom} outside ${parent.className} ${bounds.top}..${bounds.bottom}`];}parent=parent.parentElement;}return [];}));expect(clipped,`essential ${selector} is not clipped`).toEqual([]);
 }
 const overlap=await page.locator('.viewport').evaluate(node=>{const rects=[...node.querySelectorAll('header button,.action-panel button')].map(n=>n.getBoundingClientRect());return rects.some((a,i)=>rects.slice(i+1).some(b=>Math.min(a.right,b.right)>Math.max(a.left,b.left)+1&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top)+1));});expect(overlap,'camera action targets do not overlap').toBe(false);
 const canvas=(await page.locator('.detection-overlay').boundingBox())!;expect(canvas).toEqual(camera);await expect(page.locator('.detection-overlay')).toHaveAttribute('data-detected','true');
 // Canvas pixel evidence uses the exact portrait contain rectangle after each resize.
 await expect.poll(()=>page.locator('.detection-overlay').evaluate(node=>{const c=node as HTMLCanvasElement,v=document.querySelector('video')!;const r=c.getBoundingClientRect(),scale=Math.min(r.width/v.videoWidth,r.height/v.videoHeight),x=(r.width-v.videoWidth*scale)/2+v.videoWidth*scale*.1,y=(r.height-v.videoHeight*scale)/2+v.videoHeight*scale*.1,dpr=c.width/r.width;const ctx=c.getContext('2d')!;for(let dx=-4;dx<=4;dx++)for(let dy=-4;dy<=4;dy++){const p=ctx.getImageData(Math.round(x*dpr)+dx,Math.round(y*dpr)+dy,1,1).data;if(p[1]!>p[0]!+40&&p[1]!>p[2]!+20&&p[3]!>0)return true;}return false;})).toBe(true);
}
test('portrait-video320 compact immersive viewport fits and contains delivered frame (SYNTHETIC)',async({page},info)=>{
 await page.setViewportSize({width:320,height:740});await setup(page);await fitted(page);expect(await page.locator('video').evaluate(v=>[(v as HTMLVideoElement).videoWidth,(v as HTMLVideoElement).videoHeight])).toEqual([720,1280]);expect(await page.evaluate(()=>(window as any).immersiveProbe.sizes[0])).toEqual([576,1024]);await page.screenshot({path:`${evidence}/${info.project.name}-portrait320-compact.png`});await page.getByRole('button',{name:'候補パネルを拡大'}).click();await fitted(page);await page.screenshot({path:`${evidence}/${info.project.name}-portrait320-expanded.png`});await page.getByRole('button',{name:'停止',exact:true}).click();
});
test('portrait-video390 up/down reveal rich details with fixed actions and internal-only scrolling (SYNTHETIC)',async({page},info)=>{
 await page.setViewportSize({width:390,height:844});await setup(page);await fitted(page);const initial=(await page.locator('.viewport').boundingBox())!;
 const up=page.getByRole('button',{name:'候補パネルを拡大'}),down=page.getByRole('button',{name:'候補パネルを縮小'});await expect(down).toBeDisabled();await expect(up).toBeEnabled();await expect(page.locator('.candidate-details')).toBeHidden();await page.screenshot({path:`${evidence}/${info.project.name}-portrait390-compact.png`});
 await up.focus();await page.keyboard.press('Enter');await expect(up).toBeDisabled();await expect(down).toBeEnabled();await fitted(page);expect((await page.locator('.viewport').boundingBox())!.height).toBeLessThan(initial.height-50);
 await expect(page.locator('.candidate-details')).toContainText('価格更新');await expect(page.locator('.candidate-details .hare2-link')).toBeVisible();await expect(page.locator('.candidate-details')).toContainText('TCGplayer（TCGCSV経由）');await expect(page.locator('.candidate-details')).toContainText('Frankfurter / ECB');
 await page.screenshot({path:`${evidence}/${info.project.name}-portrait390-expanded.png`});const bounds=await page.locator('.viewport').boundingBox();await page.locator('.candidate-details').evaluate(n=>n.scrollTop=n.scrollHeight);expect(await page.locator('.candidate-details').evaluate(n=>getComputedStyle(n).overflowY)).toBe('auto');expect(await page.locator('.candidate-details').evaluate(n=>n.scrollTop)).toBeGreaterThanOrEqual(0);expect(await page.evaluate(()=>scrollY)).toBe(0);expect(await page.locator('.viewport').boundingBox()).toEqual(bounds);await expect(page.getByRole('button',{name:'これです',exact:true})).toBeInViewport();await down.focus();await page.keyboard.press('Space');await fitted(page);expect((await page.locator('.viewport').boundingBox())!.height).toBe(initial.height);await page.getByRole('button',{name:'停止',exact:true}).click();
});
for(const size of [{width:440,height:780},{width:320,height:600},{width:390,height:540},{width:1280,height:900}])test(`portrait-video${size.width}x${size.height} compact/expanded resized viewport (SYNTHETIC)`,async({page},info)=>{
 await page.setViewportSize(size);await setup(page);await fitted(page);await page.screenshot({path:`${evidence}/${info.project.name}-${size.width}x${size.height}-compact.png`});await page.getByRole('button',{name:'候補パネルを拡大'}).click();await fitted(page);await expect(page.locator('.candidate-details')).toBeVisible();await page.screenshot({path:`${evidence}/${info.project.name}-${size.width}x${size.height}-expanded.png`});
 await page.setViewportSize({width:size.height,height:size.width});await fitted(page);await page.setViewportSize({width:size.width,height:360});await fitted(page);const expanded=(await page.locator('.candidate-dock').boundingBox())!.height;await page.getByRole('button',{name:'候補パネルを縮小'}).click();await fitted(page);expect((await page.locator('.candidate-dock').boundingBox())!.height).toBeLessThan(expanded);await page.getByRole('button',{name:'停止',exact:true}).click();
});
test('explicit routes preserve live candidate, confirmed selection and history-stop policy (SYNTHETIC)',async({page},info)=>{
 await page.setViewportSize({width:390,height:844});await setup(page);
 await page.getByRole('button',{name:'設定',exact:true}).click();await expect(page.locator('.recognition-settings')).toBeVisible();await page.getByText('認識設定（デバッグ）',{exact:true}).click();await expect(page.getByLabel('提案の類似度',{exact:true})).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'設定',exact:true})).toBeFocused();await fitted(page);
 await page.getByRole('button',{name:'これです',exact:true}).click();await expect(page.locator('.scan-history-row')).toHaveCount(1);await expect(page.locator('.utility-drawer')).toBeHidden();await expect(page.getByRole('button',{name:'停止',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'確定カード',exact:true}).click();await expect(page.locator('.result h2')).toHaveText('テストA');await page.getByRole('button',{name:'スキャンに戻る',exact:true}).click();
 await page.getByRole('button',{name:'履歴',exact:true}).click();await expect(page.locator('.scan-history')).toBeVisible();await expect(page.locator('.scan-history-row')).toContainText('テストA');await page.locator('.scan-history-row').click();await expect(page.locator('.result')).toBeVisible();expect(await page.evaluate(()=>(window as any).immersiveStream.getTracks().every((t:MediaStreamTrack)=>t.readyState==='ended'))).toBe(true);await expect(page.locator('.result h2')).toHaveText('テストA');
 await openRoute(page,'画像');await page.setViewportSize({width:390,height:360});await expect(page.locator('.file-button')).toBeInViewport();expect(await page.evaluate(()=>scrollY)).toBe(0);
});
test('large text and short viewport keep candidate title and primary actions reachable (SYNTHETIC)',async({page},info)=>{
 await page.setViewportSize({width:320,height:500});await setup(page);await page.evaluate(()=>document.documentElement.style.fontSize='24px');await fitted(page);await page.screenshot({path:`${evidence}/${info.project.name}-large-text320-compact.png`});await page.getByRole('button',{name:'候補パネルを拡大'}).click();await fitted(page);await page.screenshot({path:`${evidence}/${info.project.name}-large-text320-expanded.png`});await page.getByRole('button',{name:'停止',exact:true}).click();
});
test('visualViewport keyboard offset keeps dock controls inside visible area without page jump (SYNTHETIC viewport event)',async({page},info)=>{
 await page.setViewportSize({width:390,height:844});await setup(page);
 await page.evaluate(()=>{const viewport=Object.assign(new EventTarget(),{width:390,height:360,offsetTop:150,offsetLeft:0});Object.defineProperty(window,'visualViewport',{value:viewport,configurable:true});window.dispatchEvent(new Event('resize'));viewport.dispatchEvent(new Event('resize'));});await fitted(page);
 for(const selector of ['.candidate-dock','.tentative>.actions','.dock-toolbar','.panel-navigation']){const bounds=(await page.locator(selector).boundingBox())!;expect(bounds.y).toBeGreaterThanOrEqual(150);expect(bounds.y+bounds.height).toBeLessThanOrEqual(510);}
 await page.screenshot({path:`${evidence}/${info.project.name}-keyboard-offset390.png`});const compact=(await page.locator('.candidate-dock').boundingBox())!.height;await page.getByRole('button',{name:'候補パネルを拡大'}).click();await fitted(page);expect((await page.locator('.candidate-dock').boundingBox())!.height).toBeGreaterThan(compact);await page.screenshot({path:`${evidence}/${info.project.name}-keyboard-offset390-expanded.png`});await page.getByRole('button',{name:'停止',exact:true}).click();
});

test('settings overlay is modal and leaves background geometry unchanged (SYNTHETIC)',async({page})=>{
 await page.setViewportSize({width:320,height:600});await setup(page);
 const geometry=async()=>Promise.all(['.viewport','.candidate-dock'].map(selector=>page.locator(selector).boundingBox()));
 const before=await geometry();const trigger=page.getByRole('button',{name:'設定',exact:true});await trigger.click();
 await expect(page.getByRole('dialog',{name:'設定',exact:true})).toBeVisible();
 expect(await page.locator('.utility-drawer').evaluate(n=>n.matches(':modal'))).toBe(true);
 expect(await geometry()).toEqual(before);await expect(page.getByRole('button',{name:'補助画面を閉じる'})).toBeFocused();
 expect(await page.locator('.candidate-dock').evaluate(n=>(n as HTMLElement).inert)).toBe(true);
 await page.locator('.tentative button').first().evaluate(n=>n.focus());await expect(page.getByRole('button',{name:'補助画面を閉じる'})).toBeFocused();
 await page.keyboard.press('Shift+Tab');await page.keyboard.press('Tab');
 expect(await page.locator('.utility-drawer').evaluate(n=>n.contains(document.activeElement))).toBe(true);
 await page.keyboard.press('Escape');await expect(page.locator('.utility-drawer')).toBeHidden();await expect(trigger).toBeFocused();
 expect(await geometry()).toEqual(before);await page.getByRole('button',{name:'停止',exact:true}).click();
});

test('overlay focus endpoints stay contained with no backdrop clickthrough (SYNTHETIC)',async({page},info)=>{
 await page.setViewportSize({width:1280,height:900});await setup(page);await page.getByRole('button',{name:'設定',exact:true}).click();
 const close=page.getByRole('button',{name:'補助画面を閉じる',exact:true});
 await page.keyboard.press('Shift+Tab');
 expect(await page.locator('.utility-drawer').evaluate(n=>n.contains(document.activeElement))).toBe(true);
 await page.keyboard.press('Tab');await expect(close).toBeFocused();
 await page.screenshot({path:`${evidence}/${info.project.name}-settings-overlay-desktop.png`});
 await page.mouse.click(170,70);await expect(page.locator('.utility-drawer')).toBeVisible();
 expect(await page.evaluate(()=>(window as any).immersiveStream.getTracks().every((t:MediaStreamTrack)=>t.readyState==='live'))).toBe(true);
 await expect(page.locator('.scan-history-row')).toHaveCount(0);
 await close.click();await expect(page.getByRole('button',{name:'設定',exact:true})).toBeFocused();
 await page.getByRole('button',{name:'停止',exact:true}).click();
});

for(const short of [false,true])test(`settings overlay 320px ${short?'short visual viewport':'portrait'} scrolls internally and restores focus (SYNTHETIC)`,async({page},info)=>{
 await page.setViewportSize({width:320,height:740});await setup(page);
 if(short)await page.evaluate(()=>{const viewport=Object.assign(new EventTarget(),{width:320,height:320,offsetTop:120,offsetLeft:0});Object.defineProperty(window,'visualViewport',{value:viewport,configurable:true});window.dispatchEvent(new Event('resize'));});
 const background=async()=>Promise.all(['.viewport','.candidate-dock'].map(selector=>page.locator(selector).boundingBox()));
 const before=await background();await page.getByRole('button',{name:'設定',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'設定',exact:true});await expect(dialog).toBeVisible();
 await page.getByText('認識設定（デバッグ）',{exact:true}).click();
 const input=page.getByLabel('四隅の表示期限 (ms)',{exact:true});await input.focus();await expect(input).toBeInViewport();
 const bounds=(await dialog.boundingBox())!;expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(320);expect(bounds.y).toBeGreaterThanOrEqual(short?120:0);expect(bounds.y+bounds.height).toBeLessThanOrEqual(short?440:740);
 const close=page.getByRole('button',{name:'補助画面を閉じる',exact:true});const closeBounds=(await close.boundingBox())!;expect(closeBounds.y).toBeGreaterThanOrEqual(bounds.y);expect(closeBounds.y+closeBounds.height).toBeLessThanOrEqual(bounds.y+bounds.height);
 const inputBounds=(await input.boundingBox())!;expect(inputBounds.y).toBeGreaterThanOrEqual(closeBounds.y+closeBounds.height);expect(inputBounds.y+inputBounds.height).toBeLessThanOrEqual(bounds.y+bounds.height);
 expect(await background()).toEqual(before);
 await page.locator('.drawer-body').evaluate(n=>n.scrollTop=n.scrollHeight);expect(await page.locator('.drawer-body').evaluate(n=>n.scrollTop)).toBeGreaterThan(0);
 await page.mouse.wheel(0,600);expect(await page.evaluate(()=>scrollY)).toBe(0);expect(await background()).toEqual(before);
 await page.locator('.drawer-body').evaluate(n=>n.scrollTop=0);
 await page.screenshot({path:`${evidence}/${info.project.name}-settings-overlay320${short?'-short':''}.png`});
 await close.click();await expect(page.getByRole('button',{name:'設定',exact:true})).toBeFocused();expect(await background()).toEqual(before);
 expect(await page.evaluate(()=>(window as any).immersiveStream.getTracks().every((t:MediaStreamTrack)=>t.readyState==='live'))).toBe(true);
 await expect(page.locator('.scan-history-row')).toHaveCount(0);await page.getByRole('button',{name:'停止',exact:true}).click();
});
test('auxiliary overlay never starts stopped camera and history close never restarts it (SYNTHETIC)',async({page})=>{
 await setup(page);await page.getByRole('button',{name:'これです',exact:true}).click();await expect(page.locator('.scan-history-row')).toHaveCount(1);
 await openRoute(page,'履歴');await expect(page.getByRole('dialog',{name:'履歴',exact:true})).toBeVisible();await page.locator('.scan-history-row').click();
 await expect(page.getByRole('dialog',{name:'確定カード',exact:true})).toBeVisible();await closeRoute(page);
 for(const route of ['設定','画像','履歴'] as const){await openRoute(page,route);await expect(page.getByRole('dialog',{name:route,exact:true})).toBeVisible();await page.keyboard.press('Escape');}
 expect(await page.evaluate(()=>(window as any).immersiveStream.getTracks().every((t:MediaStreamTrack)=>t.readyState==='ended'))).toBe(true);
 await expect(page.getByRole('button',{name:'カメラでスキャン',exact:true})).toBeEnabled();await expect(page.locator('.scan-history-row')).toHaveCount(1);
});

test('focused settings field stays reachable when keyboard visual viewport shrinks (SYNTHETIC viewport event)',async({page},info)=>{
 await page.setViewportSize({width:320,height:740});await setup(page);await openRoute(page,'設定');await page.getByText('認識設定（デバッグ）',{exact:true}).click();
 const input=page.getByLabel('四隅の表示期限 (ms)',{exact:true});await input.focus();
 await page.evaluate(()=>{const viewport=Object.assign(new EventTarget(),{width:320,height:320,offsetTop:120,offsetLeft:0});Object.defineProperty(window,'visualViewport',{value:viewport,configurable:true});window.dispatchEvent(new Event('resize'));});
 await expect.poll(async()=>{const active=(await input.boundingBox())!,body=(await page.locator('.drawer-body').boundingBox())!;return active.y>=body.y&&active.y+active.height<=body.y+body.height;}).toBe(true);
 await expect(input).toBeFocused();await expect(page.getByRole('button',{name:'補助画面を閉じる'})).toBeInViewport();expect(await page.evaluate(()=>scrollY)).toBe(0);
 await page.screenshot({path:`${evidence}/${info.project.name}-settings-overlay-keyboard-focused.png`});
 await closeRoute(page);await page.getByRole('button',{name:'停止',exact:true}).click();
});
