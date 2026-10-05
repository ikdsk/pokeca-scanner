import { button } from './dom.js';
import { crossIcon } from './icons.js';
// One shared × control for every closable surface (utility drawer, detail sheet).
export function closeIconButton(action: () => void): HTMLButtonElement {
  const control = button('', action, 'close-icon-button');
  control.setAttribute('aria-label', '閉じる'); control.title = '閉じる';
  control.append(crossIcon()); return control;
}
