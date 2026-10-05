import type { PokeCard } from '../data/pokemon.js';
import type { UsdQuote } from '../data/tcgplayer-price.js';
import type { FxRate } from '../domain/pricing.js';
import { SnapshotMissingError } from './snapshot-loader.js';
export type PriceState = { card: PokeCard | null; status: 'loading' | 'ready' | 'missing' | 'error'; quotes: UsdQuote[]; fx: FxRate | null; fxError: boolean };
const empty = (): PriceState => ({ card: null, status: 'loading', quotes: [], fx: null, fxError: false });
export class PriceSession {
  private request: AbortController | null = null;
  private generation = 0;
  value: PriceState = empty();
  constructor(
    private readonly quote: (tcgplayerId: string, signal: AbortSignal) => Promise<UsdQuote[]>,
    private readonly fx: (signal: AbortSignal) => Promise<FxRate>,
    private readonly changed: () => void,
  ) {}
  reset(): void { this.request?.abort(); this.request = null; this.generation++; this.value = empty(); this.changed(); }
  async select(card: PokeCard): Promise<void> {
    this.request?.abort();
    const request = new AbortController(); this.request = request; const generation = ++this.generation;
    const current = () => generation === this.generation;
    this.value = { ...empty(), card }; this.changed();
    // FX is independent of the quote; its failure keeps truthful USD-only output.
    const rate = this.fx(request.signal).then(fx => ({ fx, failed: false }), () => ({ fx: null, failed: true }));
    try {
      const quotes = await this.quote(card.tcgplayerId, request.signal);
      if (!current()) return;
      this.value = { ...this.value, status: 'ready', quotes }; this.changed();
    } catch (error) {
      if (!current()) return;
      this.value = { ...this.value, status: error instanceof SnapshotMissingError ? 'missing' : 'error', quotes: [] }; this.changed();
    }
    const fx = await rate;
    if (!current()) return;
    this.value = { ...this.value, fx: fx.fx, fxError: fx.failed }; this.changed();
  }
}
