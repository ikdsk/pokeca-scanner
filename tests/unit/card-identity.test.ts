import { expect, it } from 'vitest';
import { CardIdentity } from '../../src/ui/card-identity.js';
// SYNTHETIC ids: two TCGplayer products (plain / Poke Ball Pattern) of one TCGdex card.
it('unknown ids are their own identity', () => {
  const identity = new CardIdentity();
  expect(identity.canonical('1')).toBe('1'); expect(identity.sameCard('1', '2')).toBe(false); expect(identity.sameCard('1', '1')).toBe(true);
});
it('products resolving to the same TCGdex card share the first-seen id', () => {
  const identity = new CardIdentity();
  expect(identity.learn('1', 'SV2a-161')).toBe('1');
  expect(identity.learn('2', 'SV2a-161')).toBe('1');
  expect(identity.canonical('2')).toBe('1'); expect(identity.sameCard('1', '2')).toBe(true);
  expect(identity.learn('3', 'SV2a-162')).toBe('3'); expect(identity.sameCard('3', '1')).toBe(false);
});
it('clear forgets everything', () => {
  const identity = new CardIdentity(); identity.learn('1', 'X-1'); identity.learn('2', 'X-1'); identity.clear();
  expect(identity.canonical('2')).toBe('2');
});
