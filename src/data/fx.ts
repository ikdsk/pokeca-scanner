import { JsonClient, ProviderError } from './http.js';
import type { FxRate } from '../domain/pricing.js';
import { formatReferencePrice } from '../domain/pricing.js';
export function parseFx(value: unknown): FxRate {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new ProviderError('応答の形式が不正です');
  const d = value as Record<string, unknown>;
  const fx = { jpyPerUsd: d.rate as number, asOf: d.date as string };
  if (d.base !== 'USD' || d.quote !== 'JPY' || typeof fx.asOf !== 'string' || typeof fx.jpyPerUsd !== 'number' || !formatReferencePrice('1', fx).jpy) throw new ProviderError('為替情報が不正です');
  return fx;
}
export const FX_URL = 'https://api.frankfurter.dev/v2/providers/ecb/rate/USD/JPY';
export class FxProvider {
  constructor(private readonly http = new JsonClient(fetch, 0, 3_600_000)) {}
  async latest(signal?: AbortSignal): Promise<FxRate> { return this.http.get(FX_URL, signal, parseFx); }
}
