import { chooseQuote, type UsdQuote } from '../data/tcgplayer-price.js';
import { formatReferencePrice, type FxRate } from '../domain/pricing.js';
export type PriceInput = { status: 'loading' | 'ready' | 'missing' | 'error'; quotes: readonly UsdQuote[]; variant: string | null; fx: FxRate | null; fxError: boolean };
export type PriceView = {
  heading: string; headline: string; usd: string | null; others: string[]; note: string | null;
  updatedAt: string | null; fxNote: string; disclaimer: string;
};
const updatedFormat = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
function updated(iso: string | null): string | null {
  if (iso === null || !Number.isFinite(Date.parse(iso))) return null;
  const part = Object.fromEntries(updatedFormat.formatToParts(new Date(iso)).map(p => [p.type, p.value]));
  return `価格更新 ${part.year}/${part.month}/${part.day} ${part.hour}:${part.minute}（日本時間）`;
}
function listed(quote: UsdQuote, fx: FxRate | null): string {
  if (quote.usdMarket === null) return `${quote.subType} 価格なし`;
  const display = formatReferencePrice(quote.usdMarket, fx);
  return `${quote.subType} ${display.usd} USD${display.jpy ? `（参考価格 ${display.jpy}）` : ''}`;
}
export function priceView(input: PriceInput): PriceView {
  const view: PriceView = {
    heading: '海外参考価格（TCGplayer）', headline: '', usd: null, others: [], note: null, updatedAt: null,
    fxNote: input.fx ? `Frankfurter / ECB · 1 USD = ${input.fx.jpyPerUsd} JPY · 最新公表日 ${input.fx.asOf}`
      : input.fxError ? '為替を取得できません。USDのみ表示します。' : '為替を確認中（取得できなければUSDのみ）',
    disclaimer: '国内販売・買取価格ではありません',
  };
  if (input.status === 'loading') return { ...view, headline: '価格を取得中…' };
  if (input.status === 'missing') return { ...view, headline: '価格データなし（npm run prices:snapshot で生成）' };
  if (input.status === 'error') return { ...view, headline: '価格を取得できません' };
  if (input.quotes.length === 0) return { ...view, headline: 'この商品の価格データなし' };
  view.updatedAt = updated(input.quotes[0]!.providerUpdatedAt) ?? '価格の更新時刻は不明';
  const chosen = chooseQuote(input.quotes, input.variant);
  view.others = input.quotes.filter(q => q !== chosen).map(q => listed(q, input.fx));
  if (!chosen) return { ...view, headline: '版により価格が異なります', note: 'この版に対応する価格区分を特定できないため、1つには決めず全区分を表示します。' };
  if (chosen.usdMarket === null) return { ...view, headline: 'この商品の価格なし' };
  const display = formatReferencePrice(chosen.usdMarket, input.fx);
  view.headline = display.jpy ? `参考価格 ${display.jpy}` : '概算JPYは利用できません';
  view.usd = display.usd ? `${display.usd} USD` : null;
  return view;
}
