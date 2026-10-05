import './ui/style.css';
import { el, button, label } from './ui/dom.js';
import { resolveCard, type PokeCard } from './data/pokemon.js';
import { createTcgplayerPrice } from './data/tcgplayer-price.js';
import { FxProvider } from './data/fx.js';
import { ScanHistory } from './ui/scan-history-model.js';
import { ScanHistoryView } from './ui/scan-history.js';
import { ReferenceImage } from './ui/reference-image.js';
import { PriceSession } from './ui/price-session.js';
import { priceView } from './ui/price-view.js';
import { candidateView } from './ui/candidate-view.js';
import { createSnapshotLoader } from './ui/snapshot-loader.js';
import { CardIdentity } from './ui/card-identity.js';
import { RearmTracker } from './ui/rearm.js';
import { Recognizer, type RecognitionResult } from './recognition/adapter.js';
import { LiveCandidate, type Suggestion } from './recognition/live-candidate.js';
import { defaults, bounds, validateSettings, type RecognitionSettings } from './recognition/settings.js';
import { CandidateMetadata } from './ui/candidate-metadata.js';
import { DetectionOverlay } from './ui/detection-overlay.js';
import { captureCameraFrame } from './ui/camera-geometry.js';


const marks: { event: string; ms: number; detail?: unknown }[] = [];
function mark(event: string, detail?: unknown): void { marks.push({ event, ms: performance.now(), detail }); if (marks.length > 300) marks.shift(); performance.clearMarks(event); performance.mark(event); }
mark('shell-start');
const fx = new FxProvider(); const prices = createTcgplayerPrice(createSnapshotLoader());
const app = document.querySelector<HTMLDivElement>('#app')!;
const header = el('header'); header.append(el('h1', 'ポケカスキャナー'));
const scan = el('section', '', 'panel scan-panel');
const viewport = el('div', '', 'viewport');
const video = el('video'); video.muted = true; video.playsInline = true; video.autoplay = true;
const guide = el('div', '', 'guide'); guide.append(el('span', 'カードの四隅を画面内に入れてください'));
const overlayCanvas = el('canvas', '', 'detection-overlay'); overlayCanvas.setAttribute('aria-hidden', 'true');
const detectionStatus = el('p', 'カード検出なし', 'small'); detectionStatus.setAttribute('role', 'status');
const overlay = new DetectionOverlay(overlayCanvas, video, visible => { detectionStatus.textContent = visible ? 'カードの四隅を検出 · カード名の確定とは別です' : 'カード検出なし'; });
guide.hidden = true; viewport.append(video, overlayCanvas, guide);
const cameraStatus = el('p', 'カメラは停止中', 'status camera-status'); cameraStatus.setAttribute('role', 'status');
const modelStatus = el('p', '認識データはスキャン開始時に準備します', 'muted small'); modelStatus.setAttribute('role', 'status');
const scanActions = el('div', '', 'actions');
const start = button('カメラでスキャン', () => { void startCamera(); }, 'primary');
const stop = button('停止', () => stopCamera('カメラを停止しました'));
const modelRetry = button('認識の準備を再試行', () => { recognizer.dispose(); const generation = scanGeneration; void prepare().then(ok => { if (ok && active && generation === scanGeneration) void loop(generation); }); }); modelRetry.hidden = true;
const file = el('input'); file.type = 'file'; file.accept = 'image/*'; file.id = 'local-image';
const fileLabel = label('端末の画像でスキャン', file); fileLabel.className = 'file-button';
scanActions.append(start, stop, fileLabel, modelRetry);
const cameraInfo = el('div', '', 'camera-info'); cameraInfo.append(cameraStatus, detectionStatus, modelStatus);
scan.append(viewport, cameraInfo);
const imagePanel = el('section', '', 'panel image-panel'); imagePanel.append(el('h2', '端末の画像でスキャン'), el('p', '画像は端末内だけで処理し、外部へ送信しません。', 'small muted'));
const result = el('section', '', 'panel result'); result.hidden = true; result.setAttribute('aria-label', 'カード情報');
const footer = el('footer');
footer.append(el('p', '海外参考価格 · 国内販売・買取価格ではありません。自動認識は候補です。実物のカード（版・状態）を確認してください。'));
const sources = el('p');
for (const [name, href] of [['TCGdex', 'https://tcgdex.dev'], ['TCGplayer（TCGCSV経由）', 'https://tcgcsv.com'], ['Frankfurter / ECB', 'https://frankfurter.dev'], ['CollectorVision', 'https://github.com/HanClinto/CollectorVision']]) {
  const a = el('a', name); a.href = href!; a.target = '_blank'; a.rel = 'noopener noreferrer'; sources.append(a, document.createTextNode(' · '));
}
footer.append(sources, el('p', 'ローカル・内部検証版。認識コードとモデルはAGPL-3.0。公開・配布前にライセンス対応と公開承認が必要です。ポケモンカードの権利は株式会社ポケモン等の権利者に帰属します。', 'small'));
const notices = el('a', '第三者ライセンスと利用条件'); notices.href = '/recognition/THIRD-PARTY-NOTICES.md'; footer.append(notices);
const privacy = el('details'); privacy.append(el('summary', '通信・プライバシーの詳細'), el('p', '候補カードのセット名・番号をTCGdex（api.tcgdex.net）に送信し、参照画像はassets.tcgdex.netから取得します。価格はTCGCSV由来のスナップショットをこのアプリ自身の配信元（/prices/pokemon-japan-usd.json）から読み込み、価格取得のために外部へ送信しません。USD/JPYの通貨ペアをFrankfurterに送信します。認識用のコード・モデル・辞書はjsDelivr、Hugging Face、CollectorVisionCatalogから取得します。提供元には通常の通信情報が渡ります。晴れる屋2はリンクをタップするまで通信せず、価格や内容の取得・保存・再表示はしません。撮影・選択画像は保存・送信せず、解析ログはこのタブのメモリ内のみです。分析サービスへの送信はありません。'));
footer.append(privacy);
const debug = el('details'); debug.append(el('summary', '端末内の計測ログ')); const debugOutput = el('pre');
debug.append(button('計測を表示', () => { debugOutput.textContent = JSON.stringify(marks, null, 2); }), debugOutput); footer.append(debug);
const information = el('details', '', 'information'); information.id = 'information'; information.append(el('summary', '情報・プライバシー'), el('p', '画像は端末内だけで処理します。初回は認識データ約17MBと実行環境をダウンロードします。'), footer);
header.append(button('情報・設定', () => showDrawer('settings')));
const actionPanel = el('section', '', 'action-panel'); actionPanel.append(scanActions);
const tentativePanel = el('aside', '', 'tentative'); tentativePanel.hidden=true; tentativePanel.setAttribute('aria-label','もしかして？');
const tentativeExpansion=el('p','','small expansion');const tentativeMeta=el('p','','meta');const tentativePrice=el('div','','candidate-price');const tentativeReference=new ReferenceImage();
const tentativeName=el('strong'); const tentativeScore=el('span','','score small');
const tentativeMessage=el('p','','candidate-message'); const announcement=el('span','','sr-only'); announcement.setAttribute('role','status');
const tentativeLink=el('a','','hare2-link'); tentativeLink.target='_blank'; tentativeLink.rel='noopener noreferrer';
const confirm=button('これです',()=>confirmSuggestion()); const dismiss=button('違う',()=>dismissSuggestion());
const tentativeContent=el('div'); tentativeContent.append(el('span','もしかして？','eyebrow'),tentativeName,tentativeExpansion,tentativeMeta,tentativeMessage);
const tentativeActions=el('div','','actions'); tentativeActions.append(confirm,dismiss); const tentativeSummary=el('div','','candidate-summary'); tentativeSummary.append(tentativeReference.node,tentativeContent);
const tentativeDetails=el('div','','candidate-details'); tentativeDetails.id='candidate-details';tentativeDetails.setAttribute('aria-label','候補の詳細');tentativeDetails.setAttribute('role','region');tentativeDetails.tabIndex=0;
const tentativeSources=el('div','','candidate-sources');
tentativeSummary.append(tentativePrice); tentativeDetails.append(tentativeSources,tentativeLink);
tentativePanel.append(tentativeSummary,tentativeActions,tentativeDetails,announcement);
const diagnostics=el('p','類似度 — · margin —','small'); const resolveStatus=el('p','','small muted'); resolveStatus.setAttribute('role','status'); cameraInfo.append(diagnostics,resolveStatus);
const settingsPanel=el('details','','recognition-settings'); settingsPanel.append(el('summary','認識設定（デバッグ）'),el('p','このタブのみ。再読み込みで初期値に戻ります。類似度は未較正の cosine 値で、確率ではありません。','small'));
let settings: RecognitionSettings={...defaults}; let evidenceRevision=0;
const settingsInputs=new Map<keyof RecognitionSettings,HTMLInputElement>();
const settingNames: Record<keyof RecognitionSettings,string>={tentativeScore:'提案の類似度',delayMs:'推論完了後の待ち時間 (ms)',rearmCount:'同じカードの再受付に必要な不在観測数',rearmMs:'不在の最小継続時間 (ms)',overlayMs:'四隅の表示期限 (ms)'};
const settingsError=el('p','','small'); settingsError.setAttribute('role','status');
for(const key of Object.keys(defaults) as (keyof RecognitionSettings)[]) {
 const input=el('input');input.type='number';const [min,max,step]=bounds[key];input.min=String(min);input.max=String(max);input.step=String(step);input.value=String(settings[key]);input.setAttribute('aria-label',settingNames[key]);settingsInputs.set(key,input);
 input.addEventListener('change',()=>{const next={...settings,[key]:input.valueAsNumber};if(!validateSettings(next)){settingsError.textContent='有限の範囲内の値を指定してください。観測数と時間は整数です。';input.value=String(settings[key]);return;}applySettings(next);});
 settingsPanel.append(label(`${settingNames[key]} · 初期値 ${defaults[key]} · ${min}〜${max}`,input));
}
settingsPanel.append(button('認識設定を初期値に戻す',()=>applySettings({...defaults})),settingsError);
const history = new ScanHistory();
const historyView = new ScanHistoryView(entry => {
  stopCamera('履歴を表示中 · カメラは停止しています');
  openCard(entry.card, 'スキャン履歴から選択', true);
}, history.limit);
// The camera and dock are the two visual-viewport rows. Auxiliary routes are
// modal overlay windows; the ordinary candidate dock stays nonmodal.
const candidateDock=el('section','','candidate-dock');
const dockToolbar=el('div','','dock-toolbar'); dockToolbar.append(el('span','もしかして？','eyebrow'));
const expand=button('⌃',()=>setExpanded(true)); expand.setAttribute('aria-label','候補パネルを拡大'); expand.setAttribute('aria-controls',tentativeDetails.id);
const contract=button('⌄',()=>setExpanded(false)); contract.setAttribute('aria-label','候補パネルを縮小'); contract.setAttribute('aria-controls',tentativeDetails.id);
dockToolbar.append(expand,contract);
const emptyCandidate=el('p','カードをかざすと候補が表示されます。「これです」で確認してください。','empty-candidate small');
const navigation=el('nav','','panel-navigation'); navigation.setAttribute('aria-label','スキャナーの機能');
const drawer=el('dialog','','utility-drawer'); drawer.setAttribute('aria-modal','true'); drawer.setAttribute('aria-label','スキャナーの補助画面');
const drawerHeading=el('h2'); drawerHeading.id='drawer-heading';drawer.setAttribute('aria-labelledby',drawerHeading.id);
const drawerBar=el('div','','drawer-bar');const drawerClose=button('補助画面を閉じる',()=>closeDrawer());drawerBar.append(drawerHeading,drawerClose);
const drawerBody=el('div','','drawer-body');const historyRoute=el('div');historyRoute.append(el('p','確定したスキャンはまだありません。','empty-history'),historyView.node);
const settingsRoute=el('div');settingsRoute.append(settingsPanel,information);
imagePanel.append(fileLabel,modelRetry);
const routes={image:imagePanel,history:historyRoute,settings:settingsRoute,result};
const routeNames={image:'画像',history:'履歴',settings:'設定',result:'確定カード'};
let drawerTrigger:HTMLElement|null=null;
for(const route of Object.keys(routes) as (keyof typeof routes)[]) {
 const control=button(routeNames[route],()=>showDrawer(route));control.setAttribute('aria-controls','utility-drawer');control.setAttribute('aria-expanded','false');control.dataset.route=route;navigation.append(control);
 routes[route].classList.add('drawer-route');routes[route].dataset.route=route;drawerBody.append(routes[route]);
}
drawer.id='utility-drawer';drawer.append(drawerBar,drawerBody);
candidateDock.append(dockToolbar,emptyCandidate,tentativePanel,navigation);
viewport.append(header,actionPanel,cameraInfo);scan.replaceChildren(viewport);app.append(scan,candidateDock,drawer);
function setExpanded(value:boolean):void {candidateDock.dataset.expanded=String(value);expand.disabled=value;contract.disabled=!value;expand.setAttribute('aria-expanded',String(value));contract.setAttribute('aria-expanded',String(value));tentativeDetails.hidden=!value;}
setExpanded(false);
function showDrawer(route:keyof typeof routes):void {
 if(!drawer.open)drawerTrigger=document.activeElement as HTMLElement;
 drawerHeading.textContent=routeNames[route];
 for(const [key,node] of Object.entries(routes))node.classList.toggle('route-active',key===route);
 for(const control of navigation.querySelectorAll<HTMLButtonElement>('button'))control.setAttribute('aria-expanded',String(control.dataset.route===route));
 historyRoute.querySelector<HTMLElement>('.empty-history')!.hidden=history.allEntries.length>0;information.open=route==='settings';drawerBody.scrollTop=0;
 if(!drawer.open){drawer.showModal();scan.inert=true;candidateDock.inert=true;}
 drawerClose.focus({preventScroll:true});
}
function closeDrawer():void {
 if(!drawer.open)return;
 drawer.close();scan.inert=false;candidateDock.inert=false;
 for(const control of navigation.querySelectorAll('button'))control.setAttribute('aria-expanded','false');
 if(drawerTrigger?.isConnected&&!drawerTrigger.closest('[inert]'))drawerTrigger.focus({preventScroll:true});
 drawerTrigger=null;
}
drawer.addEventListener('cancel',event=>{event.preventDefault();closeDrawer();});
function revealDrawerFocus():void {
 const focused=document.activeElement;
 if(!drawer.open||!(focused instanceof HTMLElement)||!drawerBody.contains(focused))return;
 const field=focused.getBoundingClientRect(),body=drawerBody.getBoundingClientRect();
 if(field.bottom>body.bottom-8)drawerBody.scrollTop+=Math.ceil(field.bottom-body.bottom+8);
 else if(field.top<body.top+8)drawerBody.scrollTop-=Math.ceil(body.top-field.top+8);
}

// Keep endpoint Tab navigation in the window, including Chromium's browser-chrome
// tab stop. Native modal behavior supplies the background inertness and Escape.
drawer.addEventListener('keydown',event=>{
 if(event.key!=='Tab')return;
 const controls=[...drawer.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href],summary,[tabindex]')].filter(node=>node.tabIndex>=0&&!node.matches(':disabled')&&node.checkVisibility({visibilityProperty:true}));
 const first=controls[0],last=controls.at(-1);if(!first||!last)return;
 if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus({preventScroll:true});revealDrawerFocus();}
 else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus({preventScroll:true});}
});

// visualViewport handles browser bars and the software keyboard without page jumps.
function fitViewport():void {const visual=window.visualViewport;const height=visual?.height??window.innerHeight;app.classList.toggle('compact-viewport',height<=550);app.classList.toggle('short-viewport',height<=400);app.style.height=`${visual?.height??window.innerHeight}px`;app.style.top=`${visual?.offsetTop??0}px`;app.style.left=`${visual?.offsetLeft??0}px`;app.style.width=`${visual?.width??window.innerWidth}px`;drawer.style.setProperty('--window-height',`${height}px`);drawer.style.setProperty('--window-width',`${visual?.width??window.innerWidth}px`);drawer.style.setProperty('--window-top',`${visual?.offsetTop??0}px`);drawer.style.setProperty('--window-left',`${visual?.offsetLeft??0}px`);if(drawer.open)requestAnimationFrame(revealDrawerFocus);}
fitViewport();window.addEventListener('resize',fitViewport);window.visualViewport?.addEventListener('resize',fitViewport);window.visualViewport?.addEventListener('scroll',fitViewport);


let stream: MediaStream | null = null; let scanGeneration = 0; let active = false; let modelReady = false;
let preparationGeneration = 0;
let frameBusy = false; let loopTimer: ReturnType<typeof setTimeout> | null = null;
const tentative = new LiveCandidate();
// Different TCGplayer products (e.g. Poke Ball Pattern) can be the same Japanese card.
const identity = new CardIdentity();
const rearm = new RearmTracker(settings.rearmCount, settings.rearmMs);
// Canonical ids the user already answered; cleared when the card leaves the view.
const handled = new Set<string>();
// Catalog metadata per observed id; the lookup runs once per candidate and is cached by CandidateMetadata.
const metaById = new Map<string, { set: unknown; collector_number: unknown }>();
const cardInfo = new CandidateMetadata<PokeCard | null>((id: string, signal: AbortSignal) => resolveCard(id, metaById.get(id) ?? {}, signal));
const quoteFor = (id: string, signal: AbortSignal) => prices.quote(id, undefined, signal);
const candidatePrice = new PriceSession(quoteFor, signal => fx.latest(signal), renderCandidatePrice);
let suggestion: Suggestion | null=null; let suggestionCard: PokeCard | null=null;
let lastAnnouncement=-Infinity;
type ActivationGesture = { snapshot: Suggestion | null; key: string | null };
const gestures = new Map<HTMLButtonElement, ActivationGesture>();
function captureGesture(control: HTMLButtonElement, key: string | null): void {
 gestures.set(control,{snapshot:suggestion ? Object.freeze({...suggestion}) : null,key});
}
function activationSnapshot(control: HTMLButtonElement): Suggestion | null {
 const gesture=gestures.get(control);
 if(!gesture)return suggestion; // Deliberate click / assistive activation without a down event.
 if(gesture.key===null)gestures.delete(control);
 return gesture.snapshot;
}
for(const control of [confirm,dismiss]) {
 control.addEventListener('pointerdown',()=>captureGesture(control,null));
 control.addEventListener('keydown',event=>{
  if(event.key!=='Enter'&&event.key!==' ')return;
  event.preventDefault();
  if(event.repeat || gestures.get(control)?.key)return;
  captureGesture(control,event.key);
  if(event.key==='Enter')control.click();
 });
 control.addEventListener('keyup',event=>{
  if(event.key!=='Enter'&&event.key!==' ')return;
  event.preventDefault();
  const gesture=gestures.get(control);
  if(gesture?.key===event.key) {
   if(event.key===' '&&gesture.snapshot)control.click();
   gestures.delete(control);
  }
 });
 const cancel=()=>{const gesture=gestures.get(control);if(gesture){gesture.snapshot=null;gesture.key=null;}};
 control.addEventListener('blur',cancel);control.addEventListener('pointercancel',cancel);
 window.addEventListener('blur',cancel);
 // Release can occur after focus left the button. Never reuse that canceled gesture.
 document.addEventListener('keyup',event=>{if(gestures.get(control)?.key===event.key)gestures.delete(control);});
}
function hideSuggestion():void {cardInfo.cancelExcept(null);suggestion=null;suggestionCard=null;candidatePrice.reset();tentativeReference.clear();tentativePanel.classList.remove('holding');tentativePanel.hidden=true;emptyCandidate.hidden=false;}
function applySettings(next: RecognitionSettings):void {
 settings={...next};evidenceRevision++;
 tentative.reset(settings.tentativeScore,settings.rearmCount,settings.rearmMs);rearm.configure(settings.rearmCount,settings.rearmMs);hideSuggestion();overlay.clear();overlay.staleMs=settings.overlayMs;
 for(const [key,input] of settingsInputs)input.value=String(settings[key]);settingsError.textContent='設定を適用しました。新しい観測から使用します。';diagnostics.textContent='類似度 — · margin —';
}
function rememberMeta(candidate: RecognitionResult, raw: string | null):void {
 if(!raw)return;
 metaById.set(raw,{set:candidate.catalogMeta?.set,collector_number:candidate.catalogMeta?.collectorNumber});
 while(metaById.size>50)metaById.delete(metaById.keys().next().value!);
}
// Maps the observed product id to the displayed card's identity before the live-candidate gate sees it.
function observe(candidate: RecognitionResult, now: number): Suggestion | null {
 const raw=candidate.cardId;
 if(candidate.cardPresent===false){if(rearm.observe(false,now))handled.clear();}else rearm.observe(true,now);
 if(!raw)return tentative.observe({...candidate},now);
 const canonical=identity.canonical(raw);
 rememberMeta(candidate,raw); if(!metaById.has(canonical))rememberMeta(candidate,canonical);
 return tentative.observe({...candidate,cardId:canonical},now);
}
function showLoading():void {
 tentativeReference.clear();tentativeName.textContent='カード情報を確認中…';tentativeExpansion.textContent='';tentativeMeta.replaceChildren(tentativeScore);tentativeMessage.textContent='';tentativeLink.hidden=true;tentativeSources.replaceChildren();tentativePrice.replaceChildren();
}
function showCard(card: PokeCard):void {
 const view=candidateView(card);suggestionCard=card;tentativePanel.classList.remove('holding');
 tentativeName.textContent=view.name;tentativeExpansion.textContent=view.expansion;
 tentativeMeta.replaceChildren(...metaNodes(view),tentativeScore);
 tentativeMessage.textContent='';
 tentativeReference.update(card);tentativeLink.textContent=view.hare2.label;tentativeLink.href=view.hare2.href;tentativeLink.hidden=false;
 tentativeSummary.prepend(tentativeReference.node);
 void candidatePrice.select(card);
}
function metaNodes(view: ReturnType<typeof candidateView>):HTMLElement[] {
 const nodes:HTMLElement[]=[];
 if(view.rarity)nodes.push(el('span',`レアリティ ${view.rarity}`,'rarity'));
 if(view.regulation){const badge=el('span',view.regulation.label,'regulation-badge');badge.setAttribute('aria-label',view.regulation.aria);badge.title=view.regulation.aria;nodes.push(badge);}
 if(view.matchNote)nodes.push(el('span',view.matchNote,'match-note muted'));
 return nodes;
}
function presentSuggestion(next: Suggestion | null):void {
 if(!next){hideSuggestion();return;}
 const changed=suggestion?.version!==next.version;suggestion=next;tentativeScore.textContent=`類似度 ${next.score.toFixed(3)}`;
 if(!changed)return;
 cardInfo.cancelExcept(next.cardId);resolveStatus.textContent='';
 // Same displayed card under another product id: adopt silently, no flicker and no new proposal.
 if(suggestionCard&&identity.sameCard(suggestionCard.tcgplayerId,next.cardId))return;
 if(!suggestionCard){candidatePrice.reset();showLoading();}
 else tentativePanel.classList.add('holding'); // keep the old card visible until the replacement resolves
 tentativePanel.hidden=false;emptyCandidate.hidden=true;if(performance.now()-lastAnnouncement>=2000){announcement.textContent='もしかして？ 候補を確認できます';lastAnnouncement=performance.now();}
 const settle=(note:string)=>{const canonical=identity.canonical(next.cardId);tentative.dismiss({...next,identity:canonical});handled.add(canonical);hideSuggestion();resolveStatus.textContent=note;};
 void cardInfo.get(next.cardId).then(card=>{
  if(!suggestion||!tentative.current(next))return;
  // Never display a candidate that only has an internal id.
  if(!card){settle('カード情報を確認できない候補は表示しません（TCGdexに未登録のカードの可能性）');return;}
  const canonical=identity.learn(next.cardId,card.tcgdexId);
  if(suggestionCard?.tcgdexId===card.tcgdexId){tentativePanel.classList.remove('holding');return;}
  if(canonical!==next.cardId&&handled.has(canonical)){settle('');return;}
  showCard(card);
 }).catch(()=>{if(suggestion&&tentative.current(next))settle('カード情報を取得できません。通信を確認し、カードを一度外してもう一度かざしてください。');});
}
function priceNodes(state: PriceSession['value']):{summary:HTMLElement[];disclaimer:HTMLElement;details:HTMLElement[]} {
 const view=priceView({status:state.status,quotes:state.quotes,variant:state.card?.variant??null,fx:state.fx,fxError:state.fxError});
 const summary:HTMLElement[]=[el('p',view.heading,'eyebrow'),el('strong',view.headline,'price')];
 if(view.usd)summary.push(el('span',view.usd,'usd'));
 const disclaimer=el('p',view.disclaimer,'small');
 const details:HTMLElement[]=[];
 if(view.note)details.push(el('p',view.note,'small'));
 if(view.others.length)details.push(el('p',`他の価格区分：${view.others.join(' / ')}`,'small muted others'));
 if(view.updatedAt)details.push(el('p',`TCGplayer（TCGCSV経由）· ${view.updatedAt}`,'small muted'));
 details.push(el('p',view.fxNote,'small muted'));
 return {summary,disclaimer,details};
}
function renderCandidatePrice():void {
 const value=candidatePrice.value;
 if(!value.card||value.card.tcgdexId!==suggestionCard?.tcgdexId){tentativePrice.replaceChildren();tentativeSources.replaceChildren();return;}
 const {summary,disclaimer,details}=priceNodes(value);tentativePrice.replaceChildren(...summary);tentativeSources.replaceChildren(disclaimer,...details);
}
function dismissSuggestion():void {const captured=activationSnapshot(dismiss);if(captured){handled.add(identity.canonical(captured.cardId));tentative.dismiss(captured);if(suggestion?.version===captured.version)hideSuggestion();}}
function confirmSuggestion():void {
 const captured=activationSnapshot(confirm);
 if(!captured || !tentative.current(captured) || suggestion?.version!==captured.version)return;
 const card=suggestionCard;if(!card || !identity.sameCard(card.tcgplayerId,captured.cardId)){tentativeMessage.textContent='カード情報を確認できません。取得完了後に再確認してください。';return;}
 evidenceRevision++;tentative.accepted(captured.identity);handled.add(identity.canonical(captured.cardId));hideSuggestion();
 const event=++acceptedEvent;
 history.accept(event,card);historyView.update(history.allEntries);
 openCard(card,'「これです」で確認 · 実物のカード（版・状態）は未確認',false,active);
}
let acceptedEvent = 0;
const recognizer = new Recognizer(message => { modelStatus.textContent = message; });
const referenceImage = new ReferenceImage();
const session = new PriceSession(quoteFor, signal => fx.latest(signal), renderResult);

async function prepare(): Promise<boolean> {
  const attempt = ++preparationGeneration;
  modelRetry.hidden = true; mark('model-start');
  try { await recognizer.init(); if (attempt !== preparationGeneration) return false; modelReady = true; mark('model-ready'); return true; }
  catch (error) { if (attempt !== preparationGeneration) return false; modelReady = false; modelStatus.textContent = errorText(error, '認識データを準備できません。端末の画像で再試行できます。'); modelRetry.hidden = false; mark('model-error'); return false; }
}
function errorText(error: unknown, fallback: string): string {
  if (!navigator.onLine) return 'オフラインです。接続後に再試行してください。';
  if (error instanceof DOMException && error.name === 'NotAllowedError') return 'カメラの許可がありません。ブラウザの設定で許可し、再試行してください。端末の画像も使えます。';
  if (error instanceof DOMException && error.name === 'NotFoundError') return 'カメラが見つかりません。端末の画像を利用してください。';
  if (error instanceof DOMException && error.name === 'NotReadableError') return 'カメラを使用できません。他のアプリを閉じて再試行してください。';
  if (error instanceof Error && error.name !== 'AbortError') return `${fallback} ${error.message}`;
  return fallback;
}
function stopCamera(message?: string): void {
  scanGeneration++; evidenceRevision++; hideSuggestion(); tentative.newContext();handled.clear();resolveStatus.textContent='';for(const gesture of gestures.values())gesture.snapshot=null; active = false;  overlay.stop(); overlayCanvas.dataset.detected = 'false'; detectionStatus.textContent = 'カード検出なし';
  if (loopTimer) clearTimeout(loopTimer); loopTimer = null;
  stream?.getTracks().forEach(track => track.stop()); stream = null; video.srcObject = null;
  start.disabled = false; stop.disabled = true; guide.hidden = true;
  if (message) cameraStatus.textContent = message;
  mark('camera-stop');
}
async function startCamera(): Promise<void> {
  closeDrawer();
  stopCamera(); const generation = scanGeneration; active = true; start.disabled = true; stop.disabled = false;
  cameraStatus.textContent = 'カメラの許可・起動を待っています'; mark('camera-start');
  const ready = prepare();
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('カメラにはHTTPSまたはlocalhostが必要です。');
    // Optional standard constraint (not yet in our TypeScript DOM typings).
    // Ask the browser to avoid cropping before the full-frame capture.
    const videoConstraints: MediaTrackConstraints & { resizeMode: ConstrainDOMString } = {
      facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 }, resizeMode: { ideal: 'none' },
    };
    const obtained = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false });
    if (generation !== scanGeneration || !active) { obtained.getTracks().forEach(track => track.stop()); return; }
    overlay.start(); stream = obtained; guide.hidden = false; video.srcObject = stream; await video.play();
    if (generation !== scanGeneration || !active) return;
    cameraStatus.textContent = 'カメラ映像を表示中 · カード全体を画面内へ'; mark('camera-video');
    const success = await ready;
    if (success && generation === scanGeneration && active) void loop(generation);
  } catch (error) {
    if (generation !== scanGeneration) return;
    stopCamera(errorText(error, 'カメラを起動できません。'));
  }
}
async function captureVideo(): Promise<ImageBitmap> {
  return captureCameraFrame(video);
}
async function loop(generation: number): Promise<void> {
  if (!active || generation !== scanGeneration) return;
  if (frameBusy || !video.videoWidth) { loopTimer = setTimeout(() => { void loop(generation); }, 150); return; }
  frameBusy = true;
  try {
    const revision=evidenceRevision; mark('frame-start'); const capturedAt = performance.now(); const bitmap = await captureVideo();
    if (generation !== scanGeneration) { bitmap.close(); return; }
    const candidate = await recognizer.frame(bitmap); mark('frame-result', candidate.timing);
    if (generation !== scanGeneration || !active || revision!==evidenceRevision) return;
    diagnostics.textContent=`類似度 ${Number.isFinite(candidate.score) ? candidate.score!.toFixed(3) : '—'} · margin ${Number.isFinite(candidate.margin) ? candidate.margin.toFixed(3) : '—'}`;
    overlay.update(candidate, capturedAt);
    cameraStatus.textContent = 'カード全体を画面内へ · 候補は「これです」で確認してください';
    presentSuggestion(observe(candidate,performance.now()));
  } catch (error) {
    if (generation === scanGeneration) { modelReady = false; modelRetry.hidden = false; stopCamera(errorText(error, '認識できません。端末の画像も利用できます。')); }
  } finally {
    frameBusy = false;
    if (active && generation === scanGeneration) loopTimer = setTimeout(() => { void loop(generation); }, settings.delayMs);
  }
}
file.addEventListener('change', () => { const image = file.files?.[0]; file.value = ''; if (image) void scanFile(image); });
async function scanFile(image: File): Promise<void> {
  closeDrawer();
  session.reset();
  // A local image starts a new recognition session; never compete with a
  // transferred camera frame that cannot be recalled from the old worker.
  recognizer.dispose(); modelReady = false;
  stopCamera(); const generation = scanGeneration;
  cameraStatus.textContent = '端末の画像を認識中（外部送信なし）';
  try {
    if (image.size > 25 * 1024 * 1024) throw new Error('25MB以下の画像を選んでください');
    if (!(await prepare()) || generation !== scanGeneration) return;
    const decoded = await createImageBitmap(image);
    const canvas = document.createElement('canvas'); const scale = Math.min(1, 1024 / Math.max(decoded.width, decoded.height));
    canvas.width = Math.round(decoded.width * scale); canvas.height = Math.round(decoded.height * scale);
    canvas.getContext('2d')!.drawImage(decoded, 0, 0, canvas.width, canvas.height); decoded.close();
    const revision=evidenceRevision; mark('file-frame-start'); const candidate = await recognizer.frame(await createImageBitmap(canvas)); mark('file-frame-result', candidate);
    if (generation !== scanGeneration || revision!==evidenceRevision) return;
    diagnostics.textContent=`類似度 ${Number.isFinite(candidate.score)?candidate.score!.toFixed(3):'—'} · margin ${Number.isFinite(candidate.margin)?candidate.margin.toFixed(3):'—'}`;
    presentSuggestion(observe(candidate,performance.now()));
    cameraStatus.textContent = suggestion ? '画像の候補を「これです」で確認してください' : '候補を絞れませんでした。四隅・背景・反射を確認してもう一度お試しください。';
  } catch (error) { if (generation === scanGeneration) cameraStatus.textContent = errorText(error, '画像を認識できません。'); }
}
document.addEventListener('visibilitychange', () => { if (document.hidden) stopCamera('背景に移動したため停止しました。カメラでスキャンから再開できます。'); });
window.addEventListener('pagehide', () => { stopCamera(); recognizer.dispose(); modelReady = false; });
stop.disabled = true;

function openCard(card: PokeCard, origin: string, reveal = true, live = false): void {
  if (!live) stopCamera('カメラは停止中 · カード情報を表示しています');
  source = origin; void session.select(card);
  result.hidden = false; renderResult();
  if (reveal) showDrawer('result');
}
let source = '';
function renderResult(): void {
  const value = session.value; const c = value.card; if (!c) { referenceImage.clear(); result.hidden = true; result.replaceChildren(); return; }
  result.hidden = false; const scrollPosition = drawerBody.scrollTop; const nodes: HTMLElement[] = [];
  const focused = result.contains(document.activeElement) ? document.activeElement as HTMLElement : null;
  const focusText = focused && ['BUTTON', 'SUMMARY'].includes(focused.tagName) ? focused.textContent : null;
  const view = candidateView(c);
  const heading = el('div', '', 'result-heading'); const identityBox = el('div', '', 'identity');
  const meta = el('p', '', 'small meta'); meta.append(...metaNodes(view));
  identityBox.append(el('h2', view.name), el('p', view.expansion, 'small muted'), meta, el('p', source, 'eyebrow'), button('スキャンに戻る', () => {
    closeDrawer(); start.focus({ preventScroll: true });
  }));
  referenceImage.update(c); heading.append(referenceImage.node, identityBox); nodes.push(heading);
  const priceBox = el('div', '', 'price-box');
  // Late FX can remove a wrapped status line. Retain the measured price region
  // so even a reader at document bottom keeps their exact position.
  const previousPriceHeight = result.querySelector('.price-box')?.getBoundingClientRect().height;
  if (previousPriceHeight) priceBox.style.minHeight = `${previousPriceHeight}px`;
  const {summary, disclaimer, details} = priceNodes(value);
  priceBox.append(...summary, disclaimer);
  const priceDetails = el('details', '', 'price-details'); priceDetails.open = result.querySelector<HTMLDetailsElement>('.price-details')?.open ?? false; priceDetails.append(el('summary', '価格・為替の出典と日時'), ...details);
  priceBox.append(priceDetails, button('価格・為替を再確認', () => { void session.select(c); }));
  nodes.push(priceBox, button('次のカードをスキャン', () => { void startCamera(); }, 'primary'));
  const link = el('a', view.hare2.label, 'hare2-link'); link.href = view.hare2.href; link.target = '_blank'; link.rel = 'noopener noreferrer';
  nodes.push(link, el('p', '晴れる屋2は検索ページへのリンクのみです。価格や内容はこのアプリでは取得・表示しません。', 'small muted'));
  result.replaceChildren(...nodes);
  if (focusText !== null) [...result.querySelectorAll<HTMLElement>('button, summary')].find(node => node.textContent === focusText)?.focus({ preventScroll: true });
  drawerBody.scrollTop=scrollPosition;
  mark('result-render');
}
mark('shell-ready');
