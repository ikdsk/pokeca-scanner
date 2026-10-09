import './ui/style.css';
import { el, button, label } from './ui/dom.js';
import { closeIconButton } from './ui/close-button.js';
import { cameraIcon, gearIcon, upArrowIcon } from './ui/icons.js';
import { renderCardText } from './ui/card-text.js';
import { resolveCard, candidateTcgdexId, type PokeCard } from './data/pokemon.js';
import { createTcgplayerPrice } from './data/tcgplayer-price.js';
import { FxProvider } from './data/fx.js';
import { ScanHistory } from './ui/scan-history-model.js';
import { ScanHistoryView } from './ui/scan-history.js';
import { ReferenceImage } from './ui/reference-image.js';
import { PriceSession } from './ui/price-session.js';
import { priceView } from './ui/price-view.js';
import { candidateView, thumbnailUrls } from './ui/candidate-view.js';
import { withPrintedRarity } from './domain/rarity.js';
import { createSnapshotLoader } from './ui/snapshot-loader.js';
import { CardIdentity } from './ui/card-identity.js';
import { RearmTracker } from './ui/rearm.js';
import { alternativeCandidates, type AlternativeCandidate, type ResolvedMatch } from './ui/alternative-candidates.js';
import { sameCardProducts } from './ui/same-card-products.js';
import { Recognizer, type RecognitionResult, type TopMatch } from './recognition/adapter.js';
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
const overlay = new DetectionOverlay(overlayCanvas, video);
const cameraIntro = el('div', '', 'camera-intro');
cameraIntro.append(el('h2', 'ポケカスキャナー'), el('p', 'ポケモンカードをかざして、日本語情報や参考価格を確認。'), el('p', '結果をタップすると詳細が開きます。残したいカードは「履歴に保存」。', 'small'));
// Points up at the scan button; shown exactly when the intro is (camera stopped).
const startHint = el('div', '', 'start-hint'); startHint.append(upArrowIcon(), el('span', 'タップしてスタート！'));
function showIntro(visible: boolean): void { cameraIntro.hidden = !visible; startHint.hidden = !visible; }
guide.hidden = true; viewport.append(video, overlayCanvas, guide, cameraIntro);
const cameraStatus = el('p', 'カメラは停止中', 'status camera-status'); cameraStatus.setAttribute('role', 'status');
const modelStatus = el('p', '認識データを準備中', 'muted small'); modelStatus.setAttribute('role', 'status');
const scanActions = el('div', '', 'actions');
const start = button('', () => { if (active) stopCamera('カメラを停止しました'); else void startCamera(); }, 'primary scan-toggle');
const scanLabel = el('span', 'スキャン開始'); start.append(cameraIcon(), scanLabel);
const modelRetry = button('認識の準備を再試行', () => { invalidatePreparation(); const generation = scanGeneration; void prepare().then(ok => { if (ok && active && generation === scanGeneration) void loop(generation); }); }); modelRetry.hidden = true;
const file = el('input'); file.type = 'file'; file.accept = 'image/*'; file.id = 'local-image';
const fileLabel = label('端末の画像でスキャン', file); fileLabel.className = 'file-button';
scanActions.append(start, modelRetry);
const cameraInfo = el('div', '', 'camera-info'); cameraInfo.append(cameraStatus, modelStatus);
scan.append(viewport, cameraInfo);
const imagePanel = el('section', '', 'panel image-panel'); imagePanel.append(el('h2', '端末の画像でスキャン'), el('p', '画像は端末内だけで処理し、外部へ送信しません。', 'small muted'));
const footer = el('footer');
footer.append(el('p', '海外参考価格 · 国内販売・買取価格ではありません。自動認識は候補です。実物のカード（版・状態）を確認してください。'));
const sources = el('p');
for (const [name, href] of [['TCGdex', 'https://tcgdex.dev'], ['TCGplayer（TCGCSV経由）', 'https://tcgcsv.com'], ['Frankfurter / ECB', 'https://frankfurter.dev'], ['CollectorVision', 'https://github.com/HanClinto/CollectorVision']]) {
  const a = el('a', name); a.href = href!; a.target = '_blank'; a.rel = 'noopener noreferrer'; sources.append(a, document.createTextNode(' · '));
}
footer.append(sources, el('p', 'このアプリと認識コード・モデルはAGPL-3.0でライセンスされています。ポケモンカードの権利は株式会社ポケモン等の権利者に帰属します。', 'small'));
const notices = el('a', '第三者ライセンスと利用条件'); notices.href = '/recognition/THIRD-PARTY-NOTICES.md'; footer.append(notices);
const privacy = el('details'); privacy.append(el('summary', '通信・プライバシーの詳細'), el('p', '候補カードのセット名・番号をTCGdex（api.tcgdex.net）に送信し、参照画像はassets.tcgdex.netから取得します。価格はTCGCSV由来のスナップショットをこのアプリ自身の配信元（/prices/pokemon-japan-usd.json）から読み込み、価格取得のために外部へ送信しません。USD/JPYの通貨ペアをFrankfurterに送信します。認識用のコード・モデル・辞書はjsDelivr、Hugging Face、CollectorVisionCatalogから取得します。提供元には通常の通信情報が渡ります。晴れる屋2はリンクをタップするまで通信せず、価格や内容の取得・保存・再表示はしません。撮影・選択画像は保存・送信せず、解析ログはこのタブのメモリ内のみです。分析サービスへの送信はありません。'));
footer.append(privacy);
const debug = el('details'); debug.append(el('summary', '端末内の計測ログ')); const debugOutput = el('pre');
debug.append(button('計測を表示', () => { debugOutput.textContent = JSON.stringify(marks, null, 2); }), debugOutput); footer.append(debug);
const information = el('details', '', 'information'); information.id = 'information'; information.append(el('summary', '情報・プライバシー'), el('p', '画像は端末内だけで処理します。初回は認識データ約17MBと実行環境をダウンロードします。'), footer);
const settingsButton = button('', () => showDrawer('settings'));
settingsButton.setAttribute('aria-label', '情報・設定'); settingsButton.title = '情報・設定';
settingsButton.append(gearIcon(), el('span', '情報・設定', 'sr-only')); header.append(settingsButton);
const actionPanel = el('section', '', 'action-panel'); actionPanel.append(scanActions, startHint);
const tentativePanel = el('aside', '', 'tentative'); tentativePanel.hidden = true; tentativePanel.setAttribute('aria-label', '認識候補');
const tentativeExpansion = el('p', '', 'small expansion'); const tentativeMeta = el('p', '', 'meta'); const tentativePrice = el('div', '', 'candidate-price'); const tentativeReference = new ReferenceImage();
const tentativeName = el('strong', '', 'candidate-name'); const tentativeScore = el('span', '', 'score small');
const tentativeMessage = el('p', '', 'candidate-message'); tentativeMessage.setAttribute('role', 'status'); const announcement = el('span', '', 'sr-only'); announcement.setAttribute('role', 'status');
const tentativeLink = el('a', '', 'hare2-link'); tentativeLink.target = '_blank'; tentativeLink.rel = 'noopener noreferrer';
const confirm = button('履歴に保存', () => confirmSuggestion()); const alternativesButton = button('他の候補', () => openAlternatives());
const tentativeNameLine = el('div', '', 'name-line'); tentativeNameLine.append(tentativeName);
const tentativeContent = el('div'); tentativeContent.append(tentativeNameLine, tentativeExpansion, tentativeMeta);
const tentativeActions = el('div', '', 'actions'); tentativeActions.append(confirm, alternativesButton);
const tentativeSummary = el('div', '', 'candidate-summary'); tentativeSummary.append(tentativeReference.node, tentativeContent);
const tentativeDetails = el('div', '', 'candidate-details'); tentativeDetails.id = 'candidate-details'; tentativeDetails.setAttribute('aria-label', '候補の詳細'); tentativeDetails.setAttribute('role', 'region'); tentativeDetails.tabIndex = 0;
const tentativeSources = el('div', '', 'candidate-sources');
const productsSection = el('section', '', 'same-card-products');
const nameDetails = button('', () => openCandidateDetail(), 'candidate-name-target'); nameDetails.setAttribute('aria-label', 'カード名から詳細を見る');
const imageDetails = button('', () => openCandidateDetail(), 'candidate-image-target'); imageDetails.setAttribute('aria-label', '画像から詳細を見る');
tentativeSummary.append(nameDetails, imageDetails, tentativePrice);
// Detail order: status message, price sources, 晴れる屋2 link, other products of the same card.
const cardTextSlot = el('div', '', 'card-text-slot');
tentativeDetails.append(tentativeMessage, tentativeSources, tentativeLink, cardTextSlot);
tentativePanel.append(tentativeSummary, tentativeActions, tentativeDetails, announcement);
const resolveStatus = el('p', '', 'small muted'); resolveStatus.setAttribute('role', 'status'); cameraInfo.append(resolveStatus);
const settingsPanel = el('details', '', 'recognition-settings'); settingsPanel.append(el('summary', '認識設定（デバッグ）'), el('p', 'このタブのみ。再読み込みで初期値に戻ります。類似度は未較正の cosine 値で、確率ではありません。', 'small'));
let settings: RecognitionSettings = { ...defaults }; let evidenceRevision = 0;
const settingsInputs = new Map<keyof RecognitionSettings, HTMLInputElement>();
const settingNames: Record<keyof RecognitionSettings, string> = { tentativeScore: '提案の類似度', delayMs: '推論完了後の待ち時間 (ms)', rearmCount: '同じカードの再受付に必要な不在観測数', rearmMs: '不在の最小継続時間 (ms)', overlayMs: '四隅の表示期限 (ms)' };
const settingsError = el('p', '', 'small'); settingsError.setAttribute('role', 'status');
for (const key of Object.keys(defaults) as (keyof RecognitionSettings)[]) {
  const input = el('input'); input.type = 'number'; const [min, max, step] = bounds[key]; input.min = String(min); input.max = String(max); input.step = String(step); input.value = String(settings[key]); input.setAttribute('aria-label', settingNames[key]); settingsInputs.set(key, input);
  input.addEventListener('change', () => { const next = { ...settings, [key]: input.valueAsNumber }; if (!validateSettings(next)) { settingsError.textContent = '有限の範囲内の値を指定してください。観測数と時間は整数です。'; input.value = String(settings[key]); return; } applySettings(next); });
  settingsPanel.append(label(`${settingNames[key]} · 初期値 ${defaults[key]} · ${min}〜${max}`, input));
}
settingsPanel.append(button('認識設定を初期値に戻す', () => applySettings({ ...defaults })), settingsError);
const history = new ScanHistory();
// History reuses the candidate detail sheet, read-only: no scan event, no camera restart.
const historyView = new ScanHistoryView(entry => openStaticCard(entry.card, 'スキャン履歴から表示 · 読み取り専用', '履歴を表示中 · カメラは停止しています'), history.limit);
// The camera and dock are the two visual-viewport rows. Auxiliary routes are
// modal overlay windows; the ordinary candidate dock stays nonmodal.
const candidateDock = el('section', '', 'candidate-dock');
const idleText = 'カードをかざすと情報が表示されます。保存は任意です。';
const emptyCandidate = el('p', idleText, 'empty-candidate small');
const candidateDetail = el('dialog', '', 'candidate-detail-sheet'); candidateDetail.id = 'candidate-detail-sheet';
for (const control of [nameDetails, imageDetails]) { control.setAttribute('aria-controls', candidateDetail.id); control.setAttribute('aria-haspopup', 'dialog'); control.setAttribute('aria-expanded', 'false'); }
candidateDetail.setAttribute('aria-label', 'カードの詳細'); candidateDetail.setAttribute('aria-modal', 'true');
const detailHeader = el('div', '', 'detail-sheet-header'); const detailClose = closeIconButton(() => closeCandidateDetail()); detailHeader.append(el('h2', 'カードの詳細'), detailClose);
const detailBody = el('div', '', 'detail-sheet-body'); candidateDetail.append(detailHeader, detailBody);
let detailTrigger: HTMLElement | null = null;
let queuedVerified: { next: Suggestion; card: PokeCard } | null = null;
let savedVersion: number | null = null; let savedCardId: string | null = null;
let feedbackTimer: ReturnType<typeof setTimeout> | null = null;
// A live replacement is held while the sheet or the candidate list presents a frozen card.
function holdLive(): boolean { return candidateDetail.open || (drawer.open && activeRoute === 'alternatives'); }
function flushQueued(): void {
  const queued = queuedVerified; queuedVerified = null;
  if (queued) { const pending = loadingSuggestion; commitSuggestion(queued.next, queued.card); loadingSuggestion = pending; }
}
function openCandidateDetail(): void {
  if (!shown || candidateDetail.open) return;
  for (const control of [nameDetails, imageDetails]) control.setAttribute('aria-expanded', 'true');
  detailTrigger = document.activeElement as HTMLElement; nameDetails.hidden = true; imageDetails.hidden = true; detailBody.append(tentativePanel); tentativePanel.hidden = false; tentativeDetails.hidden = false;
  candidateDetail.showModal(); scan.inert = true; candidateDock.inert = true; detailClose.focus({ preventScroll: true });
}
function closeCandidateDetail(): void {
  if (!candidateDetail.open) return;
  for (const control of [nameDetails, imageDetails]) control.setAttribute('aria-expanded', 'false');
  candidateDetail.close(); nameDetails.hidden = false; imageDetails.hidden = false; tentativeDetails.hidden = true; candidateDock.insertBefore(tentativePanel, navigation); scan.inert = false; candidateDock.inert = false;
  // A history view owns no live suggestion: leave nothing behind in the dock.
  if (staticView) { staticView = false; hideSuggestion(); }
  flushQueued();
  if (detailTrigger?.isConnected) detailTrigger.focus({ preventScroll: true }); detailTrigger = null;
}
candidateDetail.addEventListener('cancel', event => { event.preventDefault(); closeCandidateDetail(); });
candidateDetail.addEventListener('keydown', event => {
  if (event.key !== 'Tab') return;
  const controls = [...candidateDetail.querySelectorAll<HTMLElement>('button,a[href],[tabindex]')].filter(n => n.tabIndex >= 0 && !n.matches(':disabled') && n.checkVisibility({ visibilityProperty: true }));
  const first = controls[0], last = controls.at(-1); if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
});
// Downward swipe on the header (not the scrolling body) closes the sheet.
let swipe: { id: number; x: number; y: number } | null = null;
detailHeader.addEventListener('pointerdown', event => { if ((event.target as Element).closest('button') || !event.isPrimary) return; swipe = { id: event.pointerId, x: event.clientX, y: event.clientY }; detailHeader.setPointerCapture(event.pointerId); });
detailHeader.addEventListener('pointerup', event => { const begun = swipe; swipe = null; if (begun?.id === event.pointerId && event.clientY - begun.y >= 60 && Math.abs(event.clientX - begun.x) < Math.abs(event.clientY - begun.y)) closeCandidateDetail(); });
detailHeader.addEventListener('pointercancel', () => { swipe = null; });
const navigation = el('nav', '', 'panel-navigation'); navigation.setAttribute('aria-label', 'スキャナーの機能');
const drawer = el('dialog', '', 'utility-drawer'); drawer.setAttribute('aria-modal', 'true'); drawer.setAttribute('aria-label', 'スキャナーの補助画面');
const drawerHeading = el('h2'); drawerHeading.id = 'drawer-heading'; drawer.setAttribute('aria-labelledby', drawerHeading.id);
const drawerBar = el('div', '', 'drawer-bar'); const drawerClose = closeIconButton(() => closeDrawer()); drawerBar.append(drawerHeading, drawerClose);
const drawerBody = el('div', '', 'drawer-body'); const historyRoute = el('div'); historyRoute.append(el('p', '保存したスキャンはまだありません。', 'empty-history'), historyView.node);
const settingsRoute = el('div'); settingsRoute.append(settingsPanel, information);
imagePanel.append(fileLabel);
// 他の候補: the frozen list of recognition matches that resolve to a Japanese card.
const alternativesRoute = el('div'); const alternativesList = el('ol', '', 'alternative-list'); const alternativesStatus = el('p', '', 'small muted'); alternativesStatus.setAttribute('role', 'status');
alternativesRoute.append(el('p', '類似度の近い候補です。選ぶと、そのカードを表示します。', 'small muted'), alternativesStatus, alternativesList);
const routes = { image: imagePanel, history: historyRoute, settings: settingsRoute, alternatives: alternativesRoute };
const routeNames = { image: '画像', history: '履歴', settings: '設定', alternatives: '他の候補' };
let activeRoute: keyof typeof routes | null = null;
let drawerTrigger: HTMLElement | null = null;
for (const route of Object.keys(routes) as (keyof typeof routes)[]) {
  if (route === 'image' || route === 'history') { const control = button(routeNames[route], () => showDrawer(route)); control.setAttribute('aria-controls', 'utility-drawer'); control.setAttribute('aria-expanded', 'false'); control.dataset.route = route; navigation.append(control); }
  routes[route].classList.add('drawer-route'); routes[route].dataset.route = route; drawerBody.append(routes[route]);
}
drawer.id = 'utility-drawer'; drawer.append(drawerBar, drawerBody);
candidateDock.append(emptyCandidate, tentativePanel, navigation);
viewport.append(header, actionPanel, cameraInfo); scan.replaceChildren(viewport); app.append(scan, candidateDock, drawer, candidateDetail);
tentativeDetails.hidden = true;
function showDrawer(route: keyof typeof routes): void {
  closeCandidateDetail();
  if (!drawer.open) drawerTrigger = document.activeElement as HTMLElement;
  drawerHeading.textContent = routeNames[route];
  for (const [key, node] of Object.entries(routes)) node.classList.toggle('route-active', key === route);
  for (const control of navigation.querySelectorAll<HTMLButtonElement>('button')) control.setAttribute('aria-expanded', String(control.dataset.route === route));
  historyRoute.querySelector<HTMLElement>('.empty-history')!.hidden = history.allEntries.length > 0; information.open = route === 'settings'; drawerBody.scrollTop = 0;
  activeRoute = route;
  if (!drawer.open) { drawer.showModal(); scan.inert = true; candidateDock.inert = true; }
  drawerClose.focus({ preventScroll: true });
}
function closeDrawer(keepQueued = false): void {
  if (!drawer.open) return;
  const wasAlternatives = activeRoute === 'alternatives'; activeRoute = null; alternativesRevision++;
  drawer.close(); scan.inert = false; candidateDock.inert = false;
  for (const control of navigation.querySelectorAll('button')) control.setAttribute('aria-expanded', 'false');
  if (drawerTrigger?.isConnected && !drawerTrigger.closest('[inert]')) drawerTrigger.focus({ preventScroll: true });
  drawerTrigger = null;
  if (wasAlternatives && !keepQueued) flushQueued();
}
drawer.addEventListener('cancel', event => { event.preventDefault(); closeDrawer(); });
function revealDrawerFocus(): void {
  const focused = document.activeElement;
  if (!drawer.open || !(focused instanceof HTMLElement) || !drawerBody.contains(focused)) return;
  const field = focused.getBoundingClientRect(), body = drawerBody.getBoundingClientRect();
  if (field.bottom > body.bottom - 8) drawerBody.scrollTop += Math.ceil(field.bottom - body.bottom + 8);
  else if (field.top < body.top + 8) drawerBody.scrollTop -= Math.ceil(body.top - field.top + 8);
}

// Keep endpoint Tab navigation in the window, including Chromium's browser-chrome
// tab stop. Native modal behavior supplies the background inertness and Escape.
drawer.addEventListener('keydown', event => {
  if (event.key !== 'Tab') return;
  const controls = [...drawer.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href],summary,[tabindex]')].filter(node => node.tabIndex >= 0 && !node.matches(':disabled') && node.checkVisibility({ visibilityProperty: true }));
  const first = controls[0], last = controls.at(-1); if (!first || !last) return;
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus({ preventScroll: true }); revealDrawerFocus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus({ preventScroll: true }); }
});

// visualViewport handles browser bars and the software keyboard without page jumps.
function fitViewport(): void {
  const visual = window.visualViewport; const height = visual?.height ?? window.innerHeight; const width = visual?.width ?? window.innerWidth;
  app.classList.toggle('compact-viewport', height <= 550); app.classList.toggle('short-viewport', height <= 400);
  app.style.height = `${height}px`; app.style.top = `${visual?.offsetTop ?? 0}px`; app.style.left = `${visual?.offsetLeft ?? 0}px`; app.style.width = `${width}px`;
  for (const dialogNode of [drawer, candidateDetail]) {
    dialogNode.style.setProperty('--window-height', `${height}px`); dialogNode.style.setProperty('--window-width', `${width}px`);
    dialogNode.style.setProperty('--window-top', `${visual?.offsetTop ?? 0}px`); dialogNode.style.setProperty('--window-left', `${visual?.offsetLeft ?? 0}px`);
  }
  if (drawer.open) requestAnimationFrame(revealDrawerFocus);
}
fitViewport(); window.addEventListener('resize', fitViewport); window.visualViewport?.addEventListener('resize', fitViewport); window.visualViewport?.addEventListener('scroll', fitViewport);

let stream: MediaStream | null = null; let scanGeneration = 0; let active = false; let modelReady = false;
let preparationGeneration = 0;
let preparation: Promise<boolean> | null = null;
let frameBusy = false; let loopTimer: ReturnType<typeof setTimeout> | null = null;
const tentative = new LiveCandidate();
// Different TCGplayer products (e.g. Poke Ball Pattern) can be the same Japanese card.
const identity = new CardIdentity();
const rearm = new RearmTracker(settings.rearmCount, settings.rearmMs);
// Canonical ids the user already answered; cleared when the card leaves the view.
const handled = new Set<string>();
// Catalog metadata and the worker's top matches per observed id; lookups run once per candidate and are cached.
const metaById = new Map<string, { set: unknown; collector_number: unknown }>();
const matchesById = new Map<string, TopMatch[]>();
const cardInfo = new CandidateMetadata<PokeCard | null>((id: string, signal: AbortSignal) => resolveCard(id, metaById.get(id) ?? {}, signal));
const quoteFor = (id: string, signal: AbortSignal) => prices.quote(id, undefined, signal);
const candidatePrice = new PriceSession(quoteFor, signal => fx.latest(signal), renderCandidatePrice);
let loadingSuggestion: Suggestion | null = null;
let suggestion: Suggestion | null = null; let suggestionCard: PokeCard | null = null; let suggestionMatches: TopMatch[] = [];
// The card currently rendered in the panel: the recognized card until the reader picks another
// candidate; a history view (staticView) has no suggestion.
let shown: PokeCard | null = null; let shownScore = 0;
let staticView = false; let viewRevision = 0; let alternativesRevision = 0;
let lastAnnouncement = -Infinity;
type ActivationGesture = { snapshot: Suggestion | null; key: string | null };
const gestures = new Map<HTMLButtonElement, ActivationGesture>();
function captureGesture(control: HTMLButtonElement, key: string | null): void {
  gestures.set(control, { snapshot: suggestion ? Object.freeze({ ...suggestion }) : null, key });
}
function activationSnapshot(control: HTMLButtonElement): Suggestion | null {
  const gesture = gestures.get(control);
  if (!gesture) return suggestion; // Deliberate click / assistive activation without a down event.
  if (gesture.key === null) gestures.delete(control);
  return gesture.snapshot;
}
for (const control of [confirm, alternativesButton]) {
  control.addEventListener('pointerdown', () => captureGesture(control, null));
  control.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    if (event.repeat || gestures.get(control)?.key) return;
    captureGesture(control, event.key);
    if (event.key === 'Enter') control.click();
  });
  control.addEventListener('keyup', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    const gesture = gestures.get(control);
    if (gesture?.key === event.key) {
      if (event.key === ' ' && gesture.snapshot) control.click();
      gestures.delete(control);
    }
  });
  const cancel = () => { const gesture = gestures.get(control); if (gesture) { gesture.snapshot = null; gesture.key = null; } };
  control.addEventListener('blur', cancel); control.addEventListener('pointercancel', cancel);
  window.addEventListener('blur', cancel);
  // Release can occur after focus left the button. Never reuse that canceled gesture.
  document.addEventListener('keyup', event => { if (gestures.get(control)?.key === event.key) gestures.delete(control); });
}
function hideSuggestion(): void {
  if (holdLive()) return;
  queuedVerified = null; loadingSuggestion = null; viewRevision++; cardInfo.cancelExcept(null);
  suggestion = null; suggestionCard = null; suggestionMatches = []; shown = null; staticView = false;
  candidatePrice.reset(); tentativeReference.clear(); tentativeReference.node.remove(); productsSection.remove(); productsSection.replaceChildren();
  tentativeActions.hidden = false; tentativeScore.hidden = false; tentativePanel.hidden = true; emptyCandidate.hidden = false; emptyCandidate.textContent = idleText; showIntro(!active);
}
function applySettings(next: RecognitionSettings): void {
  settings = { ...next }; evidenceRevision++;
  tentative.reset(settings.tentativeScore, settings.rearmCount, settings.rearmMs); rearm.configure(settings.rearmCount, settings.rearmMs); hideSuggestion(); overlay.clear(); overlay.staleMs = settings.overlayMs;
  for (const [key, input] of settingsInputs) input.value = String(settings[key]); settingsError.textContent = '設定を適用しました。新しい観測から使用します。';
}
function rememberMeta(candidate: RecognitionResult, raw: string | null): void {
  if (!raw) return;
  metaById.set(raw, { set: candidate.catalogMeta?.set, collector_number: candidate.catalogMeta?.collectorNumber });
  while (metaById.size > 50) metaById.delete(metaById.keys().next().value!);
  matchesById.set(raw, candidate.topMatches ?? []);
  while (matchesById.size > 50) matchesById.delete(matchesById.keys().next().value!);
}
// TCGplayer rarity per recognized product id (catalogMeta); a product without meta is absent -> no rarity shown.
const rarityByProduct = new Map<string, string | null>();
function rememberRarity(cardId: string | null | undefined, meta: { rarity: string | null } | null | undefined): void {
  if (!cardId || !meta) return;
  rarityByProduct.delete(cardId); rarityByProduct.set(cardId, meta.rarity);
  while (rarityByProduct.size > 300) rarityByProduct.delete(rarityByProduct.keys().next().value!);
}
// The UI never shows the TCGdex rarity: the card carries the printed symbol of its own product instead.
const withProductRarity = (card: PokeCard): PokeCard => withPrintedRarity(card, rarityByProduct.get(card.tcgplayerId));
// Maps the observed product id to the displayed card's identity before the live-candidate gate sees it.
function observe(candidate: RecognitionResult, now: number): Suggestion | null {
  const raw = candidate.cardId;
  rememberRarity(raw, candidate.catalogMeta); for (const match of candidate.topMatches ?? []) rememberRarity(match.cardId, match.catalogMeta);
  if (candidate.cardPresent === false) { if (rearm.observe(false, now)) handled.clear(); } else rearm.observe(true, now);
  if (!raw) return tentative.observe({ ...candidate }, now);
  const canonical = identity.canonical(raw);
  rememberMeta(candidate, raw); if (!metaById.has(canonical)) rememberMeta(candidate, canonical);
  return tentative.observe({ ...candidate, cardId: canonical }, now);
}
// A topMatch resolved to a Japanese card once; unresolved matches stay null and are never displayed.
const matchCards = new Map<string, Promise<PokeCard | null>>();
function resolveMatch(match: TopMatch): Promise<PokeCard | null> {
  let known = matchCards.get(match.cardId);
  if (!known) {
    known = resolveCard(match.cardId, { set: match.catalogMeta?.set, collector_number: match.catalogMeta?.collectorNumber }).catch(() => null);
    matchCards.set(match.cardId, known); while (matchCards.size > 60) matchCards.delete(matchCards.keys().next().value!);
  }
  return known;
}
const resolveAll = (matches: readonly TopMatch[]): Promise<ResolvedMatch[]> => Promise.all(matches.map(async match => ({ cardId: match.cardId, score: match.score, card: await resolveMatch(match).then(card => card && withProductRarity(card)) })));
function cardInfoErrorText(error: Error): string {
  const retry = 'カードを一度外してもう一度かざしてください。';
  if (error.name === 'TimeoutError') return `通信がタイムアウトしました。電波の良い場所で、${retry}`;
  if (error instanceof TypeError) return `通信に失敗しました。接続を確認し、${retry}`;
  return `カード情報を取得できません。通信を確認し、${retry}`;
}
// #16: when the top product has no Japanese card, show the best of the next top matches (cap 5) that has one,
// with that product's own id/score. The returned `shown` keeps the observation's version/identity.
async function resolveSuggestion(next: Suggestion): Promise<{ shown: Suggestion; known: PokeCard | null }> {
  const known = await cardInfo.get(next.cardId);
  if (known) return { shown: next, known };
  const matches = matchesById.get(next.cardId) ?? [];
  const others = matches.slice(0, 5).filter(match => match.cardId !== next.cardId);
  const cards = await Promise.all(others.map(resolveMatch));
  const index = cards.findIndex(card => card !== null);
  if (index < 0) return { shown: next, known: null };
  const match = others[index]!; matchesById.set(match.cardId, matches);
  return { shown: { ...next, cardId: match.cardId, score: match.score }, known: cards[index]! };
}
function presentSuggestion(next: Suggestion | null): void {
  // Sticky: nothing observed ever clears a shown card; only a newer verified card replaces it.
  if (!next) return;
  if (suggestion?.version === next.version) {
    // The score must belong to the displayed product: after a fallback, `suggestion.cardId` is not the observed top id.
    const score = next.cardId === suggestion.cardId ? next.score : matchesById.get(next.cardId)?.find(match => match.cardId === suggestion!.cardId)?.score;
    if (shown === suggestionCard && score !== undefined) tentativeScore.textContent = `類似度 ${score.toFixed(3)}`;
    return;
  }
  if (loadingSuggestion?.version === next.version || queuedVerified?.next.version === next.version) return;
  loadingSuggestion = next; cardInfo.cancelExcept(next.cardId); resolveStatus.textContent = '';
  if (!suggestion) { emptyCandidate.hidden = false; emptyCandidate.textContent = 'カード情報を確認中…'; }
  const settle = (note: string) => {
    // Never display (or evict the shown card for) a candidate that has no Japanese card.
    const canonical = identity.canonical(next.cardId); tentative.dismiss({ ...next, identity: canonical }); handled.add(canonical);
    if (loadingSuggestion?.version === next.version) loadingSuggestion = null;
    resolveStatus.textContent = note; if (!suggestion) emptyCandidate.textContent = idleText;
  };
  void resolveSuggestion(next).then(({ shown: view, known }) => {
    if (loadingSuggestion?.version !== next.version || !tentative.current(next)) return;
    const card = known && withProductRarity(known);
    if (!card) { settle('カード情報を確認できない候補は表示しません（TCGdexに未登録のカードの可能性）'); return; }
    const canonical = identity.learn(view.cardId, card.tcgdexId);
    // Same displayed card under another product id: adopt silently, no flicker and no new proposal.
    if (suggestionCard?.tcgdexId === card.tcgdexId) {
      suggestion = view; loadingSuggestion = null;
      // A rearmed (re-presented) card can be saved again; another product id of a saved card cannot.
      if (canonical !== view.cardId && savedVersion !== null) savedVersion = view.version;
      if (canonical === view.cardId && savedVersion !== null && !staticView) { savedVersion = null; savedCardId = null; confirm.textContent = '履歴に保存'; tentativeMessage.textContent = '実物のカード（版・状態）は未確認'; }
      return;
    }
    if (canonical !== view.cardId && handled.has(canonical)) { settle(''); return; }
    if (holdLive()) { queuedVerified = { next: view, card }; loadingSuggestion = null; return; }
    commitSuggestion(view, card);
  }).catch((error: unknown) => {
    const failure = error instanceof Error ? error : new Error(String(error));
    mark('card-info-error', { name: failure.name, message: failure.message, tcgdexId: candidateTcgdexId(metaById.get(next.cardId) ?? {}) });
    if (loadingSuggestion?.version === next.version && tentative.current(next)) settle(cardInfoErrorText(failure));
  });
}
function commitSuggestion(next: Suggestion, card: PokeCard): void {
  // Commit the verified card and its UI together; the previous card stays usable until here.
  savedVersion = null; savedCardId = null; suggestion = next; suggestionCard = card; suggestionMatches = matchesById.get(next.cardId) ?? []; loadingSuggestion = null; staticView = false;
  tentativeActions.hidden = false; tentativeScore.hidden = false; shownScore = next.score;
  tentativeReference.clear(); tentativeSummary.prepend(tentativeReference.node);
  tentativeScore.textContent = `類似度 ${next.score.toFixed(3)}`;
  tentativePanel.hidden = false; emptyCandidate.hidden = true; if (performance.now() - lastAnnouncement >= 2000) { announcement.textContent = '候補を確認できます'; lastAnnouncement = performance.now(); }
  showIntro(false); showCard(card);
}
// Render one card into the panel. Shared by live candidates, 他の候補 picks and history views;
// each call supersedes earlier ones (viewRevision).
function showCard(card: PokeCard): void {
  const revision = ++viewRevision; shown = card; const view = candidateView(card);
  candidatePrice.reset(); tentativeSources.replaceChildren(); tentativePrice.replaceChildren(); productsSection.remove(); productsSection.replaceChildren();
  if (!staticView) { const saved = suggestion !== null && savedVersion === suggestion.version && savedCardId === card.tcgplayerId; confirm.textContent = saved ? '保存しました ✓' : '履歴に保存'; tentativeMessage.textContent = saved ? '保存しました ✓' : '実物のカード（版・状態）は未確認'; }
  tentativeName.textContent = view.name; tentativeNameLine.replaceChildren(tentativeName, ...rarityNodes(view)); tentativeExpansion.textContent = view.expansion;
  tentativeMeta.replaceChildren(...metaNodes(view), tentativeScore);
  tentativeReference.update(card); tentativeLink.textContent = view.hare2.label; tentativeLink.href = view.hare2.href; tentativeLink.hidden = false;
  cardTextSlot.replaceChildren(renderCardText(card.text));
  void candidatePrice.select(card);
  if (!staticView) void loadProducts(card, suggestionMatches, revision);
}
// The printed rarity sits right after the card name (nothing when the product has none).
function rarityNodes(view: ReturnType<typeof candidateView>): HTMLElement[] {
  if (!view.rarity) return [];
  const badge = el('span', view.rarity.label, 'rarity-badge'); badge.setAttribute('aria-label', view.rarity.aria); badge.title = view.rarity.aria; return [badge];
}
function metaNodes(view: ReturnType<typeof candidateView>): HTMLElement[] {
  const nodes: HTMLElement[] = [];
  if (view.regulation) { const badge = el('span', view.regulation.label, 'regulation-badge'); badge.setAttribute('aria-label', view.regulation.aria); badge.title = view.regulation.aria; nodes.push(badge); }
  return nodes;
}
// 同じカードの別商品: other TCGplayer products of the displayed TCGdex card, each with its own USD price.
async function loadProducts(card: PokeCard, matches: readonly TopMatch[], revision: number): Promise<void> {
  const sameCard = matches.filter(match => match.cardId !== card.tcgplayerId && candidateTcgdexId({ set: match.catalogMeta?.set, collector_number: match.catalogMeta?.collectorNumber }) === card.tcgdexId);
  if (!sameCard.length) return;
  const products = sameCardProducts(card, await resolveAll(sameCard));
  if (!products.length || revision !== viewRevision) return;
  const rate = await fx.latest().then(value => ({ value, failed: false }), () => ({ value: null, failed: true }));
  const rows = await Promise.all(products.map(async product => {
    const quotes = await prices.quote(product.tcgplayerId).then(value => ({ value, failed: false }), () => ({ value: [], failed: true }));
    const view = priceView({ status: quotes.failed ? 'error' : 'ready', quotes: quotes.value, variant: null, fx: rate.value, fxError: rate.failed });
    const row = el('li', '', 'same-card-product'); row.append(el('strong', product.label), el('span', view.headline, 'price'));
    if (view.usd) row.append(el('span', view.usd, 'usd')); return row;
  }));
  if (revision !== viewRevision) return;
  const list = el('ul', '', 'same-card-product-list'); list.append(...rows);
  productsSection.replaceChildren(el('h3', '同じカードの別商品'), list, el('p', '海外参考価格（TCGplayer）· 国内販売・買取価格ではありません', 'small muted'));
  tentativeDetails.append(productsSection);
}
// History: the candidate sheet without a live suggestion or save.
function openStaticCard(card: PokeCard, origin: string, cameraMessage: string): void {
  stopCamera(cameraMessage); closeDrawer();
  staticView = true; tentativeActions.hidden = true; tentativeScore.hidden = true;
  tentativeReference.clear(); tentativeSummary.prepend(tentativeReference.node);
  tentativePanel.hidden = false; showCard(card); tentativeMessage.textContent = origin;
  openCandidateDetail();
}
function priceNodes(state: PriceSession['value']): { summary: HTMLElement[]; disclaimer: HTMLElement; details: HTMLElement[] } {
  const view = priceView({ status: state.status, quotes: state.quotes, variant: state.card?.variant ?? null, fx: state.fx, fxError: state.fxError });
  const summary: HTMLElement[] = [el('p', view.heading, 'eyebrow'), el('strong', view.headline, 'price')];
  if (view.usd) summary.push(el('span', view.usd, 'usd'));
  const disclaimer = el('p', view.disclaimer, 'small');
  const details: HTMLElement[] = [];
  if (view.note) details.push(el('p', view.note, 'small'));
  if (view.others.length) details.push(el('p', `他の価格区分：${view.others.join(' / ')}`, 'small muted others'));
  if (view.updatedAt) details.push(el('p', `TCGplayer（TCGCSV経由）· ${view.updatedAt}`, 'small muted'));
  details.push(el('p', view.fxNote, 'small muted'));
  return { summary, disclaimer, details };
}
function renderCandidatePrice(): void {
  const value = candidatePrice.value;
  if (!value.card || value.card.tcgplayerId !== shown?.tcgplayerId) { tentativePrice.replaceChildren(); tentativeSources.replaceChildren(); return; }
  const { summary, disclaimer, details } = priceNodes(value); tentativePrice.replaceChildren(...summary); tentativeSources.replaceChildren(disclaimer, ...details);
}
// 他の候補: freeze the shown card's matches into a list; only matches that resolve to a Japanese card appear.
let alternatives: AlternativeCandidate[] = [];
function openAlternatives(): void {
  const captured = activationSnapshot(alternativesButton); const card = shown;
  if (!captured || suggestion?.version !== captured.version || !card || staticView) return;
  const revision = ++alternativesRevision; const matches = suggestionMatches;
  const current = { cardId: card.tcgplayerId, score: shownScore, card };
  alternatives = alternativeCandidates(current, []); renderAlternatives(); alternativesStatus.textContent = matches.length > 1 ? '候補を確認中…' : ''; showDrawer('alternatives');
  void resolveAll(matches).then(resolved => {
    if (revision !== alternativesRevision || activeRoute !== 'alternatives') return;
    alternatives = alternativeCandidates(current, resolved); alternativesStatus.textContent = ''; renderAlternatives();
  });
}
function renderAlternatives(): void {
  alternativesList.replaceChildren(...alternatives.map(entry => {
    const item = el('li'); const control = button('', () => chooseAlternative(entry), 'alternative-item');
    const view = candidateView(entry.card); const urls = thumbnailUrls(entry.card);
    if (urls.length) { const image = el('img'); image.alt = ''; image.width = 48; image.height = 67; image.decoding = 'async'; image.referrerPolicy = 'no-referrer'; let next = 0; image.onerror = () => { if (++next < urls.length) image.src = urls[next]!; else image.remove(); }; image.src = urls[0]!; control.append(image); }
    const text = el('span', '', 'alternative-text'); const nameLine = el('span', '', 'name-line'); nameLine.append(el('strong', view.name), ...rarityNodes(view));
    text.append(nameLine, el('span', view.expansion, 'small'), el('span', `類似度 ${entry.score.toFixed(3)}${entry.current ? ' · 現在の候補' : ''}`, 'small muted'));
    control.append(text); item.append(control); return item;
  }));
}
function chooseAlternative(entry: AlternativeCandidate): void {
  if (entry.current) { closeDrawer(true); openCandidateDetail(); return; }
  // The pick becomes the displayed card until a newer verified candidate replaces it.
  shownScore = entry.score; tentativeScore.textContent = `類似度 ${entry.score.toFixed(3)}`; showCard(entry.card); closeDrawer();
}
function confirmSuggestion(): void {
  const captured = activationSnapshot(confirm);
  if (!captured || suggestion?.version !== captured.version) return;
  const card = shown; if (!card) { tentativeMessage.textContent = 'カード情報を確認できません。取得完了後に再確認してください。'; return; }
  if (savedVersion === captured.version && savedCardId === card.tcgplayerId) return;
  savedVersion = captured.version; savedCardId = card.tcgplayerId; handled.add(identity.canonical(captured.cardId));
  // Preserve a newer pending B while suppressing the saved stationary A.
  tentative.accepted(captured.identity, true);
  confirm.textContent = '保存しました ✓'; tentativeMessage.textContent = '保存しました ✓'; announcement.textContent = '保存しました ✓';
  if (feedbackTimer) clearTimeout(feedbackTimer);
  feedbackTimer = setTimeout(() => { if (savedVersion === captured.version && savedCardId === card.tcgplayerId) { confirm.textContent = '履歴に保存'; tentativeMessage.textContent = '実物のカード（版・状態）は未確認'; } }, 1800);
  const event = ++acceptedEvent;
  history.accept(event, card); historyView.update(history.allEntries);
}
let acceptedEvent = 0;
const recognizer = new Recognizer(message => { modelStatus.textContent = message; });

function invalidatePreparation(): void {
  preparationGeneration++;
  preparation = null;
  modelReady = false;
  recognizer.dispose();
}
// Idempotent: the startup preload, the camera and local images all share one preparation.
function prepare(): Promise<boolean> {
  if (modelReady) return Promise.resolve(true);
  if (preparation) return preparation;
  const attempt = ++preparationGeneration;
  modelRetry.hidden = true; mark('model-start');
  preparation = (async () => {
    try { await recognizer.init(); if (attempt !== preparationGeneration) return false; modelReady = true; mark('model-ready'); return true; }
    catch (error) { if (attempt !== preparationGeneration) return false; modelReady = false; modelStatus.textContent = errorText(error, '認識データを準備できません。端末の画像で再試行できます。'); modelRetry.hidden = false; mark('model-error'); return false; }
    finally { if (attempt === preparationGeneration) preparation = null; }
  })();
  return preparation;
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
  closeCandidateDetail(); if (drawer.open && activeRoute === 'alternatives') closeDrawer(true);
  scanGeneration++; evidenceRevision++; hideSuggestion(); tentative.newContext(); handled.clear(); resolveStatus.textContent = ''; for (const gesture of gestures.values()) gesture.snapshot = null; active = false; showIntro(true); overlay.stop(); overlayCanvas.dataset.detected = 'false';
  if (loopTimer) clearTimeout(loopTimer); loopTimer = null;
  stream?.getTracks().forEach(track => track.stop()); stream = null; video.srcObject = null;
  scanLabel.textContent = 'スキャン開始'; guide.hidden = true;
  if (message) cameraStatus.textContent = message;
  mark('camera-stop');
}
async function startCamera(): Promise<void> {
  if (active) return;
  closeDrawer();
  stopCamera(); const generation = scanGeneration; active = true; showIntro(false); scanLabel.textContent = '停止';
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
    const revision = evidenceRevision; mark('frame-start'); const capturedAt = performance.now(); const bitmap = await captureVideo();
    if (generation !== scanGeneration) { bitmap.close(); return; }
    const candidate = await recognizer.frame(bitmap); mark('frame-result', candidate.timing);
    if (generation !== scanGeneration || !active || revision !== evidenceRevision) return;
    overlay.update(candidate, capturedAt);
    cameraStatus.textContent = 'カード全体を画面内へ · 情報を表示します。保存は任意です';
    presentSuggestion(observe(candidate, performance.now()));
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
  // A camera frame in flight cannot be recalled from the worker; only then restart it.
  // Otherwise the preloaded recognizer is reused.
  if (frameBusy) invalidatePreparation();
  stopCamera(); const generation = scanGeneration;
  cameraStatus.textContent = '端末の画像を認識中（外部送信なし）';
  try {
    if (image.size > 25 * 1024 * 1024) throw new Error('25MB以下の画像を選んでください');
    if (!(await prepare()) || generation !== scanGeneration) return;
    const decoded = await createImageBitmap(image);
    const canvas = document.createElement('canvas'); const scale = Math.min(1, 1024 / Math.max(decoded.width, decoded.height));
    canvas.width = Math.round(decoded.width * scale); canvas.height = Math.round(decoded.height * scale);
    canvas.getContext('2d')!.drawImage(decoded, 0, 0, canvas.width, canvas.height); decoded.close();
    const revision = evidenceRevision; mark('file-frame-start'); const candidate = await recognizer.frame(await createImageBitmap(canvas)); mark('file-frame-result', candidate);
    if (generation !== scanGeneration || revision !== evidenceRevision) return;
    const proposal = observe(candidate, performance.now());
    presentSuggestion(proposal);
    cameraStatus.textContent = proposal ? '画像の処理が完了しました。情報を確認できます。保存は任意です。' : '候補を絞れませんでした。四隅・背景・反射を確認してもう一度お試しください。';
  } catch (error) { if (generation === scanGeneration) cameraStatus.textContent = errorText(error, '画像を認識できません。'); }
}
// A read-only history sheet has no camera to release; leave it open.
document.addEventListener('visibilitychange', () => { if (document.hidden && !staticView) stopCamera('背景に移動したため停止しました。スキャン開始から再開できます。'); });
window.addEventListener('pagehide', () => { stopCamera(); invalidatePreparation(); });
// Camera-first: recognition data loads at startup, never waiting for the camera.
void prepare();
mark('shell-ready');
