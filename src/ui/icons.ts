const NS = 'http://www.w3.org/2000/svg';
type Shape = { tag: 'path' | 'circle'; attrs: Record<string, string> };
// Decorative stroke icons: hidden from assistive tech, the owning control carries the accessible name.
export function strokeIcon(size: { viewBox: string; width: string; height: string }, strokeWidth: string, shapes: Shape[]): SVGSVGElement {
  const icon = document.createElementNS(NS, 'svg');
  for (const [name, value] of Object.entries({ ...size, fill: 'none', stroke: 'currentColor', 'stroke-width': strokeWidth, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' })) icon.setAttribute(name, value);
  for (const shape of shapes) { const node = document.createElementNS(NS, shape.tag); for (const [name, value] of Object.entries(shape.attrs)) node.setAttribute(name, value); icon.append(node); }
  return icon;
}
const square = { viewBox: '0 0 24 24', width: '20', height: '20' };
export const cameraIcon = () => strokeIcon(square, '1.7', [{ tag: 'path', attrs: { d: 'M3 6h4l2-3h6l2 3h4v15H3Z' } }, { tag: 'circle', attrs: { cx: '12', cy: '13', r: '4' } }]);
export const gearIcon = () => strokeIcon({ ...square, width: '22', height: '22' }, '1.7', [{ tag: 'path', attrs: { d: 'M9.5 3h5l.5 2.5 2 1.2 2.4-.8 2.5 4.2-1.9 1.7v2.4l1.9 1.7-2.5 4.2-2.4-.8-2 1.2-.5 2.5h-5L9 20.5l-2-1.2-2.4.8-2.5-4.2L4 14.2v-2.4L2.1 10.1l2.5-4.2 2.4.8 2-1.2Z' } }, { tag: 'circle', attrs: { cx: '12', cy: '13', r: '3' } }]);
export const upArrowIcon = () => strokeIcon({ viewBox: '0 0 24 28', width: '24', height: '28' }, '2.4', [{ tag: 'path', attrs: { d: 'M12 26V4M4 11l8-8 8 8' } }]);
export const crossIcon = () => strokeIcon({ ...square, width: '22', height: '22' }, '1.7', [{ tag: 'path', attrs: { d: 'M6 6l12 12M18 6L6 18' } }]);
