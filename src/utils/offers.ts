import { Product, ProductOffer, StoreId } from '../types';
import { buildAffiliateUrl, getDirectStoreSearchUrl, trackAffiliateClick } from './affiliate';

/** Attribute for every outgoing link that earns a commission (Google/CONAR guidance). */
export const AFFILIATE_REL = 'sponsored noopener noreferrer';

/** "na Amazon" / "no Mercado Livre": the Portuguese contraction depends on the store's gender. */
export const naLoja = (name: string): string => `${/^mercado\b/i.test(name) ? 'no' : 'na'} ${name}`;
/** "para a Amazon" / "para o Mercado Livre". */
export const paraLoja = (name: string): string => `${/^mercado\b/i.test(name) ? 'para o' : 'para a'} ${name}`;

/** True when the offer carries a real price we can show. */
export const hasPrice = (o?: ProductOffer | null): o is ProductOffer =>
  Boolean(o) && o!.priceKnown !== false && o!.price > 0;

/** Offers with a real price, cheapest first. */
export const pricedOffers = (p: Product): ProductOffer[] =>
  p.offers.filter(hasPrice).sort((a, b) => a.price - b.price);

/** Stores where we only have a link (no price). */
export const linkOnlyOffers = (p: Product): ProductOffer[] => p.offers.filter((o) => !hasPrice(o));

export const bestOffer = (p: Product): ProductOffer | undefined => {
  const priced = pricedOffers(p);
  return priced.length > 0 ? priced[0] : undefined;
};

/** Difference between the cheapest and the second cheapest real price (only with >= 2 real prices). */
export function savingsVsNext(p: Product): { amount: number; storeName: string } | null {
  const priced = pricedOffers(p);
  if (priced.length < 2) return null;
  const amount = Math.round((priced[1].price - priced[0].price) * 100) / 100;
  if (amount <= 0) return null;
  return { amount, storeName: priced[1].storeName };
}

/** Discount shown only when the source itself reported an original price. */
export function reportedDiscountPercent(o?: ProductOffer | null): number {
  if (!o || !o.originalPrice || o.originalPrice <= o.price) return 0;
  return Math.round(((o.originalPrice - o.price) / o.originalPrice) * 100);
}

/** "há 3 min" / "há 2 h" / "hoje às 14:05" from a timestamp the server really measured. */
export function formatChecked(ts?: number): string {
  if (!ts) return '';
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (mins < 1) return 'agora';
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `há ${hours} h`;
  return `há ${Math.round(hours / 24)} d`;
}

/** The store's own search page for a term, with the owner's affiliate ID: where to look when the list has nothing from that store. */
export const storeSearchUrl = (storeId: StoreId, term: string): string =>
  buildAffiliateUrl(storeId, getDirectStoreSearchUrl(storeId, term));

/** Final URL for an offer (affiliate link when available). '' when there is nothing safe to open. */
export function resolveOfferUrl(offer: ProductOffer): string {
  const url = offer.affiliateUrl || (offer.url ? buildAffiliateUrl(offer.storeId, offer.url) : '');
  return url && url !== '#' ? url : '';
}

/** Products the visitor typed in by hand on this device (the price is theirs, not a store's). */
export const isUserProduct = (p: Product): boolean => p.id.startsWith('prod-custom-');

/** Prices the owner entered by hand in the database (shown with the date they were entered). */
export const isCuratedProduct = (p: Product): boolean => p.id.startsWith('prod-db-');

/** Who said the price and when, so a price is never shown without its origin. */
export function priceStamp(p: Product): string {
  const when = formatChecked(p.checkedAt);
  if (!when) return '';
  if (isUserProduct(p)) return `Preço informado por você ${when}`;
  if (isCuratedProduct(p)) return `Preço cadastrado ${when}`;
  return `Preço consultado ${when}`;
}

export function trackOfferClick(product: Product, offer: ProductOffer, url: string): void {
  trackAffiliateClick(offer.storeId, product.id, hasPrice(offer) ? offer.price : 0, product.title, url);
}

export function ratingText(rating?: number, count?: number): string {
  if (!rating || rating <= 0) return '';
  return count && count > 0 ? `${rating.toFixed(1)} (${count.toLocaleString('pt-BR')})` : rating.toFixed(1);
}

/** Neutral placeholder used when a product has no image (never a photo of a different product). */
export const PLACEHOLDER_IMAGE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#F1F5F9"/><path d="M34 80l17-22 12 15 8-10 15 17z" fill="#CBD5E1"/><circle cx="45" cy="44" r="7" fill="#CBD5E1"/></svg>'
  );
