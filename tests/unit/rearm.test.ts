import { expect, it } from 'vitest';
import { RearmTracker } from '../../src/ui/rearm.js';
// Mirrors LiveCandidate's absence rule (count AND elapsed) so UI-side suppression clears at the same moment.
it('fires once enough absent observations span the minimum duration', () => {
  const t = new RearmTracker(3, 600);
  expect([t.observe(false, 0), t.observe(false, 300), t.observe(false, 500)]).toEqual([false, false, false]);
  expect(t.observe(false, 700)).toBe(true);
});
it('a present observation restarts the count and duration', () => {
  const t = new RearmTracker(2, 100);
  t.observe(false, 0); t.observe(true, 50);
  expect(t.observe(false, 120)).toBe(false); expect(t.observe(false, 230)).toBe(true);
});
it('reconfigure applies new thresholds and clears progress', () => {
  const t = new RearmTracker(2, 0); t.observe(false, 0); t.configure(3, 0);
  expect(t.observe(false, 1)).toBe(false);
});
