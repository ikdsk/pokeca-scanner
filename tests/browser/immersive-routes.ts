import type { Page } from '@playwright/test';
// Auxiliary sections require deliberate navigation; settings live behind the gear (情報・設定).
export async function openRoute(page:Page,name:'画像'|'履歴'|'設定'):Promise<void>{
 if(await page.locator('.candidate-detail-sheet').isVisible())await page.getByRole('button',{name:'閉じる',exact:true}).click();
 const dialog=page.locator('.utility-drawer');
 if(await dialog.isVisible()){
  if(await page.locator('#drawer-heading').textContent()===name)return;
  await closeRoute(page);
 }
 if(name==='設定'){await page.getByRole('button',{name:'情報・設定',exact:true}).click();return;}
 await page.getByRole('button',{name,exact:true}).click();
}
export async function closeRoute(page:Page):Promise<void>{
 if(await page.locator('.candidate-detail-sheet').isVisible())await page.getByRole('button',{name:'閉じる',exact:true}).click();
 if(await page.locator('.utility-drawer').isVisible())await page.locator('.utility-drawer').getByRole('button',{name:'閉じる',exact:true}).click();
}
