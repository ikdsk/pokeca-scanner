import { el, button } from './dom.js';
import { candidateView, thumbnailUrl } from './candidate-view.js';
import type { ScanHistoryEntry, PendingScanHistoryEntry } from './scan-history-model.js';
import './scan-history.css';
export class ScanHistoryView {
  readonly node = el('section', '', 'panel scan-history');
  private readonly list = el('ol', '', 'scan-history-list');
  private readonly rows = new Map<number, { node: HTMLLIElement; signature: string }>();
  constructor(private readonly reopen: (entry: ScanHistoryEntry) => void, limit = 100) {
    this.node.hidden = true;
    const heading = el('h2', 'スキャン履歴'); heading.id = 'scan-history-heading';
    this.node.setAttribute('aria-labelledby', heading.id);
    this.node.append(heading, el('p', `最新${limit}件まで。このタブ内のみ・再読み込みで消えます。`, 'small muted'), this.list);
  }
  update(entries: (ScanHistoryEntry | PendingScanHistoryEntry)[]): void {
    this.node.hidden = entries.length === 0;
    const retained = new Set(entries.map(entry => entry.generation));
    for (const [id, row] of this.rows) if (!retained.has(id)) { row.node.remove(); this.rows.delete(id); }
    entries.forEach((entry, index) => {
      const signature = JSON.stringify(entry);
      let row = this.rows.get(entry.generation);
      if (!row || row.signature !== signature) {
        const focused = row?.node.contains(document.activeElement);
        const node = el('li'); const card = entry.card;
        if (!card) {
          const pending = el('div', '', 'scan-history-row');
          pending.append(el('strong', '認識候補'), el('p', entry.status, 'small muted'));
          node.append(pending); row?.node.replaceWith(node); row = {node,signature}; this.rows.set(entry.generation,row);
          if (this.list.children[index] !== node) this.list.insertBefore(node,this.list.children[index] ?? null);
          return;
        }
        const resolved = entry as ScanHistoryEntry;
        const view = candidateView(card);
        const name = view.name; const selection = view.expansion;
        const control = button('', () => this.reopen(resolved), 'scan-history-row');
        control.setAttribute('aria-label', `${name} · ${selection} を開く`);
        const thumbnail = el('span', '', 'scan-history-thumbnail');
        const url = thumbnailUrl(card.imageUrl);
        const fallback = el('span', '画像なし', 'small'); thumbnail.append(fallback);
        if (url) {
          const image = el('img'); image.alt = ''; image.width = 48; image.height = 67;
          image.loading = 'lazy'; image.decoding = 'async'; image.referrerPolicy = 'no-referrer';
          image.onload = () => { fallback.hidden = true; };
          image.onerror = () => { image.hidden = true; fallback.hidden = false; };
          image.src = url; thumbnail.append(image);
        }
        const text = el('span', '', 'scan-history-text'); text.append(el('strong', name), el('span', selection, 'small muted'));
        control.append(thumbnail, text); node.append(control);
        row?.node.replaceWith(node); row = { node, signature }; this.rows.set(entry.generation, row);
        if (focused) control.focus({ preventScroll: true });
      }
      if (this.list.children[index] !== row.node) this.list.insertBefore(row.node, this.list.children[index] ?? null);
    });
  }
}
