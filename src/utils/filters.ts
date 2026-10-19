import { FilterState, Product, StoreId } from '../types';
import { pricedOffers, reportedDiscountPercent } from './offers';

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

/** The price used to compare and sort a product: its cheapest real price, or the one in the selected store. */
export function comparablePrice(p: Product, store: StoreId | 'all'): number {
  const offers = pricedOffers(p); // cheapest first
  if (store === 'all') return offers.length > 0 ? offers[0].price : Infinity;
  const inStore = offers.find((o) => o.storeId === store);
  return inStore ? inStore.price : Infinity;
}

/**
 * Filters and sorts without ever inventing data: only offers with a real price count, and
 * "discount" is the one the source itself reported.
 */
export function applyFilters(products: Product[], f: FilterState): Product[] {
  let list = products.filter((p) => pricedOffers(p).length > 0);

  if (f.store !== 'all') {
    list = list.filter((p) => pricedOffers(p).some((o) => o.storeId === f.store));
  }
  if (f.freteGratisOnly) {
    list = list.filter((p) => pricedOffers(p).some((o) => o.freteGratis));
  }
  if (f.nationalOnly) {
    list = list.filter((p) => pricedOffers(p).some((o) => o.isNationalShipping));
  }
  if (f.minPrice) {
    const min = f.minPrice;
    list = list.filter((p) => comparablePrice(p, f.store) >= min);
  }
  if (f.maxPrice) {
    const max = f.maxPrice;
    list = list.filter((p) => comparablePrice(p, f.store) <= max);
  }

  const sorted = [...list];
  switch (f.sortBy) {
    case 'price_asc':
      sorted.sort((a, b) => comparablePrice(a, f.store) - comparablePrice(b, f.store));
      break;
    case 'price_desc':
      sorted.sort((a, b) => comparablePrice(b, f.store) - comparablePrice(a, f.store));
      break;
    case 'discount':
      sorted.sort((a, b) => {
        const best = (p: Product) => reportedDiscountPercent(pricedOffers(p)[0]);
        return best(b) - best(a);
      });
      break;
    case 'rating':
      sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      break;
    case 'sales':
      sorted.sort((a, b) => (b.reviewsCount || 0) - (a.reviewsCount || 0));
      break;
    default:
      break; // relevance: keep the order the source gave
  }
  return sorted;
}
