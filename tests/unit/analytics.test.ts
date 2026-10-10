import { describe, it, expect } from 'vitest';
import { isPokecaPublicSite } from '../../src/analytics.js';

describe('isPokecaPublicSite', () => {
  it('is true only for ikdsk.github.io under /pokeca-scanner/', () => {
    expect(isPokecaPublicSite({ hostname: 'ikdsk.github.io', pathname: '/pokeca-scanner/' })).toBe(true);
    expect(isPokecaPublicSite({ hostname: 'ikdsk.github.io', pathname: '/pokeca-scanner/index.html' })).toBe(true);
  });
  it('is false for Mana Peek on the same host', () => {
    expect(isPokecaPublicSite({ hostname: 'ikdsk.github.io', pathname: '/mtg-card-scanner/' })).toBe(false);
    expect(isPokecaPublicSite({ hostname: 'ikdsk.github.io', pathname: '/pokeca-scanner-x/' })).toBe(false);
    expect(isPokecaPublicSite({ hostname: 'ikdsk.github.io', pathname: '/' })).toBe(false);
  });
  it('is false for local and preview hosts', () => {
    expect(isPokecaPublicSite({ hostname: '127.0.0.1', pathname: '/pokeca-scanner/' })).toBe(false);
    expect(isPokecaPublicSite({ hostname: 'localhost', pathname: '/' })).toBe(false);
    expect(isPokecaPublicSite({ hostname: 'mac.tailnet.ts.net', pathname: '/pokeca-scanner/' })).toBe(false);
  });
});
