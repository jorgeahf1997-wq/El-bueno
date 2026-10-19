export type StoreId = 
  | 'amazon' 
  | 'mercadolivre' 
  | 'shopee' 
  | 'shein' 
  | 'temu' 
  | 'aliexpress' 
  | 'outras';

export interface StoreMetadata {
  id: StoreId;
  name: string;
  badgeBg: string;
  badgeTextColor: string;
  borderColor: string;
  logoIcon: string;
  primaryColor: string;
  affiliateParamName: string;
  defaultAffiliateTag: string;
  domainUrl: string;
}

export interface ProductOffer {
  id: string;
  storeId: StoreId;
  storeName: string;
  price: number; // in BRL R$ (0 when priceKnown is false)
  /** false = we have a link to the store but no real price for this product. Never show a price for it. */
  priceKnown?: boolean;
  originalPrice?: number; // only when the source reported it
  pixDiscountPercent?: number; // e.g. 5, 10 or 15%
  freteGratis: boolean;
  shippingCost?: number; // 0 for free shipping, or R$ value
  rating?: number; // Vendor rating e.g. 4.7
  isBestPrice?: boolean; // ⭐ Melhor Preço badge
  installmentText?: string; // e.g. "10x de R$ 14,99 sem juros"
  url: string;
  affiliateUrl: string;
  inStock: boolean;
  seller?: string;
  isNationalShipping?: boolean; // Envio Nacional BR
  estimatedDays?: string;
}

export interface PriceHistoryPoint {
  date: string;
  price: number;
  storeName?: string;
}

export interface Product {
  id: string;
  title: string;
  image: string;
  category?: string;
  rating: number; // e.g. 4.8
  reviewsCount: number;
  salesCount?: string; // e.g. "+5 mil vendidos"
  offers: ProductOffer[];
  lowestHistoricalPrice?: number;
  /** true only when the server observed >= 7 days and >= 3 real prices and today is the lowest */
  isHistoricalLow?: boolean;
  priceHistory?: PriceHistoryPoint[];
  /** days covered by the real price history we recorded */
  historyDays?: number;
  /** when the server last checked the price (ms since epoch) */
  checkedAt?: number;
  lowestOffer?: ProductOffer;
  highestOffer?: ProductOffer;
  affiliate_url?: string;
  affiliateUrl?: string;
}

export interface CouponItem {
  id: string;
  code: string;
  storeId: StoreId;
  storeName: string;
  discountText: string; // e.g. "R$ 30 OFF" or "15% OFF no Pix"
  minSpendText: string; // e.g. "Em compras acima de R$ 150"
  expirationText: string; // e.g. "⏰ Expira em 2 dias"
  isExclusiveApp?: boolean;
  isVerified?: boolean;
  verifiedAtText?: string; // e.g. "Testado em 10/10"
  description: string;
  affiliateUrl: string;
}

export interface PriceAlert {
  id: string;
  productId: string;
  productTitle: string;
  productImage?: string;
  targetPrice: number;
  currentPrice: number;
  email?: string;
  whatsapp?: string;
  notifyWhatsapp?: boolean;
  createdAt: string;
}

export type StoreOffer = ProductOffer;

export type SortOption = 'price_asc' | 'price_desc' | 'rating' | 'sales' | 'relevance' | 'discount';

export interface PriceDropEvent {
  productId: string;
  title: string;
  storeName: string;
  oldPrice: number;
  newPrice: number;
  discountPercent: number;
  timestamp: string;
  affiliateUrl: string;
}

export interface FilterState {
  store: StoreId | 'all';
  sortBy: SortOption;
  /** only products that have a real price with free shipping reported by the source */
  freteGratisOnly: boolean;
  /** only products sold by stores that ship nationwide */
  nationalOnly: boolean;
  minPrice?: number;
  maxPrice?: number;
}
