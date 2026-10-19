import { StoreId, StoreMetadata } from '../types/index';

// USER'S OFFICIAL AFFILIATE IDS (Configured directly from user brief):
export const DEFAULT_AFFILIATE_TAGS: Record<StoreId, string> = {
  amazon: 'jorgeahf-20',
  shopee: 'an_18399541262',
  shein: '6310987385',
  temu: '2127307378',
  aliexpress: 'JorgeAHF',
  mercadolivre: 'jh20260503160333',
  outras: ''
};

export const STORES_METADATA: Record<StoreId, StoreMetadata> = {
  amazon: {
    id: 'amazon',
    name: 'Amazon',
    badgeBg: 'bg-[#FF9900]/10',
    badgeTextColor: 'text-[#B86B00]',
    borderColor: 'border-[#FF9900]/30',
    logoIcon: '📦',
    primaryColor: '#FF9900',
    affiliateParamName: 'tag',
    defaultAffiliateTag: DEFAULT_AFFILIATE_TAGS.amazon,
    domainUrl: 'https://www.amazon.com.br'
  },
  mercadolivre: {
    id: 'mercadolivre',
    name: 'Mercado Livre',
    badgeBg: 'bg-[#FFE600]/20',
    badgeTextColor: 'text-[#2D3277]',
    borderColor: 'border-[#FFE600]/40',
    logoIcon: '🤝',
    primaryColor: '#FFE600',
    affiliateParamName: 'matt_tool',
    defaultAffiliateTag: DEFAULT_AFFILIATE_TAGS.mercadolivre,
    domainUrl: 'https://www.mercadolivre.com.br'
  },
  shopee: {
    id: 'shopee',
    name: 'Shopee',
    badgeBg: 'bg-[#EE4D2D]/10',
    badgeTextColor: 'text-[#EE4D2D]',
    borderColor: 'border-[#EE4D2D]/30',
    logoIcon: '🛍️',
    primaryColor: '#EE4D2D',
    affiliateParamName: 'aff_id',
    defaultAffiliateTag: DEFAULT_AFFILIATE_TAGS.shopee,
    domainUrl: 'https://shopee.com.br'
  },
  shein: {
    id: 'shein',
    name: 'Shein',
    badgeBg: 'bg-black/10',
    badgeTextColor: 'text-black',
    borderColor: 'border-black/30',
    logoIcon: '👗',
    primaryColor: '#000000',
    affiliateParamName: 'aff_id',
    defaultAffiliateTag: DEFAULT_AFFILIATE_TAGS.shein,
    domainUrl: 'https://br.shein.com'
  },
  temu: {
    id: 'temu',
    name: 'Temu',
    badgeBg: 'bg-[#FB7701]/10',
    badgeTextColor: 'text-[#FB7701]',
    borderColor: 'border-[#FB7701]/30',
    logoIcon: '🎁',
    primaryColor: '#FB7701',
    affiliateParamName: 'referral_code',
    defaultAffiliateTag: DEFAULT_AFFILIATE_TAGS.temu,
    domainUrl: 'https://www.temu.com/br'
  },
  aliexpress: {
    id: 'aliexpress',
    name: 'AliExpress',
    badgeBg: 'bg-[#FF4747]/10',
    badgeTextColor: 'text-[#E62E04]',
    borderColor: 'border-[#FF4747]/30',
    logoIcon: '✈️',
    primaryColor: '#FF4747',
    affiliateParamName: 'tracking_id',
    defaultAffiliateTag: DEFAULT_AFFILIATE_TAGS.aliexpress,
    domainUrl: 'https://pt.aliexpress.com'
  },
  outras: {
    id: 'outras',
    name: 'Outras lojas',
    badgeBg: 'bg-slate-100',
    badgeTextColor: 'text-slate-700',
    borderColor: 'border-slate-200',
    logoIcon: '🛒',
    primaryColor: '#64748B',
    affiliateParamName: '',
    defaultAffiliateTag: '',
    domainUrl: ''
  }
};

/**
 * Detects the store automatically from a given product URL
 */
export function detectStoreFromUrl(url: string): StoreId {
  const lower = (url || '').toLowerCase();
  if (lower.includes('amazon.')) return 'amazon';
  if (lower.includes('mercadolivre.') || lower.includes('mercadolibre.')) return 'mercadolivre';
  if (lower.includes('shopee.')) return 'shopee';
  if (lower.includes('shein.')) return 'shein';
  if (lower.includes('temu.')) return 'temu';
  if (lower.includes('aliexpress.') || lower.includes('alibab')) return 'aliexpress';
  return 'outras';
}

/**
 * Transforms a direct product_url into an exact monetized affiliate URL.
 * If no tag is configured for the store, it returns the original product_url untouched.
 */
export function monetizeProductUrl(productUrl: string, storeId?: StoreId): string {
  if (!productUrl || productUrl === '#') return '#';
  const detectedStore = storeId || detectStoreFromUrl(productUrl);
  return buildAffiliateUrl(detectedStore, productUrl);
}

/**
 * Creates a clean direct search keyword from a product title, removing filler words
 */
export function extractProductSearchQuery(title: string): string {
  if (!title) return '';
  return title
    .replace(/[^\w\s\u00C0-\u00FF-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 7)
    .join(' ');
}

/**
 * Returns a direct targeted search URL for an exact store so the customer lands
 * straight on the product offer rather than just on the store's homepage.
 */
export function getDirectStoreSearchUrl(storeId: StoreId, productTitle: string): string {
  const cleanQuery = extractProductSearchQuery(productTitle);
  const encoded = encodeURIComponent(cleanQuery);

  switch (storeId) {
    case 'amazon':
      return `https://www.amazon.com.br/s?k=${encoded}`;
    case 'mercadolivre':
      return `https://lista.mercadolivre.com.br/${cleanQuery.replace(/\s+/g, '-')}`;
    case 'shopee':
      return `https://shopee.com.br/search?keyword=${encoded}`;
    case 'shein':
      return `https://br.shein.com/pdsearch/${encoded}`;
    case 'temu':
      return `https://www.temu.com/br/search_result.html?search_key=${encoded}`;
    case 'aliexpress':
      return `https://pt.aliexpress.com/wholesale?SearchText=${encoded}`;
    default:
      return `https://www.google.com/search?q=${encoded}`;
  }
}

/**
 * Extracts the direct, specific product URL from any raw URL,
 * unwrapping Google redirects and extracting product IDs (ASIN, MLB, etc.)
 * as specified in the store rules. Never returns generic search URLs.
 */
export function extractDirectProductUrl(rawUrl: string, storeId: StoreId, productTitle?: string): string {
  if (!rawUrl || rawUrl === '#') return '';
  let targetUrl = rawUrl.trim();

  // 1. Unwrap Google Shopping redirect URLs (google.com/url, googleadservices, aclk)
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
      // fallback to regex extraction of nested destination url
      const matchUrl = targetUrl.match(/(?:url|q|adurl|destination)=([^&]+)/i);
      if (matchUrl && matchUrl[1]) {
        try {
          targetUrl = decodeURIComponent(matchUrl[1]);
        } catch {}
      }
    }
  }

  // 2. Extract specific Product ID according to store rules (Screenshots 1-6 & 10-17)
  switch (storeId) {
    case 'amazon': {
      // Extract 10-character alphanumeric ASIN (Screenshots 3, 4, 11, 17)
      const asinMatch = targetUrl.match(/(?:dp|gp\/product|product|d)\/([A-Z0-9]{10})/i) ||
                        targetUrl.match(/[?&]asin=([A-Z0-9]{10})/i) ||
                        targetUrl.match(/\/([B0-9][A-Z0-9]{9})(?:[/?&#]|$)/i);
      if (asinMatch && asinMatch[1]) {
        return `https://www.amazon.com.br/dp/${asinMatch[1].toUpperCase()}`;
      }
      break;
    }

    case 'mercadolivre': {
      // Extract MLB or MLA Product ID (Screenshots 2, 3, 11)
      const mlbMatch = targetUrl.match(/p\/(MLB\d+)/i) ||
                       targetUrl.match(/(MLB-?\d{7,14})/i) ||
                       targetUrl.match(/(MLA-?\d{7,14})/i);
      if (mlbMatch && mlbMatch[1]) {
        const cleanId = mlbMatch[1].replace('-', '');
        return `https://www.mercadolivre.com.br/p/${cleanId}`;
      }
      break;
    }

    case 'shopee': {
      // Extract shop_id and item_id (Screenshots 1, 2, 10, 14)
      const shopeeMatch = targetUrl.match(/-i\.(\d+)\.(\d+)/) ||
                          targetUrl.match(/product\/(\d+)\/(\d+)/);
      if (shopeeMatch && shopeeMatch[1] && shopeeMatch[2]) {
        return `https://shopee.com.br/product/${shopeeMatch[1]}/${shopeeMatch[2]}`;
      }
      break;
    }

    case 'aliexpress': {
      // Extract numeric item ID (Screenshots 4, 5, 12)
      const aliMatch = targetUrl.match(/item\/(\d+)\.html/) ||
                       targetUrl.match(/\/(\d{10,16})\.html/) ||
                       targetUrl.match(/[?&]id=(\d{10,16})/);
      if (aliMatch && aliMatch[1]) {
        return `https://pt.aliexpress.com/item/${aliMatch[1]}.html`;
      }
      break;
    }

    case 'shein': {
      // Extract product ID after p- (Screenshots 5, 6, 12)
      const sheinMatch = targetUrl.match(/[/-]p-(\d+)\.html/) ||
                         targetUrl.match(/goods-p-(\d+)/) ||
                         targetUrl.match(/[?&]goods_id=(\d+)/);
      if (sheinMatch && sheinMatch[1]) {
        return `https://br.shein.com/goods-p-${sheinMatch[1]}.html`;
      }
      break;
    }

    case 'temu': {
      // Extract goods ID (Screenshots 6, 7, 13)
      const temuMatch = targetUrl.match(/goods-(\d+)\.html/) ||
                        targetUrl.match(/goods_id=(\d+)/) ||
                        targetUrl.match(/-g-(\d+)/) ||
                        targetUrl.match(/\/(\d{8,14})\.html/);
      if (temuMatch && temuMatch[1]) {
        return `https://www.temu.com/br/goods-${temuMatch[1]}.html`;
      }
      break;
    }
  }

  // 3. If targetUrl is a Google Shopping official product page, keep it! It directly shows the product sheet with all store offers
  if (targetUrl && (targetUrl.includes('google.com') || targetUrl.includes('google.com.br')) && (targetUrl.includes('ibp=oshop') || targetUrl.includes('prds=') || targetUrl.includes('udm=28'))) {
    return targetUrl;
  }

  // 4. If targetUrl is an existing direct product URL on the store domain, keep it!
  if (targetUrl && 
      !targetUrl.includes('/s?k=') && 
      !targetUrl.includes('/search?') && 
      !targetUrl.includes('/busca/') &&
      !targetUrl.includes('/wholesale?') &&
      !targetUrl.includes('/search_result.html')) {
    return targetUrl;
  }

  return targetUrl;
}

export function getActiveAffiliateTag(storeId: StoreId): string {
  try {
    const saved = localStorage.getItem(`affiliate_tag_${storeId}`);
    if (saved && saved.trim()) return saved.trim();
  } catch {
    // ignore
  }
  return DEFAULT_AFFILIATE_TAGS[storeId] || '';
}

export function saveAffiliateTag(storeId: StoreId, tag: string): void {
  try {
    localStorage.setItem(`affiliate_tag_${storeId}`, tag.trim());
  } catch {
    // ignore
  }
}

/**
 * Builds the official monetized affiliate link by appending the correct store affiliate parameters
 * strictly following Screenshots 1 to 8 and 10 to 17:
 * - Amazon: tag=TU_TAG&linkCode=ll1
 * - Shopee: aff_id=TU_ID&smtt=0.0.9
 * - Mercado Livre: partner_id=TU_ID&tag=TU_ID
 * - AliExpress: aff_id=TU_ID&sk=TU_ID
 * - Shein: aff_id=TU_ID&ref=TU_ID
 * - Temu: aff_id=TU_ID&referral_code=TU_ID
 */
export function buildAffiliateUrl(storeId: StoreId, originalUrl: string, customTag?: string): string {
  const tag = customTag || getActiveAffiliateTag(storeId);
  if (!originalUrl || originalUrl === '#') return '#';

  // First unwrap and clean any Google redirects or product IDs
  const directProductUrl = extractDirectProductUrl(originalUrl, storeId);
  const targetUrl = directProductUrl || originalUrl;

  // If destination is a Google Shopping product page, keep it clean so it opens the exact product card directly
  if (targetUrl.includes('google.com') || targetUrl.includes('google.com.br')) {
    return targetUrl;
  }

  if (!tag) return targetUrl; // If no tag is configured, open clean product URL

  try {
    const url = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`);

    switch (storeId) {
      case 'amazon':
        url.searchParams.set('tag', tag);
        url.searchParams.set('linkCode', 'll1');
        break;

      case 'shopee': {
        const shopeePid = tag.startsWith('an_') ? tag : `an_${tag}`;
        url.searchParams.set('mmp_pid', shopeePid);
        url.searchParams.set('aff_id', tag.replace('an_', ''));
        url.searchParams.set('smtt', '0.0.9');
        break;
      }

      case 'shein':
        url.searchParams.set('koc_id', tag);
        url.searchParams.set('aff_id', tag);
        url.searchParams.set('ref', tag);
        break;

      case 'temu': {
        const cleanCid = tag.replace(/kol_affiliate/g, '');
        url.searchParams.set('_x_ads_channel', 'kol_affiliate');
        url.searchParams.set('_x_campaign', 'affiliate');
        url.searchParams.set('_x_cid', `${cleanCid}kol_affiliate`);
        url.searchParams.set('_x_ads_csite', 'affiliate_goods_share_v2');
        url.searchParams.set('g_site', '132');
        url.searchParams.set('g_region', '29');
        url.searchParams.set('g_ccy', 'BRL');
        url.searchParams.set('referral_code', tag);
        break;
      }

      case 'aliexpress':
        url.searchParams.set('tracking_id', tag);
        url.searchParams.set('sk', tag);
        url.searchParams.set('aff_trace_key', tag);
        url.searchParams.set('aff_platform', 'portals-tool');
        url.searchParams.set('aff_id', tag);
        break;

      case 'mercadolivre':
        url.searchParams.set('matt_word', tag);
        url.searchParams.set('matt_tool', '37172851');
        url.searchParams.set('partner_id', tag);
        url.searchParams.set('tag', tag);
        break;

      default:
        url.searchParams.set('ref', tag);
        break;
    }

    return url.toString();
  } catch {
    const separator = targetUrl.includes('?') ? '&' : '?';
    return `${targetUrl}${separator}tag=${encodeURIComponent(tag)}`;
  }
}

export interface AffiliateClickRecord {
  id: string;
  timestamp: string;
  storeId: StoreId;
  productId: string;
  productTitle?: string;
  price: number;
  affiliateUrl?: string;
  tagUsed: string;
}

export function trackAffiliateClick(
  storeId: StoreId,
  productId: string,
  price: number,
  productTitle?: string,
  affiliateUrl?: string
): void {
  try {
    const history = JSON.parse(localStorage.getItem('affiliate_clicks_history') || '[]');
    const record: AffiliateClickRecord = {
      id: `clk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      storeId,
      productId,
      productTitle: productTitle || 'Produto em Destaque',
      price,
      affiliateUrl: affiliateUrl || buildAffiliateUrl(storeId, 'https://shopee.com.br'),
      tagUsed: getActiveAffiliateTag(storeId)
    };
    history.unshift(record);
    localStorage.setItem('affiliate_clicks_history', JSON.stringify(history.slice(0, 100)));
  } catch {
    // ignore
  }
}

export function getAffiliateClicksHistory(): AffiliateClickRecord[] {
  try {
    return JSON.parse(localStorage.getItem('affiliate_clicks_history') || '[]');
  } catch {
    return [];
  }
}

export function clearAffiliateClicksHistory(): void {
  try {
    localStorage.removeItem('affiliate_clicks_history');
  } catch {}
}

export function formatBRL(amount: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(amount);
}
