import type { FilterState, Product, ProductOffer, SortOption, StoreId } from '../types';
import { pricedOffers, reportedDiscountPercent } from './offers';

/** The six stores the app compares, in the order they are offered. */
export const COMPARED_STORE_IDS: StoreId[] = ['mercadolivre', 'amazon', 'shopee', 'shein', 'temu', 'aliexpress'];

/**
 * Orders for which the server asks Google for the list sorted on ITS side (the cheapest, the dearest, the most discounted of
 * all) and merges it with the normal list. The other orders (relevance, rating, number of reviews) have no list on Google's side.
 */
export type ExtraPoolSort = 'price_asc' | 'price_desc' | 'discount';
export const EXTRA_POOL_SORTS: ExtraPoolSort[] = ['price_asc', 'price_desc', 'discount'];
export const isExtraPoolSort = (s: SortOption): s is ExtraPoolSort => (EXTRA_POOL_SORTS as SortOption[]).includes(s);

export const DEFAULT_FILTERS: FilterState = {
  store: 'all',
  sortBy: 'relevance',
  freteGratisOnly: false,
  nationalOnly: false
};

/** True when something other than the defaults is selected. */
export function hasActiveFilters(f: FilterState): boolean {
  return (
    f.store !== 'all' ||
    f.sortBy !== 'relevance' ||
    f.freteGratisOnly ||
    f.nationalOnly ||
    Boolean(f.minPrice) ||
    Boolean(f.maxPrice)
  );
}

/**
 * The offers of a product that satisfy the filters, cheapest first. The OFFER is what is filtered: with a store chosen only
 * that store's price counts, with "frete grátis" only offers that report free shipping, and so on. Only real prices count.
 */
export function matchingOffers(p: Product, f: FilterState): ProductOffer[] {
  return pricedOffers(p).filter(
    (o) =>
      (f.store === 'all' || o.storeId === f.store) &&
      (!f.freteGratisOnly || o.freteGratis) &&
      (!f.nationalOnly || o.isNationalShipping === true) &&
      (!f.minPrice || o.price >= f.minPrice) &&
      (!f.maxPrice || o.price <= f.maxPrice)
  );
}

/** The offer a card shows (and the orders use): the cheapest one that satisfies the filters. */
export const shownOffer = (p: Product, f: FilterState): ProductOffer | undefined => matchingOffers(p, f)[0];

/** A product on screen together with the offer that represents it under the current filters. */
export interface Listed {
  product: Product;
  offer: ProductOffer;
}

/**
 * Filters and sorts without ever inventing data. What the visitor sees is what is filtered and sorted: the card shows the
 * cheapest offer that satisfies the filters, and the price and discount orders use exactly that offer. Equal values keep the
 * order the list came in (the server's own order), so sorting an already sorted list changes nothing.
 */
export function applyFilters(products: Product[], f: FilterState): Listed[] {
  const rows: { product: Product; offer: ProductOffer; i: number }[] = [];
  products.forEach((product, i) => {
    const offer = shownOffer(product, f);
    if (offer) rows.push({ product, offer, i });
  });

  switch (f.sortBy) {
    case 'price_asc':
      rows.sort((a, b) => a.offer.price - b.offer.price || a.i - b.i);
      break;
    case 'price_desc':
      rows.sort((a, b) => b.offer.price - a.offer.price || a.i - b.i);
      break;
    case 'discount':
      rows.sort((a, b) => reportedDiscountPercent(b.offer) - reportedDiscountPercent(a.offer) || a.i - b.i);
      break;
    case 'rating':
      rows.sort((a, b) => (b.product.rating || 0) - (a.product.rating || 0) || a.i - b.i);
      break;
    case 'sales':
      rows.sort((a, b) => (b.product.reviewsCount || 0) - (a.product.reviewsCount || 0) || a.i - b.i);
      break;
    default:
      break; // relevance: keep the order the source gave
  }
  return rows.map(({ product, offer }) => ({ product, offer }));
}

/**
 * How many products each store would show if it were chosen now, with the other filters as they are. Lets the store menu say
 * "Shopee (7)" before the visitor picks it, so an empty store is never a surprise.
 */
export function countByStore(products: Product[], f: FilterState): Record<StoreId, number> {
  const counts = {} as Record<StoreId, number>;
  for (const store of COMPARED_STORE_IDS) {
    const asked: FilterState = { ...f, store };
    counts[store] = products.reduce((n, p) => (matchingOffers(p, asked).length > 0 ? n + 1 : n), 0);
  }
  return counts;
}
