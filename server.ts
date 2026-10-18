import express from 'express';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

app.disable('x-powered-by');
// How many proxies sit between the visitor and this server (Cloud Run and most hosts: 1). Too low and every visitor
// looks like the proxy's IP (they would all share one rate limit); too high and a visitor could fake its own IP.
const TRUST_PROXY_HOPS = (() => {
  const n = parseInt(process.env.TRUST_PROXY_HOPS ?? '', 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), 5) : 1;
})();
app.set('trust proxy', TRUST_PROXY_HOPS);
app.use(express.json({ limit: '20kb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
app.use('/api', rateLimit(120, 60 * 1000));

// User's active affiliate codes
const AFFILIATE_CODES = {
  amazon: process.env.AFFILIATE_AMAZON || 'jorgeahf-20',
  shopee: process.env.AFFILIATE_SHOPEE || 'an_18399541262',
  shein: process.env.AFFILIATE_SHEIN || '6310987385',
  temu: process.env.AFFILIATE_TEMU || '2127307378',
  aliexpress: process.env.AFFILIATE_ALIEXPRESS || 'JorgeAHF',
  mercadolivre: process.env.AFFILIATE_MERCADOLIVRE || 'jh20260503160333'
};

// SECRET: never hardcode keys. Set SERPAPI_API_KEY (and, optionally, SERPAPI_API_KEY_2 as a reserve) in the
// environment (.env is git-ignored). Keys stay on the server: never logged, never sent to the browser.
// The same key written twice counts once.
const SERPAPI_KEYS: string[] = Array.from(
  new Set([process.env.SERPAPI_API_KEY, process.env.SERPAPI_API_KEY_2].map((k) => (k || '').trim()).filter(Boolean))
);
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
// Server-only key (bypasses RLS). Optional: with it, tables like alertas_usuario can stay closed to the public.
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

// Optional Supabase client for storage
let supabaseClient: any = null;
if (SUPABASE_URL && (SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY) && SUPABASE_URL.startsWith('http')) {
  try {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY);
    console.log('[Supabase] Conectado a la base de datos de almacenamiento:', SUPABASE_URL);
  } catch (err) {
    console.warn('[Supabase] Error al inicializar cliente:', err);
  }
}

// -------------------------------------------------------------
// SERPAPI CONFIG. Every uncached search spends SerpApi credits, so results are cached
// and the UI always shows the real time each price was checked ("checkedAt").
// -------------------------------------------------------------
export const CACHE_TTL_MS = Math.max(5, parseInt(process.env.SEARCH_CACHE_MINUTES || '60', 10)) * 60 * 1000;

interface CacheEntry<T> {
  data: T;
  expires: number;
  cachedAt: number;
  hasSignificantChange?: boolean;
}

// In-memory cache for search results & live deals
const searchCache = new Map<string, CacheEntry<any[]>>();

// Last real price we observed for each product AT EACH STORE (used to report real price drops).
interface TrackedProductPrice {
  id: string;
  title: string;
  price: number;
  storeName: string;
  timestamp: number;
}
const priceTracker = new Map<string, TrackedProductPrice>();

// Irrelevant & second-hand items filter (Screenshot 4: "eliminar resultados irrelevantes (ej: productos de segunda mano, anuncios)")
const IRRELEVANT_OR_USED_REGEX = /\b(usado|recondicionado|segunda\s*m[aã]o|pe[çc]as?\s+de\s+reposi[çc][aã]o|sucata|defeito|para\s+retirar\s+pe[çc]as|manual\s+do\s+usu[aá]rio|carca[çc]a|quebrado|seminovo|com\s+defeito)\b/i;

// Clean text / NLP cleaning helper (Screenshot 3: "Usa expresiones regulares o modelos de NLP para limpiar datos inconsistentes")
function cleanProductTitle(rawTitle: string): string {
  if (!rawTitle) return '';
  return rawTitle
    .replace(/^\[.*?\]\s*/, '') // remove initial tags like [OFERTA], [BLACK FRIDAY]
    .replace(/[^\w\s\u00C0-\u00FF-]/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Function to extract clean numeric price handling comma/point inconsistencies (Screenshot 3)
function extractCleanPrice(rawPrice: any): number {
  if (typeof rawPrice === 'number' && !isNaN(rawPrice)) return rawPrice;
  if (!rawPrice) return 0;
  const cleanStr = String(rawPrice)
    .replace(/[^\d.,]/g, '')
    .trim();
  if (cleanStr.includes(',') && cleanStr.includes('.')) {
    if (cleanStr.indexOf('.') < cleanStr.indexOf(',')) {
      return parseFloat(cleanStr.replace(/\./g, '').replace(',', '.'));
    } else {
      return parseFloat(cleanStr.replace(/,/g, ''));
    }
  } else if (cleanStr.includes(',')) {
    return parseFloat(cleanStr.replace(',', '.'));
  }
  return parseFloat(cleanStr) || 0;
}

// Interface for price drop alert event (Screenshot 4 & 5)
interface PriceDropEvent {
  productId: string;
  title: string;
  storeName: string;
  oldPrice: number;
  newPrice: number;
  discountPercent: number;
  timestamp: string;
  affiliateUrl: string;
}

// A "drop" is reported only when the SAME store lowered its own price since the last time we looked.
// (If the cheapest store simply changes, nothing is reported.)
const MAX_TRACKED_PRICES = 6000;
function detectPriceChanges(products: any[]): { hasSignificantChange: boolean; priceDrops: PriceDropEvent[] } {
  let hasSignificantChange = false;
  const priceDrops: PriceDropEvent[] = [];
  const clock = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

  for (const product of products) {
    const priced = (product.offers || []).filter((o: any) => o.priceKnown !== false && o.price > 0);
    if (priced.length === 0) continue;
    const lowest = priced.reduce((a: any, b: any) => (b.price < a.price ? b : a));

    for (const offer of priced) {
      const key = `${product.id}|${offer.storeId}|${String(offer.storeName || '').toLowerCase()}`;
      const previous = priceTracker.get(key);
      if (offer === lowest && previous && previous.price > 0) {
        if (offer.price < previous.price * 0.98) {
          hasSignificantChange = true;
          priceDrops.push({
            productId: product.id,
            title: product.title,
            storeName: offer.storeName,
            oldPrice: previous.price,
            newPrice: offer.price,
            discountPercent: Math.round(((previous.price - offer.price) / previous.price) * 100),
            timestamp: clock,
            affiliateUrl: offer.affiliateUrl
          });
        } else if (offer.price > previous.price * 1.05) {
          hasSignificantChange = true;
        }
      }
      priceTracker.delete(key); // re-insert so the oldest entries are the ones evicted
      priceTracker.set(key, {
        id: product.id,
        title: product.title,
        price: offer.price,
        storeName: offer.storeName,
        timestamp: Date.now()
      });
      if (priceTracker.size > MAX_TRACKED_PRICES) {
        const oldest = priceTracker.keys().next().value;
        if (oldest !== undefined) priceTracker.delete(oldest);
      }
    }
  }

  priceDrops.sort((x, y) => y.discountPercent - x.discountPercent);
  return { hasSignificantChange, priceDrops };
}

// -------------------------------------------------------------
// REAL & VERIFIED STORE PRODUCT URL GENERATORS (Never fake 404 IDs)
// Guarantees all products and store links exist in real-time
// -------------------------------------------------------------

// Clean product title to produce a high-intent search query for the specific store
function cleanSearchKeyword(title: string): string {
  if (!title) return 'oferta';
  return title
    .replace(/[^\w\s\u00C0-\u00FF-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 7)
    .join(' ');
}

// Generate guaranteed real, working product landing URL for any store
// This NEVER produces 404 "Este producto no existe" errors!
function generateStoreProductOfferUrl(storeId: string, productTitle: string): string {
  const keyword = cleanSearchKeyword(productTitle);
  const encoded = encodeURIComponent(keyword);

  switch (storeId) {
    case 'amazon':
      return `https://www.amazon.com.br/s?k=${encoded}`;
    case 'mercadolivre':
      return `https://lista.mercadolivre.com.br/${encodeURIComponent(keyword.replace(/[^\w\s-]/gi, '').trim().replace(/\s+/g, '-'))}#D[A:${encoded}]`;
    case 'shopee':
      return `https://shopee.com.br/search?keyword=${encoded}`;
    case 'shein':
      return `https://br.shein.com/pdsearch/${encoded}/`;
    case 'temu':
      return `https://www.temu.com/br/search_result.html?search_key=${encoded}`;
    case 'aliexpress':
      return `https://pt.aliexpress.com/wholesale?SearchText=${encoded}`;
    case 'magalu':
      return `https://www.magazineluiza.com.br/busca/${encoded}/`;
    default:
      return `https://www.amazon.com.br/s?k=${encoded}`;
  }
}

// Extract direct, specific product URL from raw links (unwrapping Google redirects)
// Supports Google Shopping official product comparison sheets and direct store product URLs
function extractDirectProductUrl(rawUrl: string, storeId: string, productTitle?: string): string {
  let targetUrl = rawUrl ? rawUrl.trim() : '';
  if (!targetUrl || targetUrl === '#') return '';

  // 1. If targetUrl is an official Google Shopping product comparison page, preserve it directly!
  if ((targetUrl.includes('google.com') || targetUrl.includes('google.com.br')) && 
      (targetUrl.includes('ibp=oshop') || targetUrl.includes('prds=') || targetUrl.includes('udm=28'))) {
    return targetUrl;
  }

  // 2. Unwrap Google redirect links (google.com/url, googleadservices, aclk)
  if (targetUrl.includes('google.com') || targetUrl.includes('googleadservices.com')) {
    try {
      const parsed = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`);
      const unwrapped = parsed.searchParams.get('url') || 
                        parsed.searchParams.get('q') || 
                        parsed.searchParams.get('adurl') ||
                        parsed.searchParams.get('destination');
      if (unwrapped) {
        targetUrl = decodeURIComponent(unwrapped);
      }
    } catch {
      const matchUrl = targetUrl.match(/(?:url|q|adurl|destination)=([^&]+)/i);
      if (matchUrl && matchUrl[1]) {
        try {
          targetUrl = decodeURIComponent(matchUrl[1]);
        } catch {}
      }
    }
  }

  // 3. Extract genuine existing Product ID if present in the URL
  switch (storeId) {
    case 'amazon': {
      const asinMatch = targetUrl.match(/(?:dp|gp\/product|product|d)\/([A-Z0-9]{10})/i) ||
                        targetUrl.match(/[?&]asin=([A-Z0-9]{10})/i);
      if (asinMatch && asinMatch[1]) {
        return `https://www.amazon.com.br/dp/${asinMatch[1].toUpperCase()}`;
      }
      break;
    }

    case 'mercadolivre': {
      const mlbMatch = targetUrl.match(/p\/(MLB\d+)/i) ||
                       targetUrl.match(/(MLB-?\d{7,14})/i);
      if (mlbMatch && mlbMatch[1]) {
        const cleanId = mlbMatch[1].replace('-', '');
        return `https://www.mercadolivre.com.br/p/${cleanId}`;
      }
      break;
    }

    case 'shopee': {
      const shopeeMatch = targetUrl.match(/-i\.(\d+)\.(\d+)/) ||
                          targetUrl.match(/product\/(\d+)\/(\d+)/);
      if (shopeeMatch && shopeeMatch[1] && shopeeMatch[2]) {
        return `https://shopee.com.br/product/${shopeeMatch[1]}/${shopeeMatch[2]}`;
      }
      break;
    }

    case 'aliexpress': {
      const aliMatch = targetUrl.match(/item\/(\d+)\.html/) ||
                       targetUrl.match(/[?&]id=(\d{10,16})/);
      if (aliMatch && aliMatch[1]) {
        return `https://pt.aliexpress.com/item/${aliMatch[1]}.html`;
      }
      break;
    }

    case 'shein': {
      const sheinMatch = targetUrl.match(/[/-]p-(\d+)\.html/) ||
                         targetUrl.match(/goods-p-(\d+)/) ||
                         targetUrl.match(/[?&]goods_id=(\d+)/);
      if (sheinMatch && sheinMatch[1]) {
        return `https://br.shein.com/goods-p-${sheinMatch[1]}.html`;
      }
      break;
    }

    case 'temu': {
      const temuMatch = targetUrl.match(/goods-(\d+)\.html/) ||
                        targetUrl.match(/goods_id=(\d+)/) ||
                        targetUrl.match(/-g-(\d+)/);
      if (temuMatch && temuMatch[1]) {
        return `https://www.temu.com/br/goods-${temuMatch[1]}.html`;
      }
      break;
    }
  }

  // 4. If targetUrl is an existing direct product URL on the store domain, keep it!
  if (targetUrl && 
      !targetUrl.includes('/s?k=') && 
      !targetUrl.includes('/search?') && 
      !targetUrl.includes('/busca/') &&
      !targetUrl.includes('/wholesale?') &&
      !targetUrl.includes('/search_result.html') &&
      targetUrl.startsWith('http')) {
    return targetUrl;
  }

  return targetUrl;
}

// Builds the final affiliate URL with correct parameters matching Screenshots 1-8 & 10-17
function buildAffiliateUrl(storeId: string, originalUrl: string): string {
  if (!originalUrl || originalUrl === '#') return '#';

  // If destination is a Google Shopping product comparison card, keep it clean so it opens the product sheet directly
  if ((originalUrl.includes('google.com') || originalUrl.includes('google.com.br')) && 
      (originalUrl.includes('ibp=oshop') || originalUrl.includes('prds=') || originalUrl.includes('udm=28'))) {
    return originalUrl;
  }

  const directUrl = extractDirectProductUrl(originalUrl, storeId);
  const targetUrl = directUrl || originalUrl;

  try {
    const url = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`);
    switch (storeId) {
      case 'amazon':
        url.searchParams.set('tag', AFFILIATE_CODES.amazon);
        url.searchParams.set('linkCode', 'll1');
        break;
      case 'shopee': {
        const sTag = AFFILIATE_CODES.shopee;
        url.searchParams.set('mmp_pid', sTag.startsWith('an_') ? sTag : `an_${sTag}`);
        url.searchParams.set('aff_id', sTag.replace('an_', ''));
        url.searchParams.set('smtt', '0.0.9');
        break;
      }
      case 'shein':
        url.searchParams.set('koc_id', AFFILIATE_CODES.shein);
        url.searchParams.set('aff_id', AFFILIATE_CODES.shein);
        url.searchParams.set('ref', AFFILIATE_CODES.shein);
        break;
      case 'temu': {
        const cleanCid = AFFILIATE_CODES.temu.replace(/kol_affiliate/g, '');
        url.searchParams.set('_x_ads_channel', 'kol_affiliate');
        url.searchParams.set('_x_campaign', 'affiliate');
        url.searchParams.set('_x_cid', `${cleanCid}kol_affiliate`);
        url.searchParams.set('_x_ads_csite', 'affiliate_goods_share_v2');
        url.searchParams.set('g_site', '132');
        url.searchParams.set('g_region', '29');
        url.searchParams.set('g_ccy', 'BRL');
        url.searchParams.set('referral_code', AFFILIATE_CODES.temu);
        break;
      }
      case 'aliexpress':
        url.searchParams.set('tracking_id', AFFILIATE_CODES.aliexpress);
        url.searchParams.set('sk', AFFILIATE_CODES.aliexpress);
        url.searchParams.set('aff_trace_key', AFFILIATE_CODES.aliexpress);
        url.searchParams.set('aff_platform', 'portals-tool');
        url.searchParams.set('aff_id', AFFILIATE_CODES.aliexpress);
        break;
      case 'mercadolivre':
        url.searchParams.set('matt_word', AFFILIATE_CODES.mercadolivre);
        url.searchParams.set('matt_tool', '37172851');
        url.searchParams.set('partner_id', AFFILIATE_CODES.mercadolivre);
        url.searchParams.set('tag', AFFILIATE_CODES.mercadolivre);
        break;
      default:
        break;
    }
    return url.toString();
  } catch {
    if (storeId !== 'amazon') return targetUrl;
    const separator = targetUrl.includes('?') ? '&' : '?';
    return `${targetUrl}${separator}tag=${encodeURIComponent(AFFILIATE_CODES.amazon)}`;
  }
}

// -------------------------------------------------------------
// HONEST OFFER MODEL
// A price is only shown when a real source returned it. Stores where the
// product was not found get a link-only entry (priceKnown: false, price 0).
// Nothing here estimates, scales or randomises prices, ratings or sales.
// -------------------------------------------------------------
const COMPARED_STORES = ['mercadolivre', 'amazon', 'shopee', 'shein', 'aliexpress', 'temu'];

// Amazon's Associates policy (Participation Requirements, "Displaying prices and availability") only lets a site show
// an Amazon price that comes from Amazon's own API or from a link Amazon serves. The prices that reach this server
// come from Google Shopping, so showing them is a risk for the Associates account. The owner decided (17/10/2026) to
// show them, so that is the default. AMAZON_SHOW_PRICES=false hides them: Amazon then still appears as a store, with
// the affiliate link and without a price.
const AMAZON_SHOW_PRICES = !['false', '0', 'no', 'off'].includes((process.env.AMAZON_SHOW_PRICES || '').trim().toLowerCase());

const STORE_NAMES: Record<string, string> = {
  amazon: 'Amazon Brasil',
  mercadolivre: 'Mercado Livre',
  shopee: 'Shopee Brasil',
  shein: 'Shein Brasil',
  temu: 'Temu Brasil',
  aliexpress: 'AliExpress Brasil',
  magalu: 'Magazine Luiza'
};

const PLACEHOLDER_IMAGE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#F1F5F9"/><path d="M34 80l17-22 12 15 8-10 15 17z" fill="#CBD5E1"/><circle cx="45" cy="44" r="7" fill="#CBD5E1"/></svg>'
  );

function detectStoreId(text: string): string | null {
  const s = (text || '').toLowerCase();
  if (s.includes('amazon')) return 'amazon';
  if (s.includes('shopee')) return 'shopee';
  if (s.includes('mercado') || s.includes('meli')) return 'mercadolivre';
  if (s.includes('shein')) return 'shein';
  if (s.includes('temu')) return 'temu';
  if (s.includes('aliexpress') || /\bali\b/.test(s)) return 'aliexpress';
  if (s.includes('magalu') || s.includes('magazine luiza') || s.includes('magazineluiza')) return 'magalu';
  return null;
}

interface OfferInput {
  storeId: string;
  storeName?: string;
  price: number;
  originalPrice?: number;
  url: string;
  delivery?: string;
  rating?: number;
  seller?: string;
}

function makeOffer(id: string, o: OfferInput) {
  const freeShipping = /gr[aá]t/i.test(o.delivery || '');
  const hasOriginal = typeof o.originalPrice === 'number' && o.originalPrice > o.price;
  return {
    id,
    storeId: o.storeId,
    storeName: o.storeName || STORE_NAMES[o.storeId] || 'Loja',
    price: o.price,
    priceKnown: true,
    originalPrice: hasOriginal ? o.originalPrice : undefined,
    freteGratis: freeShipping,
    shippingCost: freeShipping ? 0 : undefined,
    rating: o.rating && o.rating > 0 ? o.rating : undefined,
    url: o.url,
    affiliateUrl: buildAffiliateUrl(o.storeId, o.url),
    inStock: true,
    isNationalShipping: ['amazon', 'mercadolivre', 'magalu'].includes(o.storeId) ? true : undefined,
    seller: o.seller,
    isBestPrice: false
  } as any;
}

function makeLinkOnlyOffer(storeId: string, title: string, directUrl?: string) {
  const url = directUrl || generateStoreProductOfferUrl(storeId, title);
  return {
    id: `link-${storeId}`,
    storeId,
    storeName: STORE_NAMES[storeId] || storeId,
    price: 0,
    priceKnown: false,
    freteGratis: false,
    url,
    affiliateUrl: buildAffiliateUrl(storeId, url),
    inStock: true,
    isBestPrice: false
  } as any;
}

// Where each compared store's pages live. A link that does not end up on its store (Google's own product card, an ad
// redirect that cannot be unwrapped) earns no affiliate commission.
const STORE_HOSTS: Record<string, RegExp> = {
  amazon: /(^|\.)amazon\.com(\.br)?$/i,
  mercadolivre: /(^|\.)mercadolivre\.com(\.br)?$/i,
  shopee: /(^|\.)shopee\.com\.br$/i,
  shein: /(^|\.)shein\.com(\.br)?$/i,
  temu: /(^|\.)temu\.com$/i,
  aliexpress: /(^|\.)aliexpress\.(com|us)$/i
};

// True when the link (after unwrapping Google redirects) really lands on a page of that store. Stores without an
// affiliate program are left exactly as Google gave them.
function landsOnStore(storeId: string, rawUrl: string): boolean {
  const hosts = STORE_HOSTS[storeId];
  if (!hosts) return true;
  try {
    const direct = extractDirectProductUrl(rawUrl, storeId) || rawUrl;
    return hosts.test(new URL(direct).hostname);
  } catch {
    return false;
  }
}

// Every priced offer of a compared store must open a page of that store, because that is where the affiliate ID pays.
// When Google only gave its own card, the offer uses the direct page Google also listed for the same product or, failing
// that, the store's own search for it (the affiliate parameters are added either way). The price is not touched.
function landOffersOnTheirStore(offers: any[], priced: any[], directUrlMap: Record<string, string>, title: string) {
  for (const o of offers) {
    if (o.priceKnown === false || landsOnStore(o.storeId, o.url)) continue;
    const page = [directUrlMap[o.storeId], ...priced.filter((p) => p.storeId === o.storeId).map((p) => p.url)].find(
      (u) => u && landsOnStore(o.storeId, u)
    );
    o.url = page || generateStoreProductOfferUrl(o.storeId, title);
    o.affiliateUrl = buildAffiliateUrl(o.storeId, o.url);
  }
}

// Cheapest real offer per store first, then link-only entries for the other compared stores.
function finalizeOffers(priced: any[], title: string, directUrlMap: Record<string, string> = {}) {
  const byKey = new Map<string, any>();
  const urls = { ...directUrlMap };
  for (const o of priced) {
    if (!(o.price > 0)) continue;
    if (o.storeId === 'amazon' && !AMAZON_SHOW_PRICES) {
      // No Amazon price, but the link stays: it carries the affiliate tag.
      if (!urls.amazon && o.url) urls.amazon = o.url;
      continue;
    }
    const key = o.storeId === 'outras' ? `outras:${o.storeName}` : o.storeId;
    const prev = byKey.get(key);
    if (!prev || o.price < prev.price) byKey.set(key, o);
  }
  const known = Array.from(byKey.values()).sort((a, b) => a.price - b.price);
  // "Best price" only means something when at least two real prices are being compared.
  if (known.length >= 2) known[0].isBestPrice = true;
  const present = new Set(known.map((o) => o.storeId));
  const linkOnly = COMPARED_STORES.filter((s) => !present.has(s)).map((s) =>
    // The affiliate ID only pays when the visitor lands on that store: a Google card or a foreign link is replaced by
    // the store's own search for the product.
    makeLinkOnlyOffer(s, title, urls[s] && landsOnStore(s, urls[s]) ? urls[s] : undefined)
  );
  return [...known, ...linkOnly];
}

function stableProductId(item: any, title: string): string {
  if (item && item.product_id) return `prod-${item.product_id}`;
  let h = 0;
  const base = (title || '').toLowerCase();
  for (let i = 0; i < base.length; i++) h = ((h << 5) - h + base.charCodeAt(i)) | 0;
  return `prod-t${Math.abs(h).toString(36)}`;
}

// Builds a product from a Google Shopping result (+ optional immersive store list). Returns null if no real price.
function buildProductFromSerp(item: any, itemStores: any[], category?: string, fallbackTitle = '') {
  const price = extractCleanPrice(item.extracted_price ?? item.price);
  if (!(price > 0)) return null;
  const title = cleanProductTitle(item.title || fallbackTitle);
  if (!title) return null;

  const productLink = item.product_link || item.link || '';
  const directUrlMap: Record<string, string> = {};
  const priced: any[] = [];

  const primaryStore = detectStoreId(item.source || '') || detectStoreId(item.link || '') || 'outras';
  const primaryUrl = item.link || productLink;
  if (primaryUrl) {
    priced.push(
      makeOffer(`off-${primaryStore}-0`, {
        storeId: primaryStore,
        storeName: item.source,
        price,
        originalPrice: extractCleanPrice(item.extracted_old_price ?? item.old_price) || undefined,
        url: primaryUrl,
        delivery: item.delivery,
        rating: Number(item.rating),
        seller: item.source
      })
    );
    if (primaryStore !== 'outras') directUrlMap[primaryStore] = primaryUrl;
  }

  (itemStores || []).forEach((st: any, i: number) => {
    if (!st || !st.link) return;
    const sid = detectStoreId(st.name || '') || 'outras';
    if (sid !== 'outras' && !directUrlMap[sid]) directUrlMap[sid] = st.link;
    const sp = extractCleanPrice(st.extracted_price ?? st.price);
    if (sp > 0) {
      priced.push(
        makeOffer(`off-${sid}-${i + 1}`, {
          storeId: sid,
          storeName: st.name,
          price: sp,
          originalPrice: extractCleanPrice(st.extracted_old_price ?? st.old_price) || undefined,
          url: st.link,
          delivery: String(st.shipping || st.delivery || ''),
          seller: st.name
        })
      );
    }
  });

  const offers = finalizeOffers(priced, title, directUrlMap);
  landOffersOnTheirStore(offers, priced, directUrlMap, title);
  const best = offers.find((o: any) => o.priceKnown !== false);
  if (!best) return null;

  return {
    id: stableProductId(item, title),
    title,
    image: item.thumbnail || PLACEHOLDER_IMAGE,
    category,
    rating: Number(item.rating) > 0 ? Number(item.rating) : 0,
    reviewsCount: Number(item.reviews) > 0 ? Number(item.reviews) : 0,
    offers,
    lowestOffer: best,
    product_link: productLink,
    affiliate_url: best.affiliateUrl,
    checkedAt: Date.now(),
    priceHistory: [] as any[]
  } as any;
}

// True only when a lookup can really be made (and so would really cost a credit). The URL must stay on
// serpapi.com: the API key is appended to it.
function hasImmersiveApi(item: any): boolean {
  const api = item && item.serpapi_immersive_product_api;
  return hasSerpKeys() && typeof api === 'string' && api.startsWith('https://serpapi.com/');
}

async function fetchImmersiveStores(item: any): Promise<any[]> {
  if (!hasImmersiveApi(item)) return [];
  const api = item.serpapi_immersive_product_api as string;
  try {
    const r = await serpFetch(api, 3500);
    if (!r || !r.ok) return [];
    const j: any = await r.json();
    return Array.isArray(j?.product_results?.stores) ? j.product_results.stores : [];
  } catch {
    return [];
  }
}

// -------------------------------------------------------------
// REAL PRICE HISTORY
// Every price we actually observe is recorded (memory + Supabase when configured).
// The history starts empty and grows with real observations; nothing is back-filled.
// -------------------------------------------------------------
interface PricePoint { t: number; price: number; storeName: string }
const priceLog = new Map<string, PricePoint[]>();
const MAX_POINTS_PER_PRODUCT = 200;
const MAX_TRACKED_PRODUCTS = 3000;
const SNAPSHOT_GAP_MS = 30 * 60 * 1000;

function recordPrices(products: any[]) {
  const now = Date.now();
  for (const p of products) {
    const best = p.lowestOffer;
    if (!best || !(best.price > 0)) continue;
    const arr = priceLog.get(p.id) || [];
    const last = arr[arr.length - 1];
    if (last && now - last.t < SNAPSHOT_GAP_MS && last.price === best.price) continue;
    if (last && now - last.t < 60 * 1000) continue;
    arr.push({ t: now, price: best.price, storeName: best.storeName });
    if (arr.length > MAX_POINTS_PER_PRODUCT) arr.shift();
    priceLog.set(p.id, arr);
    if (priceLog.size > MAX_TRACKED_PRODUCTS) {
      const oldest = priceLog.keys().next().value;
      if (oldest !== undefined) priceLog.delete(oldest);
    }
    if (supabaseClient) {
      Promise.resolve(
        supabaseClient.from('historico_precios').insert([
          {
            product_id: p.id,
            product_title: p.title,
            store_id: best.storeId,
            price: best.price,
            captured_at: new Date(now).toISOString()
          }
        ])
      ).catch((err: any) => console.warn('[Supabase] historico_precios insert failed:', err?.message || err));
    }
  }
}

function formatPointLabel(t: number): string {
  return new Date(t).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo'
  });
}

function attachHistory(products: any[]) {
  for (const p of products) {
    const pts = priceLog.get(p.id) || [];
    p.priceHistory = pts.map((pt) => ({ date: formatPointLabel(pt.t), price: pt.price, storeName: pt.storeName }));
    const span = pts.length > 1 ? pts[pts.length - 1].t - pts[0].t : 0;
    p.historyDays = Math.floor(span / (24 * 60 * 60 * 1000));
    const cur = pts.length ? pts[pts.length - 1].price : 0;
    const prevMin = pts.length > 1 ? Math.min(...pts.slice(0, -1).map((x) => x.price)) : Infinity;
    // "Lowest recorded price" only claimed with >= 7 days and >= 3 real observations.
    p.isHistoricalLow = pts.length >= 3 && p.historyDays >= 7 && cur <= prevMin;
  }
}

// -------------------------------------------------------------
// SerpApi credit budget & request rate limiting (protects the API quota)
// -------------------------------------------------------------
// Defaults suit a plan of ~1,000 searches/month. Set SERPAPI_DAILY_BUDGET = monthly credits / 30 for your plan.
const SERPAPI_DAILY_BUDGET = Math.max(0, parseInt(process.env.SERPAPI_DAILY_BUDGET || '30', 10));
// Each "immersive" lookup (extra stores for one product) costs 1 more credit. 0 disables them.
const SERPAPI_IMMERSIVE_LOOKUPS = Math.min(8, Math.max(0, parseInt(process.env.SERPAPI_IMMERSIVE_LOOKUPS || '3', 10)));
let serpSpend = { day: '', used: 0 };
function spendSerp(credits: number): boolean {
  const day = new Date().toISOString().slice(0, 10);
  if (serpSpend.day !== day) serpSpend = { day, used: 0 };
  if (serpSpend.used + credits > SERPAPI_DAILY_BUDGET) return false;
  serpSpend.used += credits;
  return true;
}

// -------------------------------------------------------------
// SerpApi key pool. SERPAPI_API_KEY is used first; SERPAPI_API_KEY_2 only takes over while the first one cannot be
// used (no searches left, hourly limit, rejected). A failing key is set aside for a while ONLY when another key can
// take its place; a single key (or the last one left) is simply tried again on the next request.
// The daily budget above is the TOTAL for all keys together.
// -------------------------------------------------------------
type SerpKeyProblem = 'exhausted' | 'throttled' | 'invalid';
const SERP_KEY_PAUSE_MS: Record<SerpKeyProblem, number> = {
  exhausted: 60 * 60 * 1000,    // 429 "Your account has run out of searches": the quota only returns at renewal
  throttled: 10 * 60 * 1000,    // 429 hourly throughput limit
  invalid: 24 * 60 * 60 * 1000  // 401 invalid key / 403 account disabled
};
const serpKeyPool = SERPAPI_KEYS.map((key, i) => ({ key, name: `clave ${i + 1}`, pausedUntil: 0 }));
if (serpKeyPool.length > 1) {
  console.log(`[SerpApi] ${serpKeyPool.length} claves configuradas: se usa la 1 y la 2 queda de reserva.`);
} else if (process.env.SERPAPI_API_KEY_2 && serpKeyPool.length === 1 && (process.env.SERPAPI_API_KEY || '').trim()) {
  console.warn('[SerpApi] SERPAPI_API_KEY_2 es igual a SERPAPI_API_KEY: se ignora la repetida.');
}

function hasSerpKeys(): boolean {
  return serpKeyPool.length > 0;
}

function classifySerpKeyProblem(status: number, bodyText: string): SerpKeyProblem | null {
  if (status === 401 || status === 403) return 'invalid';
  if (status === 429) return /run out|exhaust|out of searches|plan/i.test(bodyText) ? 'exhausted' : 'throttled';
  return null;
}

// One SerpApi request. It adds the api_key itself (the URL must be on serpapi.com) and moves on to the next key only
// when SerpApi says THIS key cannot be used (401/403/429). Any other answer (5xx, timeouts) goes back to the caller,
// which decides whether to retry. A key is set aside only if another key can take over, so there is always one to try.
// Returns null only for an address outside serpapi.com (nothing is requested, the key never leaves).
async function serpFetch(url: URL | string, timeoutMs: number): Promise<Response | null> {
  const target = new URL(String(url));
  if (target.protocol !== 'https:' || target.hostname !== 'serpapi.com') return null;
  const now = Date.now();
  const ready = serpKeyPool.filter((k) => k.pausedUntil <= now);
  let lastFailure: Response | null = null;
  for (const slot of ready.length ? ready : serpKeyPool) {
    target.searchParams.set('api_key', slot.key);
    const res = await fetch(target.toString(), { signal: AbortSignal.timeout(timeoutMs) });
    if (res.ok) return res;
    let bodyText = '';
    try { bodyText = (await res.clone().text()).slice(0, 300); } catch {}
    const problem = classifySerpKeyProblem(res.status, bodyText);
    if (!problem) return res;
    lastFailure = res;
    if (serpKeyPool.some((k) => k !== slot && k.pausedUntil <= Date.now())) {
      slot.pausedUntil = Date.now() + SERP_KEY_PAUSE_MS[problem];
      const reason = problem === 'exhausted' ? 'sin búsquedas disponibles' : problem === 'throttled' ? 'límite por hora alcanzado' : 'rechazada por SerpApi (revisa la clave)';
      console.warn(`[SerpApi] ${slot.name}: ${reason}. Se usa la otra clave.`);
    }
  }
  return lastFailure;
}

function rateLimit(max: number, windowMs: number) {
  const hits = new Map<string, { count: number; reset: number }>();
  setInterval(() => {
    const n = Date.now();
    for (const [k, v] of hits) if (v.reset <= n) hits.delete(k);
  }, windowMs).unref();
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    const h = hits.get(key);
    if (!h || h.reset <= now) {
      hits.set(key, { count: 1, reset: now + windowMs });
      return next();
    }
    h.count++;
    if (h.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((h.reset - now) / 1000)));
      return res.status(429).json({ error: 'Muitas requisições. Tente novamente em instantes.' });
    }
    next();
  };
}

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeDecode(value: string): string {
  try { return decodeURIComponent(value); } catch { return value; }
}

// -------------------------------------------------------------
// API ROUTES
// -------------------------------------------------------------

// 1. Health check (booleans only: never expose keys or affiliate codes)
app.get('/api/config', (req, res) => {
  res.json({
    status: 'ok',
    hasSerpApi: hasSerpKeys(),
    hasSupabase: Boolean(SUPABASE_URL && (SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY)),
    storageConnected: Boolean(supabaseClient),
    // The UI only offers WhatsApp alerts when something on the server really sends them.
    whatsappAlerts: Boolean(supabaseClient) && process.env.WHATSAPP_ALERTS_ENABLED === 'true',
    // Public contact shown in the footer (privacy requests, corrections). Empty when CONTACT_EMAIL is not set.
    contactEmail: /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test((process.env.CONTACT_EMAIL || '').trim())
      ? (process.env.CONTACT_EMAIL || '').trim()
      : ''
  });
});

// Endpoint to test & verify all affiliate links with real sample store URLs
app.get('/api/test-affiliates', (req, res) => {
  const sampleUrls: Record<string, string> = {
    amazon: 'https://www.amazon.com.br/dp/B09SWW583J',
    shopee: 'https://shopee.com.br/product/298839210/18399541262',
    shein: 'https://br.shein.com/goods-p-6310987385.html',
    temu: 'https://www.temu.com/br/goods-601099.html',
    aliexpress: 'https://pt.aliexpress.com/item/1005001234567.html',
    mercadolivre: 'https://www.mercadolivre.com.br/p/MLB12345678'
  };

  const results = Object.entries(sampleUrls).map(([storeId, testUrl]) => {
    const generatedUrl = buildAffiliateUrl(storeId, testUrl);
    const expectedTag = (AFFILIATE_CODES as any)[storeId] || '';
    const isTagPresent = generatedUrl.includes(expectedTag);

    return {
      storeId,
      storeName: storeId === 'amazon' ? 'Amazon Brasil' :
                 storeId === 'shopee' ? 'Shopee Brasil' :
                 storeId === 'shein' ? 'Shein Brasil' :
                 storeId === 'temu' ? 'Temu Brasil' :
                 storeId === 'aliexpress' ? 'AliExpress' : 'Mercado Livre',
      expectedTag,
      originalUrl: testUrl,
      affiliateUrl: generatedUrl,
      verified: isTagPresent,
      paramUsed: storeId === 'amazon' ? 'tag' :
                 storeId === 'shopee' ? 'mmp_pid' :
                 storeId === 'shein' ? 'koc_id' :
                 storeId === 'temu' ? '_x_cid' :
                 storeId === 'aliexpress' ? 'tracking_id & sk' : 'matt_word & matt_tool'
    };
  });

  res.json({
    timestamp: new Date().toISOString(),
    allVerified: results.every((r) => r.verified),
    tests: results
  });
});

// -------------------------------------------------------------
// SERPAPI ENGINE WITH EXPONENTIAL BACKOFF & REAL-TIME PARAMS (Screenshots 1, 2, 5)
// -------------------------------------------------------------
interface SerpApiFetchResult {
  items: any[];
  retryAttempts: number;
  errorWarning?: string;
  source: 'live' | 'cache' | 'fallback';
}

async function fetchSerpApiWithRetry(
  query: string, 
  maxRetries = 3
): Promise<SerpApiFetchResult> {
  if (!hasSerpKeys()) {
    return { items: [], retryAttempts: 0, source: 'fallback', errorWarning: 'No API key configured' };
  }

  let attempt = 0;
  let delay = 5000; // Screenshot 5: "Si hay errores en la API, reintenta después de 5 segundos con un backoff exponencial"

  while (attempt <= maxRetries) {
    try {
      const serpUrl = new URL('https://serpapi.com/search.json');
      serpUrl.searchParams.set('engine', 'google_shopping');
      serpUrl.searchParams.set('q', query);
      serpUrl.searchParams.set('google_domain', 'google.com.br');
      serpUrl.searchParams.set('gl', 'br');
      serpUrl.searchParams.set('hl', 'pt');
      
      // Screenshot 1 & 5: Real-time search parameter (tbs=qdr:d for last 24h or tbs=qdr:n for latest)
      serpUrl.searchParams.set('tbs', 'qdr:d');

      console.log(`[SerpApi] Requesting real-time Google Shopping (attempt ${attempt + 1}/${maxRetries + 1}): "${query}"`);
      const response = await serpFetch(serpUrl, 9000);
      if (!response) {
        return { items: [], retryAttempts: attempt, source: 'fallback', errorWarning: 'Busca ao vivo indisponível no momento.' };
      }

      if (response.ok) {
        const data = await response.json();
        const rawItems = data.shopping_results || [];

        // Screenshot 4: "La IA debe eliminar resultados irrelevantes (ej: productos de segunda mano, anuncios)"
        const filtered = rawItems.filter((item: any) => {
          const title = item.title || '';
          const snippet = item.snippet || '';
          if (IRRELEVANT_OR_USED_REGEX.test(title) || IRRELEVANT_OR_USED_REGEX.test(snippet)) {
            return false;
          }
          return true;
        });

        return {
          items: filtered,
          retryAttempts: attempt,
          source: 'live'
        };
      }

      // 429 may be "too many requests" (retry) or "plan exhausted" (retrying only wastes time).
      if (response.status === 429 || response.status >= 500) {
        let bodyText = '';
        try { bodyText = (await response.text()).slice(0, 300); } catch {}
        if (response.status === 429 && /run out|exhaust|out of searches|plan/i.test(bodyText)) {
          console.warn('[SerpApi] Cota do plano esgotada.');
          return { items: [], retryAttempts: attempt, source: 'fallback', errorWarning: 'Limite de buscas ao vivo atingido. Tente novamente mais tarde.' };
        }
        console.warn(`[SerpApi] HTTP ${response.status}. Retrying in ${delay / 1000}s with exponential backoff...`);
        attempt++;
        if (attempt <= maxRetries) {
          await new Promise((r) => setTimeout(r, delay));
          delay *= 2; // Exponential backoff (5s -> 10s -> 20s)
          continue;
        }
      } else {
        const errText = await response.text();
        console.warn(`[SerpApi] HTTP ${response.status}: ${errText.slice(0, 100)}`);
        break;
      }
    } catch (err: any) {
      console.warn(`[SerpApi] Connection issue on attempt ${attempt + 1}:`, err.message);
      attempt++;
      if (attempt <= maxRetries) {
        console.log(`[SerpApi] Retrying in ${delay / 1000}s (Exponential backoff)...`);
        await new Promise((r) => setTimeout(r, delay));
        delay *= 2; // Exponential backoff
      } else {
        return {
          items: [],
          retryAttempts: attempt,
          source: 'fallback',
          errorWarning: `SerpApi indisponível após ${maxRetries} tentativas. Retentando em breve.`
        };
      }
    }
  }

  return { items: [], retryAttempts: attempt, source: 'fallback', errorWarning: 'Busca ao vivo indisponível no momento.' };
}

// 2. Shopping search. Only real SerpApi / Supabase data is returned. If nothing real is available, the list is empty.
const searchLimiter = rateLimit(12, 60 * 1000);
// "Atualizar" never bypasses a cache entry younger than this (protects the API quota).
const MIN_FORCE_REFRESH_GAP_MS = 10 * 60 * 1000;
const MIN_LIVE_DEALS_REFRESH_GAP_MS = 30 * 60 * 1000;

app.get('/api/search', searchLimiter, async (req, res) => {
  const query = String(req.query.q || '').replace(/\s+/g, ' ').trim().slice(0, 100);
  if (!query) {
    return res.json({ products: [] });
  }

  const cacheKey = query.toLowerCase();
  const cached = searchCache.get(cacheKey);
  const now = Date.now();
  const wantsRefresh = req.query.refresh === 'true';
  // A forced refresh only bypasses the cache when the cached copy is old enough.
  const refreshAllowed = !cached || now - cached.cachedAt >= MIN_FORCE_REFRESH_GAP_MS;

  if (cached && cached.expires > now && !(wantsRefresh && refreshAllowed)) {
    return res.json({
      products: cached.data,
      cached: true,
      cacheExpiresInSeconds: Math.max(0, Math.round((cached.expires - now) / 1000)),
      lastUpdated: `Hoje às ${new Date(cached.cachedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}`,
      hasSignificantChange: Boolean(cached.hasSignificantChange)
    });
  }

  let products: any[] = [];
  let retryCount = 0;
  let errorNotice: string | undefined;

  if (!hasSerpKeys()) {
    errorNotice = 'Busca ao vivo indisponível no momento.';
  } else if (!spendSerp(1)) {
    errorNotice = 'Limite diário de buscas ao vivo atingido. Tente novamente amanhã.';
  } else {
    const serpResult = await fetchSerpApiWithRetry(query, 1);
    retryCount = serpResult.retryAttempts;
    errorNotice = serpResult.errorWarning;

    const topItems = (Array.isArray(serpResult.items) ? serpResult.items : []).slice(0, 8);
    // Immersive lookups cost one SerpApi credit each: only the first results that support them get one,
    // and only while the daily budget lasts. A credit is counted only when a lookup is really made.
    let lookupsLeft = SERPAPI_IMMERSIVE_LOOKUPS;
    const storesList = await Promise.all(
      topItems.map((it: any) => {
        if (lookupsLeft > 0 && hasImmersiveApi(it) && spendSerp(1)) {
          lookupsLeft--;
          return fetchImmersiveStores(it);
        }
        return Promise.resolve([] as any[]);
      })
    );

    products = topItems
      .map((item: any, idx: number) => buildProductFromSerp(item, storesList[idx] || [], undefined, query))
      .filter(Boolean);

    // Same product can come back twice; keep the first.
    const seen = new Set<string>();
    products = products.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
    // Keep Google's relevance order: the client sorts by price when the visitor asks for it.
  }

  // Curated deals stored by the owner in Supabase ('ofertas_locales') complete thin results.
  if (supabaseClient && products.length < 3) {
    try {
      const { data: dbDeals } = await supabaseClient
        .from('ofertas_locales')
        .select('*')
        .ilike('titulo', `%${query.replace(/[%_]/g, ' ')}%`)
        .limit(6);

      if (dbDeals && dbDeals.length > 0) {
        const dbProducts = dbDeals
          .map((deal: any) => {
            const price = extractCleanPrice(deal.preco);
            if (!(price > 0)) return null;
            const title = cleanProductTitle(deal.titulo || query);
            const ownUrl = deal.affiliate_url || deal.url_afiliado || deal.link_afiliado || deal.url || '';
            const storeId = detectStoreId(deal.loja || deal.store || '') || detectStoreId(ownUrl) || 'outras';
            const offer = makeOffer(`off-db-${deal.id}`, { storeId, storeName: deal.loja || deal.store, price, url: ownUrl || generateStoreProductOfferUrl(storeId, title) });
            if (ownUrl) {
              offer.affiliateUrl = ownUrl;
            }
            const offers = finalizeOffers([offer], title);
            const lowest = offers.find((o: any) => o.priceKnown !== false);
            // With AMAZON_SHOW_PRICES=false a hand-typed Amazon price is hidden too: then there is nothing to list.
            if (!lowest) return null;
            return {
              id: `prod-db-${deal.id}`,
              title,
              image: deal.imagem_url || PLACEHOLDER_IMAGE,
              rating: 0,
              reviewsCount: 0,
              offers,
              lowestOffer: lowest,
              affiliate_url: ownUrl,
              // The owner typed this price: show when it was entered, never "just checked".
              checkedAt: Number.isFinite(new Date(deal.updated_at || deal.created_at || '').getTime())
                ? new Date(deal.updated_at || deal.created_at).getTime()
                : undefined,
              priceHistory: [] as any[]
            };
          })
          .filter(Boolean);
        const existing = new Set(products.map((p) => p.id));
        products = [...products, ...dbProducts.filter((p: any) => !existing.has(p.id))];
      }
    } catch (err) {
      console.warn('[Supabase] Error querying ofertas_locales:', err);
    }
  }

  // Only prices the stores really returned count as observations (not the owner's curated prices).
  recordPrices(products.filter((p) => !String(p.id).startsWith('prod-db-')));
  attachHistory(products);
  const { hasSignificantChange, priceDrops } = detectPriceChanges(products);

  if (products.length > 0) {
    searchCache.set(cacheKey, {
      data: products,
      expires: Date.now() + CACHE_TTL_MS,
      cachedAt: Date.now(),
      hasSignificantChange
    });
    if (searchCache.size > 500) {
      const oldest = searchCache.keys().next().value;
      if (oldest !== undefined) searchCache.delete(oldest);
    }
  }

  const currentTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

  res.json({
    products,
    cached: false,
    cacheExpiresInSeconds: Math.round(CACHE_TTL_MS / 1000),
    hasSignificantChange,
    priceDrops,
    lastUpdated: `Hoje às ${currentTime}`,
    retryAttempts: retryCount,
    errorWarning: products.length === 0 ? (errorNotice || undefined) : undefined
  });
});

// Real price history observed by this server for one product.
app.get('/api/price-history', async (req, res) => {
  const id = String(req.query.id || '').slice(0, 120);
  if (!id) return res.status(400).json({ error: 'id obrigatório' });

  let points: { date: string; price: number; storeName?: string }[] = [];
  if (supabaseClient) {
    try {
      const { data } = await supabaseClient
        .from('historico_precios')
        .select('price, store_id, captured_at')
        .eq('product_id', id)
        .order('captured_at', { ascending: true })
        .limit(200);
      if (Array.isArray(data)) {
        points = data.map((r: any) => ({
          date: formatPointLabel(new Date(r.captured_at).getTime()),
          price: Number(r.price),
          storeName: STORE_NAMES[r.store_id] || r.store_id
        }));
      }
    } catch {}
  }
  if (points.length === 0) {
    points = (priceLog.get(id) || []).map((pt) => ({ date: formatPointLabel(pt.t), price: pt.price, storeName: pt.storeName }));
  }
  const first = points.length ? points[0] : null;
  res.json({ points, observedSince: first ? first.date : null });
});

// -------------------------------------------------------------
// LIVE DEALS (home page). Built only from real Google Shopping results.
// -------------------------------------------------------------
const LIVE_SEEDS = [
  { seed: 'tenis corrida', cat: 'Moda Feminina' },
  { seed: 'fone bluetooth', cat: 'Áudio & Fones' },
  { seed: 'air fryer fritadeira', cat: 'Cozinha & Casa' },
  { seed: 'smartwatch relogio', cat: 'Celulares & Smartphones' }
];

// Home deals are refreshed about once a day by default because every refresh spends SerpApi credits.
const LIVE_DEALS_TTL_MS = Math.max(5, parseInt(process.env.LIVE_DEALS_TTL_MINUTES || '1440', 10)) * 60 * 1000;
let liveDealsCache: { data: any; expires: number; builtAt: number } | null = null;

app.get('/api/live-deals', async (req, res) => {
  const now = Date.now();
  const wantsRefresh = req.query.refresh === 'true';
  const refreshAllowed = !liveDealsCache || now - liveDealsCache.builtAt >= MIN_LIVE_DEALS_REFRESH_GAP_MS;

  if (liveDealsCache && liveDealsCache.expires > now && !(wantsRefresh && refreshAllowed)) {
    return res.json(liveDealsCache.data);
  }

  let products: any[] = [];
  if (hasSerpKeys() && spendSerp(LIVE_SEEDS.length)) {
    const results = await Promise.allSettled(
      LIVE_SEEDS.map(async ({ seed, cat }) => {
        const serpUrl = new URL('https://serpapi.com/search.json');
        serpUrl.searchParams.set('engine', 'google_shopping');
        serpUrl.searchParams.set('q', seed);
        serpUrl.searchParams.set('google_domain', 'google.com.br');
        serpUrl.searchParams.set('gl', 'br');
        serpUrl.searchParams.set('hl', 'pt');
        const r = await serpFetch(serpUrl, 6000);
        if (!r || !r.ok) return [] as any[];
        const data: any = await r.json();
        const items: any[] = Array.isArray(data.shopping_results) ? data.shopping_results : [];
        // Build first and cut afterwards: a result with no publishable price (Amazon's, or none at all) must not
        // use up one of the three places of its seed.
        return items
          .filter((it) => !IRRELEVANT_OR_USED_REGEX.test(`${it.title || ''} ${it.snippet || ''}`))
          .map((it) => buildProductFromSerp(it, [], cat, seed))
          .filter(Boolean)
          .slice(0, 3);
      })
    );
    const seen = new Set<string>();
    products = results
      .flatMap((r) => (r.status === 'fulfilled' ? (r.value as any[]) : []))
      .filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
  }

  // If the refresh failed but older real data exists, keep serving it and say so.
  if (products.length === 0 && liveDealsCache) {
    return res.json({ ...liveDealsCache.data, stale: true });
  }

  recordPrices(products);
  attachHistory(products);
  const { hasSignificantChange, priceDrops } = detectPriceChanges(products);
  const timeString = new Date(now).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
  const ttlSeconds = Math.round(LIVE_DEALS_TTL_MS / 1000);

  const payload = {
    status: products.length > 0 ? 'ok' : 'unavailable',
    isRealTime: false,
    lastUpdated: `Hoje às ${timeString}`,
    timestamp: now,
    cacheExpiresInSeconds: ttlSeconds,
    nextUpdateSeconds: ttlSeconds,
    hasSignificantChange,
    priceDrops,
    flashDeals: products.slice(0, 8),
    featuredDeals: products.slice(0, 12),
    allProducts: products,
    errorWarning: products.length > 0 ? undefined : 'Ofertas indisponíveis no momento. Tente novamente em alguns minutos.'
  };

  if (products.length > 0) {
    liveDealsCache = { data: payload, expires: now + LIVE_DEALS_TTL_MS, builtAt: now };
  }
  res.json(payload);
});

// Coupons are NEVER generated. They come from data/coupons.json (maintained by the owner) and,
// when configured, the Supabase table 'cupons'. Each one needs an expiry date and a verification date.
interface StoredCoupon {
  id?: string;
  storeId: string;
  code: string;
  discountText: string;
  minSpendText?: string;
  description?: string;
  isExclusiveApp?: boolean;
  url?: string;
  expiresAt: string;   // ISO date: coupons past this date are dropped
  verifiedAt: string;  // ISO date: when you last tested the code
}

function readLocalCoupons(): StoredCoupon[] {
  try {
    const raw = fs.readFileSync(path.resolve('data/coupons.json'), 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

app.get('/api/live-coupons', async (req, res) => {
  let stored: StoredCoupon[] = readLocalCoupons();

  if (supabaseClient) {
    try {
      const { data } = await supabaseClient.from('cupons').select('*').limit(100);
      if (Array.isArray(data)) {
        stored = stored.concat(
          data.map((r: any) => ({
            id: r.id ? `db-${r.id}` : undefined,
            storeId: r.store_id,
            code: r.code,
            discountText: r.discount_text,
            minSpendText: r.min_spend_text,
            description: r.description,
            isExclusiveApp: Boolean(r.is_exclusive_app),
            url: r.url,
            expiresAt: r.expires_at,
            verifiedAt: r.verified_at
          }))
        );
      }
    } catch {}
  }

  const now = Date.now();
  const coupons = stored
    .filter((c) => c && c.code && c.storeId && c.discountText && c.expiresAt && c.verifiedAt)
    .filter((c) => new Date(c.expiresAt).getTime() > now)
    .map((c, i) => {
      const exp = new Date(c.expiresAt);
      const ver = new Date(c.verifiedAt);
      const verifiedRecently = now - ver.getTime() < 48 * 60 * 60 * 1000;
      const storeUrl = c.url || STORE_DOMAIN_URLS[c.storeId] || '';
      return {
        id: c.id || `coup-${c.storeId}-${i}`,
        storeId: c.storeId,
        storeName: STORE_NAMES[c.storeId] || c.storeId,
        code: c.code,
        discountText: c.discountText,
        minSpendText: c.minSpendText || '',
        expirationText: `Válido até ${exp.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })}`,
        isExclusiveApp: Boolean(c.isExclusiveApp),
        isVerified: verifiedRecently,
        verifiedAtText: `Testado em ${ver.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })}`,
        description: c.description || '',
        affiliateUrl: storeUrl ? buildAffiliateUrl(c.storeId, storeUrl) : '#'
      };
    });

  res.json({ status: 'ok', updatedAt: new Date().toISOString(), coupons });
});

const STORE_DOMAIN_URLS: Record<string, string> = {
  amazon: 'https://www.amazon.com.br',
  mercadolivre: 'https://www.mercadolivre.com.br',
  shopee: 'https://shopee.com.br',
  shein: 'https://br.shein.com',
  temu: 'https://www.temu.com/br',
  aliexpress: 'https://pt.aliexpress.com',
  magalu: 'https://www.magazineluiza.com.br'
};

// 3. Price alerts. Requires explicit consent for WhatsApp (LGPD) and a configured database.
const alertsLimiter = rateLimit(5, 10 * 60 * 1000);
app.post('/api/alerts', alertsLimiter, async (req, res) => {
  const body = req.body || {};
  const productId = typeof body.productId === 'string' ? body.productId.slice(0, 120) : '';
  const targetPrice = Number(body.targetPrice);
  const currentPrice = Number(body.currentPrice);
  const whatsappDigits = typeof body.whatsapp === 'string' ? body.whatsapp.replace(/\D/g, '') : '';

  if (!productId || !(targetPrice > 0) || targetPrice > 10_000_000) {
    return res.status(400).json({ success: false, message: 'Dados inválidos.' });
  }
  if (!whatsappDigits) {
    return res.status(400).json({ success: false, message: 'Informe um WhatsApp para receber o aviso.' });
  }
  if (!/^\d{10,11}$/.test(whatsappDigits)) {
    return res.status(400).json({ success: false, message: 'WhatsApp inválido. Use DDD + número.' });
  }
  if (body.consent !== true) {
    return res.status(400).json({ success: false, message: 'É necessário aceitar o contato por WhatsApp.' });
  }
  if (!supabaseClient || process.env.WHATSAPP_ALERTS_ENABLED !== 'true') {
    return res.status(503).json({ success: false, message: 'Alertas por WhatsApp ainda não estão ativos.' });
  }

  try {
    const { error } = await supabaseClient.from('alertas_usuario').insert([
      {
        product_id: productId,
        product_title: String(body.productTitle || '').slice(0, 200),
        target_price: targetPrice,
        current_price: Number.isFinite(currentPrice) ? currentPrice : null,
        whatsapp: whatsappDigits,
        consent_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      }
    ]);
    if (error) throw error;
    res.json({ success: true, message: 'Alerta registrado.' });
  } catch (err) {
    console.warn('[Supabase] Failed to persist alert:', err);
    res.status(500).json({ success: false, message: 'Não foi possível registrar o alerta agora.' });
  }
});

// Helper for SEO Prerendering and dynamic metadata injection
// Public origin used in canonical URLs, sitemap and robots. PUBLIC_URL wins; otherwise the Host header is used
// only after it passes a strict check (a spoofed Host must never end up inside the sitemap).
function getBaseUrl(req: express.Request): string {
  const configured = (process.env.PUBLIC_URL || '').trim().replace(/\/+$/, '');
  if (/^https?:\/\/[a-z0-9.-]+(:\d{1,5})?$/i.test(configured)) return configured;
  const raw = String(req.get('x-forwarded-host') || req.get('host') || '').split(',')[0].trim().toLowerCase();
  const host = /^[a-z0-9.-]+(:\d{1,5})?$/.test(raw) ? raw : 'localhost';
  const isLocal = /^(localhost|127\.|0\.0\.0\.0)/.test(host);
  return `${isLocal ? 'http' : 'https'}://${host}`;
}

// Same ids and names as CATEGORY_TILES in src/components/ExploreCategories.tsx (each one runs a real search in the app).
const CATEGORY_NAMES: Record<string, string> = {
  celulares: 'Celulares',
  audio: 'Áudio e fones',
  games: 'Games',
  relogios: 'Relógios',
  cozinha: 'Casa e cozinha',
  tenis: 'Tênis',
  roupas: 'Roupas',
  beleza: 'Beleza',
  esportes: 'Esportes'
};
const SITEMAP_CATEGORIES = Object.keys(CATEGORY_NAMES);

function buildJsonLd(baseUrl: string): string {
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${baseUrl}/#organization`,
        name: 'PreçoCerto Brasil',
        url: `${baseUrl}/`,
        logo: `${baseUrl}/pwa-512x512.png`
      },
      {
        '@type': 'WebSite',
        '@id': `${baseUrl}/#website`,
        url: `${baseUrl}/`,
        name: 'PreçoCerto Brasil',
        description: 'Comparador de preços das maiores lojas do Brasil: Amazon, Mercado Livre, Shopee, Shein, Temu e AliExpress.',
        inLanguage: 'pt-BR',
        publisher: { '@id': `${baseUrl}/#organization` },
        potentialAction: {
          '@type': 'SearchAction',
          target: { '@type': 'EntryPoint', urlTemplate: `${baseUrl}/busca/{search_term_string}` },
          'query-input': 'required name=search_term_string'
        }
      }
    ]
  };
  // "<" is escaped so nothing inside the JSON can ever close the script tag.
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

const STORES_TEXT = 'Amazon, Mercado Livre, Shopee, Shein, Temu e AliExpress';

// Which screen an address belongs to. It mirrors parseRoute in src/utils/route.ts; any other address is a 404.
type SeoRoute =
  | { kind: 'home' }
  | { kind: 'search'; term: string }
  | { kind: 'category'; id: string }
  | { kind: 'categories' }
  | { kind: 'coupons' }
  | { kind: 'notfound' };

function classifySeoRoute(requestPath: string): SeoRoute {
  const clean = requestPath.replace(/\/+$/, '') || '/';
  const lower = clean.toLowerCase();
  if (lower === '/') return { kind: 'home' };
  if (lower.startsWith('/busca/')) {
    const term = safeDecode(lower.slice('/busca/'.length)).replace(/-/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
    return term ? { kind: 'search', term } : { kind: 'notfound' };
  }
  if (lower.startsWith('/categoria/')) {
    const id = safeDecode(lower.slice('/categoria/'.length));
    return Object.hasOwn(CATEGORY_NAMES, id) ? { kind: 'category', id } : { kind: 'notfound' };
  }
  if (lower === '/categorias') return { kind: 'categories' };
  if (lower === '/cupons') return { kind: 'coupons' };
  return { kind: 'notfound' };
}

// Returns the page for crawlers and first paint, and the HTTP status that goes with it.
function renderHtmlWithSeo(req: express.Request, rawHtml: string): { html: string; status: number } {
  const baseUrl = getBaseUrl(req);
  const requestPath = (req.originalUrl || req.url || req.path || '/').split('?')[0];
  const route = classifySeoRoute(requestPath);
  const ogImageUrl = `${baseUrl}/og-image.png`;

  let canonicalUrl = `${baseUrl}${requestPath.replace(/\/+$/, '')}`;
  let status = 200;
  let robots = '';
  let pageTitle = 'PreçoCerto Brasil - Comparador de preços das maiores lojas';
  let pageDesc = `Compare preços na ${STORES_TEXT} e vá direto à loja com o menor preço que encontramos. Sem cadastro.`;
  let dynamicCrawlerContent = '';

  // h1 and bodyHtml: the caller escapes anything that comes from the address.
  const crawlerSection = (h1: string, bodyHtml: string) => `
      <section style="max-width: 1200px; margin: 20px auto; padding: 16px; font-family: Inter, system-ui, sans-serif; line-height: 1.5;">
        <h1 style="font-size: 24px; font-weight: 800; margin: 0 0 8px;">${escapeHtml(h1)}</h1>
        <p style="margin: 0;">${bodyHtml}</p>
      </section>
    `;

  if (route.kind === 'search') {
    const term = route.term.charAt(0).toUpperCase() + route.term.slice(1);
    pageTitle = `${term} - Compare preços nas lojas | PreçoCerto`;
    pageDesc = `Compare preços de ${term} na ${STORES_TEXT} e vá direto à loja.`;
    // Internal search pages stay out of Google's index: they are endless, thin, and each one costs a SerpApi credit.
    robots = 'noindex, follow';
    dynamicCrawlerContent = crawlerSection(
      `${term} - comparação de preços`,
      `Compare os preços de <strong>${escapeHtml(term)}</strong> nas maiores lojas do Brasil. Carregando as ofertas…`
    );
  } else if (route.kind === 'category') {
    const name = CATEGORY_NAMES[route.id];
    canonicalUrl = `${baseUrl}/categoria/${route.id}`;
    pageTitle = `${name} - Compare preços nas lojas | PreçoCerto`;
    pageDesc = `Compare preços de ${name} na ${STORES_TEXT} e vá direto à loja.`;
    dynamicCrawlerContent = crawlerSection(
      `${name} - comparação de preços`,
      `Produtos de ${escapeHtml(name)} comparados entre as maiores lojas do Brasil. Carregando as ofertas…`
    );
  } else if (route.kind === 'categories') {
    canonicalUrl = `${baseUrl}/categorias`;
    pageTitle = 'Categorias - Compare preços nas lojas | PreçoCerto';
    pageDesc = `Escolha uma categoria e compare preços na ${STORES_TEXT}.`;
  } else if (route.kind === 'coupons') {
    canonicalUrl = `${baseUrl}/cupons`;
    pageTitle = 'Cupons de desconto com validade | PreçoCerto';
    pageDesc = 'Cupons para Amazon, Shopee, Mercado Livre, Shein, AliExpress e Temu. Só mostramos os que estão no prazo, com a data de validade e do último teste.';
  } else if (route.kind === 'notfound') {
    // The app still opens (a mistyped address lands on the home screen), but crawlers get a real 404 and
    // nothing typed in the address ever becomes the title of an indexable page.
    status = 404;
    robots = 'noindex';
    canonicalUrl = '';
    pageTitle = 'Página não encontrada | PreçoCerto';
    pageDesc = 'Esse endereço não existe no PreçoCerto Brasil. Volte para a página inicial e compare preços nas lojas.';
    dynamicCrawlerContent = crawlerSection(
      'Página não encontrada',
      'Esse endereço não existe. <a href="/">Ir para a página inicial</a>.'
    );
  }

  // Everything below is escaped: pageTitle/pageDesc/canonicalUrl can contain user-controlled text.
  const eTitle = escapeHtml(pageTitle);
  const eDesc = escapeHtml(pageDesc);
  const eCanon = escapeHtml(canonicalUrl);
  const eShareUrl = escapeHtml(canonicalUrl || baseUrl);
  const eOg = escapeHtml(ogImageUrl);
  const robotsTag = robots ? `\n    <meta name="robots" content="${robots}" />` : '';
  const setTag = (html: string, re: RegExp, replacement: string) => html.replace(re, () => replacement);

  let modified = setTag(rawHtml, /<title>.*?<\/title>/i, `<title>${eTitle}</title>`);
  modified = setTag(modified, /<meta name="description" content=".*?" \/>/i, `<meta name="description" content="${eDesc}" />${robotsTag}`);
  modified = setTag(modified, /<link rel="canonical" href=".*?" \/>/i, canonicalUrl ? `<link rel="canonical" href="${eCanon}" />` : '');
  modified = setTag(modified, /<meta property="og:title" content=".*?" \/>/i, `<meta property="og:title" content="${eTitle}" />`);
  modified = setTag(modified, /<meta property="og:description" content=".*?" \/>/i, `<meta property="og:description" content="${eDesc}" />`);
  modified = setTag(modified, /<meta property="og:url" content=".*?" \/>/i, `<meta property="og:url" content="${eShareUrl}" />`);
  modified = setTag(modified, /<meta property="og:image" content=".*?" \/>/i, `<meta property="og:image" content="${eOg}" />`);
  modified = setTag(modified, /<meta property="og:image:secure_url" content=".*?" \/>/i, `<meta property="og:image:secure_url" content="${eOg}" />`);
  modified = setTag(modified, /<meta name="twitter:title" content=".*?" \/>/i, `<meta name="twitter:title" content="${eTitle}" />`);
  modified = setTag(modified, /<meta name="twitter:description" content=".*?" \/>/i, `<meta name="twitter:description" content="${eDesc}" />`);
  modified = setTag(modified, /<meta name="twitter:url" content=".*?" \/>/i, `<meta name="twitter:url" content="${eShareUrl}" />`);
  modified = setTag(modified, /<meta name="twitter:image" content=".*?" \/>/i, `<meta name="twitter:image" content="${eOg}" />`);
  modified = setTag(
    modified,
    /<script type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/i,
    `<script type="application/ld+json" id="ld-json">${buildJsonLd(baseUrl)}</script>`
  );

  // Inject dynamic crawler content inside root if available
  if (dynamicCrawlerContent && modified.includes('<div id="root">')) {
    modified = modified.replace('<div id="root">', () => `<div id="root">${dynamicCrawlerContent}`);
  }

  return { html: modified, status };
}

// robots.txt and sitemap.xml are generated so they always carry the real public origin.
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(`User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${getBaseUrl(req)}/sitemap.xml\n`);
});

app.get('/sitemap.xml', (req, res) => {
  const base = getBaseUrl(req);
  const paths = ['/', '/cupons', ...SITEMAP_CATEGORIES.map((c) => `/categoria/${c}`)];
  const urls = paths.map((p) => `  <url><loc>${escapeHtml(base + p)}</loc></url>`).join('\n');
  res.type('application/xml');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
});

app.get('/manifest.json', (req, res) => {
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.sendFile(path.resolve('public/manifest.json'));
});

app.get('/apple-touch-icon.png', (req, res) => {
  res.type('image/png');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(path.resolve('public/apple-touch-icon.png'));
});

app.get('/og-image.png', (req, res) => {
  res.type('image/png');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(path.resolve('public/og-image.png'));
});

app.get('/og-image.jpg', (req, res) => {
  res.type('image/jpeg');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(path.resolve('public/og-image.jpg'));
});

// Unknown API routes answer JSON (never the HTML app).
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Rota não encontrada.' });
});

// Setup Vite or static serving
async function startServer() {
  if (!isProd) {
    // Vite is a development tool: it is loaded only here, so production starts faster, uses less memory and
    // does not need it installed.
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });

    app.use(vite.middlewares);

    // Serve HTML with dynamic SEO replacement in development
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      if (url.startsWith('/api') || url.startsWith('/@') || url.startsWith('/src') || url.startsWith('/node_modules')) {
        return next();
      }

      try {
        let template = fs.readFileSync(path.resolve('index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        const { html, status } = renderHtmlWithSeo(req, template);
        res.status(status).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const distPath = path.resolve('dist');
    if (fs.existsSync(distPath)) {
      // Vite file names carry a content hash, so they can be cached for a year.
      app.use('/assets', express.static(path.join(distPath, 'assets'), { immutable: true, maxAge: '1y' }));
      app.use(express.static(distPath, { index: false }));
      // A hashed file that does not exist (an old page asking for a file of a previous release) must be a 404,
      // never the HTML app: a browser or a service worker could otherwise keep that HTML as if it were a script.
      app.use('/assets', (req, res) => {
        res.status(404).type('text/plain').send('Arquivo não encontrado.');
      });
      app.get('*', (req, res) => {
        try {
          const template = fs.readFileSync(path.resolve(distPath, 'index.html'), 'utf-8');
          const { html, status } = renderHtmlWithSeo(req, template);
          res.status(status).set({ 'Content-Type': 'text/html' }).end(html);
        } catch {
          res.sendFile(path.resolve(distPath, 'index.html'));
        }
      });
    } else {
      console.error('[PreçoCerto Brasil] A pasta dist/ não existe. Rode "npm run build" antes de iniciar em produção.');
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[PreçoCerto Brasil] Servidor rodando em http://localhost:${PORT}`);
  });
}

startServer();
