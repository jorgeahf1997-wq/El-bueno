import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { BottomNavBar } from './components/BottomNavBar';
import type { ActiveTabType } from './components/BottomNavBar';
import { HeroIntro } from './components/HeroIntro';
import { CATEGORY_TILES, ExploreCategories } from './components/ExploreCategories';
import { FreshnessBar } from './components/FreshnessBar';
import { HighlightsSection } from './components/HighlightsSection';
import { SpecialCouponsSection } from './components/SpecialCouponsSection';
import { CouponsSection } from './components/CouponsSection';
import { AlertsBanner } from './components/AlertsBanner';
import { SearchResultsView, sortLabel } from './components/SearchResultsView';
import { ProductCard } from './components/ProductCard';
import { ProductDetailModal } from './components/ProductDetailModal';
import { PriceHistoryModal } from './components/PriceHistoryModal';
import { PriceAlertModal } from './components/PriceAlertModal';
import { ShareModal } from './components/ShareModal';
import { AdvancedFilters } from './components/AdvancedFilters';
import { AddProductModal } from './components/AddProductModal';
import { OptionsMenuModal } from './components/OptionsMenuModal';
import { RemessaConformeModal } from './components/RemessaConformeModal';
import { InstallModal } from './components/InstallModal';
import { ApiConfigModal } from './components/ApiConfigModal';
import { AffiliateNotice } from './components/AffiliateNotice';
import { usePWAInstall } from './hooks/usePWAInstall';
import { useTheme } from './hooks/useTheme';
import type { CouponItem, FilterState, PriceDropEvent, Product, ProductOffer, SortOption } from './types';
import { buildAffiliateUrl } from './utils/affiliate';
import { DEFAULT_FILTERS, applyFilters, countByStore, hasActiveFilters, isExtraPoolSort } from './utils/filters';
import type { ExtraPoolSort } from './utils/filters';
import { findTriggered, loadAlerts, removeAlert } from './utils/alerts';
import type { SavedAlert, TriggeredAlert } from './utils/alerts';
import { PLACEHOLDER_IMAGE, bestOffer, isCuratedProduct, isUserProduct } from './utils/offers';
import { categoryPath, cleanTerm, isAdminLocation, parseRoute, searchPath } from './utils/route';
import type { Route } from './utils/route';
import { categoriesMeta, categoryMeta, couponsMeta, searchMeta, updatePageMeta } from './utils/seo';

type View = 'home' | 'categories' | 'search' | 'coupons';
type Phase = 'idle' | 'loading' | 'ok' | 'error';

/** One list of products (home highlights or search results) together with how fresh it is. */
interface Feed {
  phase: Phase;
  products: Product[];
  /** When a store price in this list was really consulted (ms). Undefined when nothing here came from a store. */
  checkedAt?: number;
  updatedText: string;
  notice: string;
  drops: PriceDropEvent[];
  refreshing: boolean;
  /** false when the order asked for (price, discount) could not be asked to Google, so it covers only the list already found. */
  sortApplied: boolean;
  /** Why the order could not be applied, in the server's words. */
  sortNotice: string;
}

const EMPTY_FEED: Feed = {
  phase: 'idle',
  products: [],
  updatedText: '',
  notice: '',
  drops: [],
  refreshing: false,
  sortApplied: true,
  sortNotice: ''
};

/** The lists the server can give for one search: the normal one, and the ones Google itself sorted by price or discount. */
type PoolKey = 'relevance' | ExtraPoolSort;

/**
 * Which list an order is applied to. Price and discount orders have their own list (asked to Google when first chosen).
 * Rating and reviews have none on Google's side, so they order the biggest list already found for this search.
 */
function poolFor(sort: SortOption, cache: Map<PoolKey, Feed>): PoolKey {
  if (isExtraPoolSort(sort)) return sort;
  if (sort === 'relevance') return 'relevance';
  let best: PoolKey = 'relevance';
  let size = cache.get('relevance')?.products.length ?? 0;
  cache.forEach((feed, key) => {
    if (feed.sortApplied && feed.products.length > size) {
      best = key;
      size = feed.products.length;
    }
  });
  return best;
}

const RECENT_KEY = 'precocerto_recent_searches';
const CUSTOM_KEY = 'precocerto_custom_products';
const MAX_RECENT = 6;
const MAX_CUSTOM = 30;
const COUPONS_REFETCH_MS = 10 * 60 * 1000;

const STALE_NOTICE = 'Não conseguimos atualizar agora. Mostrando os últimos preços que consultamos.';
const RATE_LIMIT_NOTICE = 'Muitas buscas seguidas. Aguarde um minuto e tente de novo.';
const SEARCH_DOWN_NOTICE = 'A busca ao vivo não está disponível agora. Tente de novo em instantes.';

/* ---------- small, defensive helpers ---------- */

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

function isProduct(value: unknown): value is Product {
  if (!value || typeof value !== 'object') return false;
  const p = value as Partial<Product>;
  return typeof p.id === 'string' && typeof p.title === 'string' && Array.isArray(p.offers);
}

const asProducts = (value: unknown): Product[] => (Array.isArray(value) ? value.filter(isProduct) : []);

const asDrops = (value: unknown): PriceDropEvent[] =>
  Array.isArray(value)
    ? value.filter((d): d is PriceDropEvent => {
        const drop = asRecord(d);
        return typeof drop.productId === 'string' && typeof drop.oldPrice === 'number' && typeof drop.newPrice === 'number';
      })
    : [];

const asCoupons = (value: unknown): CouponItem[] =>
  Array.isArray(value)
    ? value.filter((c): c is CouponItem => {
        const coupon = asRecord(c);
        return typeof coupon.id === 'string' && typeof coupon.code === 'string';
      })
    : [];

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable or full: the choice simply is not remembered
  }
}

function loadRecent(): string[] {
  const raw = readJson<unknown>(RECENT_KEY, []);
  return Array.isArray(raw)
    ? raw.filter((t): t is string => typeof t === 'string' && t.trim().length > 0).slice(0, MAX_RECENT)
    : [];
}

function safeAffiliateUrl(storeId: ProductOffer['storeId'], url: string): string {
  try {
    return buildAffiliateUrl(storeId, url);
  } catch {
    return url; // unknown store in an old saved product: the plain link still works
  }
}

/**
 * Products saved by older versions may carry data that was never real (a 4.9 rating, "+500 vendidos",
 * a made-up price history, a Pix discount). Only what the visitor typed is kept: title, image, link and price.
 * The affiliate link is rebuilt with the current rules.
 */
function cleanCustom(value: unknown): Product | null {
  if (!isProduct(value)) return null;
  const offers: ProductOffer[] = value.offers
    .filter((o) => o && typeof o.price === 'number' && o.price > 0 && typeof o.url === 'string' && o.url)
    .map((o) => ({
      id: asString(o.id) || `offer-custom-${value.id}`,
      storeId: o.storeId,
      storeName: asString(o.storeName) || 'Loja',
      price: o.price,
      priceKnown: true,
      originalPrice: typeof o.originalPrice === 'number' && o.originalPrice > o.price ? o.originalPrice : undefined,
      freteGratis: false,
      url: o.url,
      affiliateUrl: safeAffiliateUrl(o.storeId, o.url),
      inStock: true
    }));
  if (offers.length === 0) return null;

  const lowest = offers.reduce((a, b) => (b.price < a.price ? b : a));
  return {
    id: value.id,
    title: value.title,
    image: asString(value.image) || PLACEHOLDER_IMAGE,
    rating: 0,
    reviewsCount: 0,
    offers,
    lowestOffer: lowest,
    affiliate_url: lowest.affiliateUrl,
    affiliateUrl: lowest.affiliateUrl,
    checkedAt: typeof value.checkedAt === 'number' ? value.checkedAt : undefined,
    priceHistory: []
  };
}

function loadCustomProducts(): Product[] {
  const raw = readJson<unknown>(CUSTOM_KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .map(cleanCustom)
    .filter((p): p is Product => p !== null)
    .slice(0, MAX_CUSTOM);
}

/** Newest time a store price was really consulted. Prices typed by the owner or by the visitor do not count. */
function latestCheck(list: Product[]): number | undefined {
  let newest: number | undefined;
  for (const p of list) {
    if (isUserProduct(p) || isCuratedProduct(p)) continue;
    const at = p.checkedAt;
    if (typeof at === 'number' && Number.isFinite(at) && (newest === undefined || at > newest)) newest = at;
  }
  return newest;
}

/** Changes the address without adding a history entry when it is already the current one. */
function pushUrl(path: string): void {
  try {
    if (window.location.pathname + window.location.search !== path) window.history.pushState({}, '', path);
  } catch {
    // some embedded browsers block the history API: navigation still works inside the app
  }
}

const scrollToTop = () => window.scrollTo({ top: 0, left: 0, behavior: 'auto' });

function viewOf(route: Route): View {
  switch (route.kind) {
    case 'search':
      return 'search';
    case 'categories':
      return 'categories';
    case 'coupons':
      return 'coupons';
    default:
      return 'home';
  }
}

const chipClass =
  'px-3 py-1.5 rounded-full bg-surface border border-slate-200 text-xs font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50';

/* ---------- the app ---------- */

export const App: React.FC = () => {
  const { choice: themeChoice, resolved: resolvedTheme, setTheme, toggle: toggleTheme } = useTheme();
  const pwa = usePWAInstall();

  // The screen starts on the one the address asks for, so a visitor who lands on /busca/... never pays for
  // the home highlights (each one costs search credits) and never sees an empty "no results" frame.
  const [initialRoute] = useState<Route>(() => parseRoute(window.location, CATEGORY_TILES));
  const startsOnSearch = initialRoute.kind === 'search';

  const [view, setView] = useState<View>(() => viewOf(initialRoute));
  const [searchInput, setSearchInput] = useState(() =>
    initialRoute.kind === 'search' && !initialRoute.categoryId ? initialRoute.term : ''
  );
  const [activeTerm, setActiveTerm] = useState(() => (initialRoute.kind === 'search' ? initialRoute.term : ''));
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(() =>
    initialRoute.kind === 'search' ? initialRoute.categoryId : null
  );
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  const [home, setHome] = useState<Feed>(EMPTY_FEED);
  const [search, setSearch] = useState<Feed>(() => (startsOnSearch ? { ...EMPTY_FEED, phase: 'loading' } : EMPTY_FEED));
  const [coupons, setCoupons] = useState<CouponItem[]>([]);
  const [couponsLoaded, setCouponsLoaded] = useState(false);

  const [customProducts, setCustomProducts] = useState<Product[]>(loadCustomProducts);
  const [recent, setRecent] = useState<string[]>(loadRecent);
  const [alerts, setAlerts] = useState<SavedAlert[]>(loadAlerts);

  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [alertProduct, setAlertProduct] = useState<Product | null>(null);
  const [shareProduct, setShareProduct] = useState<Product | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showRemessa, setShowRemessa] = useState(false);
  const [remessaBRL, setRemessaBRL] = useState<number | undefined>(undefined);
  const [showConfig, setShowConfig] = useState(false);

  const mainRef = useRef<HTMLElement>(null);
  /** Counts searches so an answer that arrives late (after a newer search) is ignored. */
  const searchSeq = useRef(0);
  const homeSeq = useRef(0);
  const lastTerm = useRef('');
  const homeRequested = useRef(false);
  const couponsFetchedAt = useRef(0);
  const booted = useRef(false);
  const viewMounted = useRef(false);
  /** The lists already fetched for the search on screen, so changing the order back and forth costs nothing. */
  const poolCache = useRef(new Map<PoolKey, Feed>());
  /** Which of them is on screen. */
  const shownKey = useRef<PoolKey>('relevance');
  const filtersRef = useRef<FilterState>(DEFAULT_FILTERS);

  /* ----- data ----- */

  const loadCoupons = useCallback(async (force: boolean) => {
    const now = Date.now();
    if (!force && couponsFetchedAt.current && now - couponsFetchedAt.current < COUPONS_REFETCH_MS) return;
    couponsFetchedAt.current = now;
    try {
      const res = await fetch('/api/live-coupons');
      if (res.ok) setCoupons(asCoupons(asRecord(await res.json()).coupons));
    } catch {
      // coupons are optional: the section simply stays empty
    } finally {
      setCouponsLoaded(true);
    }
  }, []);

  const loadHome = useCallback(async (refresh: boolean) => {
    const seq = ++homeSeq.current;
    setHome((prev) => ({
      ...prev,
      phase: refresh && prev.products.length > 0 ? prev.phase : 'loading',
      refreshing: true,
      notice: ''
    }));

    const keepOldOrFail = () =>
      setHome((prev) =>
        prev.products.length > 0
          ? { ...prev, refreshing: false, notice: STALE_NOTICE }
          : { ...prev, phase: 'error', refreshing: false, notice: '' }
      );

    try {
      const res = await fetch(`/api/live-deals${refresh ? '?refresh=true' : ''}`);
      if (seq !== homeSeq.current) return;
      if (!res.ok) {
        keepOldOrFail();
        return;
      }
      const body = asRecord(await res.json());
      if (seq !== homeSeq.current) return;
      const list = asProducts(body.allProducts);
      if (body.status === 'ok' && list.length > 0) {
        setHome({
          phase: 'ok',
          products: list,
          checkedAt: typeof body.timestamp === 'number' ? body.timestamp : latestCheck(list),
          updatedText: asString(body.lastUpdated),
          notice: body.stale === true ? STALE_NOTICE : '',
          drops: asDrops(body.priceDrops),
          refreshing: false,
          sortApplied: true,
          sortNotice: ''
        });
      } else {
        keepOldOrFail();
      }
    } catch {
      if (seq !== homeSeq.current) return;
      keepOldOrFail();
    }
  }, []);

  const rememberSearch = useCallback((term: string) => {
    const next = [term, ...loadRecent().filter((t) => t.toLowerCase() !== term.toLowerCase())].slice(0, MAX_RECENT);
    writeJson(RECENT_KEY, next);
    setRecent(next);
  }, []);

  /** Asks the server for one list of the search (the normal one, or one Google sorted) and puts it on screen. */
  const fetchPool = useCallback(async (term: string, key: PoolKey, opts: { refresh?: boolean } = {}) => {
    const refresh = Boolean(opts.refresh);
    const seq = ++searchSeq.current;
    setSearch((prev) =>
      refresh && prev.products.length > 0 ? { ...prev, refreshing: true, notice: '' } : { ...EMPTY_FEED, phase: 'loading' }
    );

    const fail = (status?: number) => {
      const notice = status === 429 ? RATE_LIMIT_NOTICE : SEARCH_DOWN_NOTICE;
      const normal = poolCache.current.get('relevance');
      if (key !== 'relevance' && normal && normal.products.length > 0) {
        // The sorted list could not be fetched, but the normal one is here: show it and say it is not the whole order.
        shownKey.current = 'relevance';
        setSearch({ ...normal, refreshing: false, sortApplied: false, sortNotice: notice });
        return;
      }
      setSearch((prev) =>
        prev.products.length > 0 ? { ...prev, refreshing: false, notice } : { ...EMPTY_FEED, phase: 'error', notice }
      );
    };

    try {
      const sortParam = key === 'relevance' ? '' : `&sort=${key}`;
      const res = await fetch(`/api/search?q=${encodeURIComponent(term)}${sortParam}${refresh ? '&refresh=true' : ''}`);
      if (seq !== searchSeq.current) return;
      if (!res.ok) {
        fail(res.status);
        return;
      }
      const body = asRecord(await res.json());
      if (seq !== searchSeq.current) return;
      const list = asProducts(body.products);
      const feed: Feed = {
        phase: 'ok',
        products: list,
        checkedAt: latestCheck(list),
        updatedText: asString(body.lastUpdated),
        notice: list.length === 0 ? asString(body.errorWarning) : asString(body.notice),
        drops: asDrops(body.priceDrops),
        refreshing: false,
        sortApplied: body.sortApplied !== false,
        sortNotice: asString(body.sortNotice)
      };
      // A refreshed list makes the others old: they are fetched again when the visitor picks them. A list the server could
      // not sort is not kept, so choosing that order again tries again.
      if (refresh) poolCache.current.clear();
      if (feed.sortApplied) poolCache.current.set(key, feed);
      shownKey.current = key;
      setSearch(feed);
    } catch {
      if (seq !== searchSeq.current) return;
      fail();
    }
  }, []);

  const runSearch = useCallback(
    async (raw: string, opts: { refresh?: boolean; push?: boolean; categoryId?: string | null } = {}) => {
      const term = cleanTerm(raw);
      if (!term) return;
      const refresh = Boolean(opts.refresh);
      const push = opts.push !== false;
      const tile = opts.categoryId ? CATEGORY_TILES.find((t) => t.id === opts.categoryId) : undefined;

      const termChanged = lastTerm.current !== term;
      lastTerm.current = term;

      if (!refresh) {
        setView('search');
        setActiveTerm(term);
        setActiveCategoryId(tile ? tile.id : null);
        setSearchInput(tile ? '' : term);
        if (termChanged) setFilters(DEFAULT_FILTERS);
        poolCache.current.clear();
        if (push) pushUrl(tile ? categoryPath(tile.id) : searchPath(term));
        updatePageMeta(tile ? categoryMeta(tile.name) : searchMeta(term));
        if (push && !tile) rememberSearch(term);
        scrollToTop();
      }

      // A new search starts with the normal list; the same search asked again keeps the order the visitor had chosen.
      const key: PoolKey = refresh ? shownKey.current : termChanged ? 'relevance' : poolFor(filtersRef.current.sortBy, poolCache.current);
      await fetchPool(term, key, { refresh });
    },
    [rememberSearch, fetchPool]
  );

  /* ----- navigation ----- */

  const openHome = useCallback((push = true) => {
    searchSeq.current++; // a search that is still loading no longer matters
    lastTerm.current = '';
    poolCache.current.clear();
    shownKey.current = 'relevance';
    setView('home');
    setSearchInput('');
    setActiveTerm('');
    setActiveCategoryId(null);
    setSearch(EMPTY_FEED);
    setFilters(DEFAULT_FILTERS);
    if (push) pushUrl('/');
    updatePageMeta();
    scrollToTop();
  }, []);

  const openCategories = useCallback((push = true) => {
    setView('categories');
    if (push) pushUrl('/categorias');
    updatePageMeta(categoriesMeta());
    scrollToTop();
  }, []);

  const openCoupons = useCallback(
    (push = true) => {
      setView('coupons');
      if (push) pushUrl('/cupons');
      updatePageMeta(couponsMeta());
      scrollToTop();
      void loadCoupons(false);
    },
    [loadCoupons]
  );

  const applyRoute = useCallback(
    (route: Route, push: boolean) => {
      switch (route.kind) {
        case 'search':
          void runSearch(route.term, { push, categoryId: route.categoryId });
          break;
        case 'categories':
          openCategories(push);
          break;
        case 'coupons':
          openCoupons(push);
          break;
        default:
          openHome(push);
      }
    },
    [runSearch, openCategories, openCoupons, openHome]
  );

  // First load: read the address once (and open the owner area when the address asks for it).
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    if (isAdminLocation(window.location)) setShowConfig(true);
    applyRoute(parseRoute(window.location, CATEGORY_TILES), false);
  }, [applyRoute]);

  // Back and forward buttons.
  useEffect(() => {
    const onPop = () => applyRoute(parseRoute(window.location, CATEGORY_TILES), false);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [applyRoute]);

  // The home highlights are fetched the first time the home screen is shown.
  useEffect(() => {
    if (view !== 'home' || homeRequested.current) return;
    homeRequested.current = true;
    void loadHome(false);
  }, [view, loadHome]);

  // Coupons are fetched once at the start so the home strip knows whether there is anything to show.
  useEffect(() => {
    void loadCoupons(false);
  }, [loadCoupons]);

  // After moving to another screen, keyboard and screen-reader users start at its content.
  useEffect(() => {
    if (!viewMounted.current) {
      viewMounted.current = true;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
  }, [view]);

  /* ----- handlers ----- */

  const focusSearch = () => document.getElementById('busca')?.focus();

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cleanTerm(searchInput)) {
      focusSearch();
      return;
    }
    // On phones the keyboard would cover the results.
    if (window.matchMedia?.('(pointer: coarse)').matches && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    void runSearch(searchInput);
  };

  const activeCategory = activeCategoryId ? CATEGORY_TILES.find((t) => t.id === activeCategoryId) : undefined;

  const returnToSearch = () => {
    setView('search');
    pushUrl(activeCategory ? categoryPath(activeCategory.id) : searchPath(activeTerm));
    updatePageMeta(activeCategory ? categoryMeta(activeCategory.name) : searchMeta(activeTerm));
    scrollToTop();
  };

  const handleSelectTab = (tab: ActiveTabType) => {
    switch (tab) {
      case 'home':
        openHome();
        break;
      case 'categories':
        openCategories();
        break;
      case 'coupons':
        openCoupons();
        break;
      case 'profile':
        setShowOptions(true);
        break;
      case 'search':
        if (view !== 'search' && activeTerm) returnToSearch();
        else focusSearch();
        break;
    }
  };

  const searchFromTile = useCallback(
    (term: string) => {
      const tile = CATEGORY_TILES.find((t) => t.term === term);
      void runSearch(term, { categoryId: tile ? tile.id : null });
    },
    [runSearch]
  );

  // Picking an order puts the matching list on screen: the one Google sorted (asked to the server the first time), or one that
  // was already fetched. Changing the order back and forth does not ask the server again.
  const selectOrder = (sort: SortOption) => {
    if (!activeTerm) return;
    const key = poolFor(sort, poolCache.current);
    const kept = poolCache.current.get(key);
    if (kept) {
      searchSeq.current++; // a list that was still loading no longer matters
      shownKey.current = key;
      setSearch(kept);
    } else {
      void fetchPool(activeTerm, key);
    }
  };

  const handleFilterChange = (updates: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...updates }));
    if (updates.sortBy !== undefined) selectOrder(updates.sortBy);
  };

  // "Limpar filtros" also brings back the normal order, and with it the normal list.
  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    selectOrder(DEFAULT_FILTERS.sortBy);
  };

  const refreshSearch = () => {
    if (activeTerm) void runSearch(activeTerm, { refresh: true, push: false, categoryId: activeCategoryId });
  };

  const retrySortedList = () => {
    if (!activeTerm || !isExtraPoolSort(filters.sortBy)) return;
    poolCache.current.delete(filters.sortBy);
    void fetchPool(activeTerm, filters.sortBy);
  };

  const addCustomProduct = (product: Product) => {
    const next = [product, ...loadCustomProducts()].slice(0, MAX_CUSTOM);
    writeJson(CUSTOM_KEY, next);
    setCustomProducts(next);
  };

  const removeCustomProduct = (id: string) => {
    const next = loadCustomProducts().filter((p) => p.id !== id);
    writeJson(CUSTOM_KEY, next);
    setCustomProducts(next);
  };

  const clearRecent = () => {
    writeJson(RECENT_KEY, []);
    setRecent([]);
  };

  const openTriggered = (t: TriggeredAlert) => setDetailProduct(t.product);

  const dismissTriggered = (t: TriggeredAlert) => {
    removeAlert(t.alert.id);
    setAlerts(loadAlerts());
  };

  const openRemessaCalculator = () => {
    setRemessaBRL(undefined);
    setShowRemessa(true);
  };

  const openRemessaFromProduct = () => {
    const best = detailProduct ? bestOffer(detailProduct) : null;
    setRemessaBRL(best ? best.price : undefined);
    setShowRemessa(true);
  };

  /* ----- derived values ----- */

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const visibleResults = useMemo(() => applyFilters(search.products, filters), [search.products, filters]);
  const storeCounts = useMemo(() => countByStore(search.products, filters), [search.products, filters]);
  const sortNotice =
    search.phase === 'ok' && !search.sortApplied && isExtraPoolSort(filters.sortBy)
      ? { label: sortLabel(filters.sortBy), reason: search.sortNotice }
      : undefined;

  // Alerts are checked against the real prices of the lists already on screen: nothing is fetched in the background.
  const triggered = useMemo(
    () => findTriggered([...search.products, ...home.products], alerts),
    [search.products, home.products, alerts]
  );

  const highlightsStatus: 'loading' | 'ok' | 'unavailable' =
    home.phase === 'ok' ? 'ok' : home.phase === 'error' ? 'unavailable' : 'loading';

  const currentTab: ActiveTabType = view;

  /* ----- pieces of screen ----- */

  const recentSearches =
    recent.length > 0 ? (
      <section className="mb-6" aria-labelledby="recentes-title">
        <div className="flex items-center justify-between mb-2">
          <h2 id="recentes-title" className="text-sm font-bold text-slate-700">
            Buscas recentes
          </h2>
          <button
            type="button"
            onClick={clearRecent}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline underline-offset-2"
          >
            Limpar
          </button>
        </div>
        <ul className="flex flex-wrap gap-2">
          {recent.map((term) => (
            <li key={term}>
              <button type="button" onClick={() => void runSearch(term)} className={chipClass}>
                {term}
              </button>
            </li>
          ))}
        </ul>
      </section>
    ) : null;

  const savedProducts =
    customProducts.length > 0 ? (
      <section className="mb-8" aria-labelledby="salvos-title">
        <h2 id="salvos-title" className="text-lg sm:text-xl font-bold text-slate-900">
          Salvos neste aparelho
        </h2>
        <p className="text-xs text-slate-500 mb-3">Produtos que você adicionou por link. O preço é o que você informou.</p>
        <ul className="flex items-stretch gap-3 overflow-x-auto no-scrollbar snap-x -mx-1 px-1 py-1">
          {customProducts.map((p) => (
            <li key={p.id} className="relative shrink-0 snap-start">
              <ProductCard product={p} onOpen={setDetailProduct} variant="compact" />
              <button
                type="button"
                onClick={() => removeCustomProduct(p.id)}
                aria-label={`Remover ${p.title} dos salvos`}
                className="absolute top-1.5 right-1.5 z-10 p-1.5 rounded-full bg-surface/90 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-surface"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </section>
    ) : null;

  return (
    <div className="min-h-screen flex flex-col pb-20 sm:pb-0">
      <a
        href="#conteudo"
        onClick={(e) => {
          // A real hash change would also fire the back/forward handler, so the focus is moved by hand.
          e.preventDefault();
          mainRef.current?.focus();
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-ink focus:text-on-ink focus:text-sm focus:font-semibold"
      >
        Pular para o conteúdo
      </a>

      <Navbar
        searchQuery={searchInput}
        onSearchChange={setSearchInput}
        onSearchSubmit={handleSearchSubmit}
        onClearSearch={() => {
          setSearchInput('');
          focusSearch();
        }}
        onGoHome={() => openHome()}
        onOpenOptions={() => setShowOptions(true)}
        onOpenCoupons={() => openCoupons()}
        onSelectCategory={(id) => {
          const tile = CATEGORY_TILES.find((t) => t.id === id);
          if (tile) void runSearch(tile.term, { categoryId: tile.id });
        }}
        activeCategoryId={view === 'search' ? activeCategoryId : null}
        couponsActive={view === 'coupons'}
        theme={resolvedTheme}
        onToggleTheme={toggleTheme}
      />

      <main
        id="conteudo"
        ref={mainRef}
        tabIndex={-1}
        className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 outline-none"
      >
        {view === 'home' && (
          <>
            <HeroIntro />
            <AlertsBanner triggered={triggered} onOpen={openTriggered} onDismiss={dismissTriggered} />
            {recentSearches}
            {home.phase === 'ok' && home.checkedAt !== undefined && (
              <FreshnessBar
                isRefreshing={home.refreshing}
                onRefresh={() => void loadHome(true)}
                lastUpdatedTimestamp={home.checkedAt}
                lastUpdatedText={home.updatedText}
                priceDrops={home.drops}
                retryNotice={home.notice || undefined}
                onSelectSearchTemplate={(q) => void runSearch(q)}
              />
            )}
            <HighlightsSection
              products={home.products}
              status={highlightsStatus}
              onOpenProduct={setDetailProduct}
              onRetry={() => void loadHome(false)}
            />
            {savedProducts}
            <ExploreCategories onSearch={searchFromTile} />
            <SpecialCouponsSection coupons={coupons} onViewAll={() => openCoupons()} />
          </>
        )}

        {view === 'search' && (
          <>
            <AlertsBanner triggered={triggered} onOpen={openTriggered} onDismiss={dismissTriggered} />
            {(search.products.length > 0 || search.refreshing) && search.checkedAt !== undefined && (
              <FreshnessBar
                isRefreshing={search.refreshing}
                onRefresh={refreshSearch}
                lastUpdatedTimestamp={search.checkedAt}
                lastUpdatedText={search.updatedText}
                priceDrops={search.drops}
                retryNotice={search.products.length > 0 ? search.notice || undefined : undefined}
              />
            )}
            <SearchResultsView
              items={visibleResults}
              searchQuery={activeCategory ? activeCategory.name : activeTerm}
              filters={filters}
              onFilterChange={handleFilterChange}
              onOpenAdvancedFilters={() => setShowFilters(true)}
              onOpenProductDetails={setDetailProduct}
              onClearSearch={() => openHome()}
              onResetFilters={resetFilters}
              filtersActive={hasActiveFilters(filters)}
              isLoading={search.phase === 'loading'}
              emptyMessage={search.products.length === 0 ? search.notice || undefined : undefined}
              storeCounts={storeCounts}
              foundCount={search.products.length}
              sortNotice={sortNotice}
              onRetrySort={retrySortedList}
            />
          </>
        )}

        {view === 'categories' && (
          <>
            <h1 className="sr-only">Categorias</h1>
            {recentSearches}
            <ExploreCategories grid onSearch={searchFromTile} />
          </>
        )}

        {view === 'coupons' && (
          <>
            <h1 className="sr-only">Cupons de desconto</h1>
            <CouponsSection coupons={coupons} loaded={couponsLoaded} />
          </>
        )}
      </main>

      <AffiliateNotice variant="footer" />

      <BottomNavBar currentTab={currentTab} onSelectTab={handleSelectTab} />

      {/* Dialogs are mounted only while open, so each one starts clean (a saved alert never leaks into the next product). */}
      {detailProduct && (
        <ProductDetailModal
          key={detailProduct.id}
          product={detailProduct}
          onClose={() => setDetailProduct(null)}
          onOpenHistory={setHistoryProduct}
          onOpenAlert={setAlertProduct}
          onOpenShare={setShareProduct}
          onOpenRemessaConforme={openRemessaFromProduct}
        />
      )}
      {historyProduct && (
        <PriceHistoryModal key={historyProduct.id} product={historyProduct} onClose={() => setHistoryProduct(null)} />
      )}
      {alertProduct && (
        <PriceAlertModal
          key={alertProduct.id}
          product={alertProduct}
          onClose={() => setAlertProduct(null)}
          onSaved={() => setAlerts(loadAlerts())}
        />
      )}
      {shareProduct && <ShareModal key={shareProduct.id} product={shareProduct} onClose={() => setShareProduct(null)} />}
      {showFilters && (
        <AdvancedFilters
          filters={filters}
          onFilterChange={handleFilterChange}
          onReset={resetFilters}
          onClose={() => setShowFilters(false)}
        />
      )}
      {showAddProduct && (
        <AddProductModal isOpen onClose={() => setShowAddProduct(false)} onAddProduct={addCustomProduct} />
      )}
      {showRemessa && (
        <RemessaConformeModal
          key={remessaBRL ?? 'livre'}
          isOpen
          onClose={() => setShowRemessa(false)}
          initialBRL={remessaBRL}
        />
      )}
      <OptionsMenuModal
        isOpen={showOptions}
        onClose={() => setShowOptions(false)}
        onOpenRemessaCalculator={openRemessaCalculator}
        onOpenInstallApp={() => void pwa.handleInstallClick()}
        onOpenAdminPanel={() => setShowConfig(true)}
        onOpenAddProduct={() => setShowAddProduct(true)}
        isInstalled={pwa.isInstalled}
        theme={themeChoice}
        onThemeChange={setTheme}
        onDataCleared={() => {
          setAlerts([]);
          setCustomProducts([]);
          setRecent([]);
        }}
      />
      <InstallModal
        isOpen={pwa.showInstallGuide}
        onClose={() => pwa.setShowInstallGuide(false)}
        isIOS={pwa.isIOS}
        hasNativePrompt={pwa.hasNativePrompt}
        onTriggerInstall={() => void pwa.handleInstallClick()}
      />
      {showConfig && <ApiConfigModal onClose={() => setShowConfig(false)} />}
    </div>
  );
};

export default App;
