import type { PokeCard } from '../data/pokemon.js';
import { el } from './dom.js';
// Persistent DOM: independent price/FX renders never restart an image.
export class ReferenceImage {
  readonly node = el('figure', '', 'reference-image');
  private signature = '';
  private epoch = 0;
  clear(): void { this.signature = ''; this.epoch++; this.node.replaceChildren(); }
  update(card: PokeCard): void {
    const signature = JSON.stringify([card.tcgdexId, card.imageUrl]);
    if (signature === this.signature) return;
    this.signature = signature;
    const epoch = ++this.epoch;
    const caption = el('figcaption', '参照画像');
    const region = el('div', '', 'reference-region');
    const status = el('p', card.imageUrl ? '参照画像を読み込み中…' : '参照画像はありません', 'small muted');
    region.append(status);
    if (card.imageUrl) {
      const image = el('img'); image.alt = `${card.nameJa} の参照画像`; image.width = 488; image.height = 680; image.decoding = 'async'; image.referrerPolicy = 'no-referrer'; image.hidden = true;
      image.onload = () => { if (epoch !== this.epoch) return; image.hidden = false; status.hidden = true; };
      image.onerror = () => { if (epoch !== this.epoch) return; image.hidden = true; status.hidden = false; status.textContent = '参照画像を読み込めません。カード情報・価格は引き続き確認できます。'; };
      image.src = card.imageUrl; region.append(image);
    }
    const credit = el('p', '', 'small muted'); const link = el('a', 'TCGdex');
    link.href = 'https://www.tcgdex.net'; link.target = '_blank'; link.rel = 'noopener noreferrer';
    credit.append(document.createTextNode('画像提供：'), link, document.createTextNode(' · 参照画像'));
    this.node.replaceChildren(caption, region, credit);
  }
}
