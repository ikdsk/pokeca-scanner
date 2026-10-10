// Only the public Pokéca Scanner deployment counts page views. ikdsk.github.io is shared with Mana Peek
// (/mtg-card-scanner/), so the path must match too.
export function isPokecaPublicSite(loc: Pick<Location, 'hostname' | 'pathname'>): boolean {
  return loc.hostname === 'ikdsk.github.io' && loc.pathname.startsWith('/pokeca-scanner/');
}
