/**
 * Address-bar helpers. Pure functions (no React, no reading of window), so they can be tested on their own.
 *
 * The paths are the same ones the server knows (see renderHtmlWithSeo and the sitemap in server.ts):
 *   /                  home
 *   /busca/<termo>     search ("air-fryer" means "air fryer")
 *   /categoria/<id>    a category, which runs the real search that belongs to it
 *   /categorias        all the categories
 *   /cupons            coupons
 *   /?q=<termo>        search (old links keep working)
 */

export interface RouteTile {
  id: string;
  term: string;
}

export type Route =
  | { kind: 'home' }
  | { kind: 'categories' }
  | { kind: 'coupons' }
  | { kind: 'search'; term: string; categoryId: string | null };

export interface LocationLike {
  pathname: string;
  search: string;
  hash: string;
}

export const MAX_TERM_LENGTH = 100;

export function safeDecode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/** Collapses spaces, trims and limits the size, so the same words always make the same search. */
export function cleanTerm(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, MAX_TERM_LENGTH);
}

export function searchPath(term: string): string {
  return `/busca/${encodeURIComponent(cleanTerm(term).toLowerCase().replace(/\s+/g, '-'))}`;
}

export function categoryPath(id: string): string {
  return `/categoria/${encodeURIComponent(id)}`;
}

export function parseRoute(loc: LocationLike, tiles: RouteTile[]): Route {
  const params = new URLSearchParams(loc.search);

  const q = cleanTerm(params.get('q') || '');
  if (q) return { kind: 'search', term: q, categoryId: null };

  const path = loc.pathname.replace(/\/+$/, '') || '/';
  const lower = path.toLowerCase();

  if (lower.startsWith('/busca/')) {
    const term = cleanTerm(safeDecode(path.slice('/busca/'.length)).replace(/-/g, ' '));
    return term ? { kind: 'search', term, categoryId: null } : { kind: 'home' };
  }

  if (lower.startsWith('/categoria/')) {
    const id = safeDecode(path.slice('/categoria/'.length)).toLowerCase();
    const tile = tiles.find((t) => t.id === id);
    return tile ? { kind: 'search', term: tile.term, categoryId: tile.id } : { kind: 'categories' };
  }

  if (lower === '/categorias') return { kind: 'categories' };
  if (lower === '/cupons' || params.get('tab') === 'cupons') return { kind: 'coupons' };

  return { kind: 'home' };
}

/** The owner area is reached with /?admin (or #admin). It is never linked from the public screens. */
export function isAdminLocation(loc: Pick<LocationLike, 'search' | 'hash'>): boolean {
  return new URLSearchParams(loc.search).has('admin') || /^#\/?admin$/i.test(loc.hash);
}
