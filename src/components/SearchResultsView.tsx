import React from 'react';
import { SlidersHorizontal, Truck, Flag, X, ExternalLink } from 'lucide-react';
import { FilterState, Product, SortOption, StoreId } from '../types';
import { usePaging } from '../hooks/usePaging';
import { COMPARED_STORE_IDS } from '../utils/filters';
import type { Listed } from '../utils/filters';
import { STORES_METADATA } from '../utils/affiliate';
import { AFFILIATE_REL, naLoja, storeSearchUrl } from '../utils/offers';
import { AffiliateNotice } from './AffiliateNotice';
import { ProductCard } from './ProductCard';

/** Cards shown at first, and each time "Ver mais ofertas" is pressed. */
export const SEARCH_PAGE = 12;

/** Shown when the order the visitor asked for could not be asked to Google (no credits, Google down). */
export interface SortNotice {
  /** The order, as the visitor reads it ("Menor preço"). */
  label: string;
  /** Why, in the server's words (may be empty). */
  reason: string;
}

interface SearchResultsViewProps {
  /** The products to show, already filtered and sorted, each with the offer that represents it. */
  items: Listed[];
  searchQuery: string;
  filters: FilterState;
  onFilterChange: (updates: Partial<FilterState>) => void;
  onOpenAdvancedFilters: () => void;
  onOpenProductDetails: (product: Product) => void;
  onClearSearch: () => void;
  /** Clears the filters without leaving the search. */
  onResetFilters?: () => void;
  /** true when any filter or sorting differs from the defaults */
  filtersActive?: boolean;
  isLoading?: boolean;
  /** Shown when there are no results (for example "live search unavailable"). */
  emptyMessage?: string;
  /** How many products each store would show (see countByStore). */
  storeCounts?: Partial<Record<StoreId, number>>;
  /** Products found before the filters were applied. */
  foundCount?: number;
  /** Set when the chosen price or discount order covers only what was already found. */
  sortNotice?: SortNotice;
  onRetrySort?: () => void;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'relevance', label: 'Relevância' },
  { value: 'price_asc', label: 'Menor preço' },
  { value: 'price_desc', label: 'Maior preço' },
  { value: 'discount', label: 'Maior desconto informado' },
  { value: 'rating', label: 'Melhor avaliados' },
  { value: 'sales', label: 'Mais avaliações' }
];

export const sortLabel = (sort: SortOption): string => SORT_OPTIONS.find((o) => o.value === sort)?.label || '';

const chipClass = (active: boolean) =>
  `inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-xs font-semibold shrink-0 transition-colors ${
    active
      ? 'bg-ink border-ink text-on-ink'
      : 'bg-surface border-slate-300 text-slate-800 hover:bg-slate-50'
  }`;

const selectClass =
  'px-3 py-2 rounded-full border border-slate-300 bg-surface text-xs font-semibold text-slate-800 focus:outline-none focus:border-brand';

export const SearchResultsView: React.FC<SearchResultsViewProps> = ({
  items,
  searchQuery,
  filters,
  onFilterChange,
  onOpenAdvancedFilters,
  onOpenProductDetails,
  onClearSearch,
  onResetFilters,
  filtersActive = false,
  isLoading,
  emptyMessage,
  storeCounts,
  foundCount,
  sortNotice,
  onRetrySort
}) => {
  const paging = usePaging(items, SEARCH_PAGE);
  const blockedByFilters = filtersActive && Boolean(onResetFilters);
  const storeChosen = filters.store !== 'all';
  const storeMeta = storeChosen ? STORES_METADATA[filters.store as StoreId] : undefined;
  // Only the store filter is in the way: the visitor can look for the product in that store itself.
  const onlyStoreInTheWay =
    storeChosen && !filters.freteGratisOnly && !filters.nationalOnly && !filters.minPrice && !filters.maxPrice;
  const storeHref = storeChosen && searchQuery ? storeSearchUrl(filters.store as StoreId, searchQuery) : '';
  const ownOrder = filters.sortBy === 'rating' || filters.sortBy === 'sales';

  return (
    <div className="w-full pb-8">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 break-words">
            {searchQuery ? (
              <>
                Resultados para <span className="text-brand-fg">“{searchQuery}”</span>
              </>
            ) : (
              'Ofertas'
            )}
          </h1>
          {!isLoading && (
            <p className="text-xs text-slate-500 mt-0.5" aria-live="polite" data-testid="result-count">
              {paging.hasMore
                ? `Mostrando ${paging.visible.length} de ${paging.total} produtos`
                : `${paging.total} ${paging.total === 1 ? 'produto' : 'produtos'}`}
              {filtersActive && typeof foundCount === 'number' && foundCount > paging.total ? ` (de ${foundCount} encontrados)` : ''}
            </p>
          )}
        </div>
        {searchQuery && (
          <button
            type="button"
            onClick={onClearSearch}
            className="hidden sm:inline-flex shrink-0 items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
            Limpar busca
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 py-1 mb-3" role="group" aria-label="Filtros e ordenação">
        <button type="button" onClick={onOpenAdvancedFilters} className={chipClass(false)}>
          <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
          Filtros
        </button>

        <label className="inline-flex items-center gap-1.5 shrink-0 text-xs font-semibold text-slate-700">
          <span className="sr-only">Ordenar por</span>
          <select
            value={filters.sortBy}
            onChange={(e) => onFilterChange({ sortBy: e.target.value as SortOption })}
            className={selectClass}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="inline-flex items-center gap-1.5 shrink-0 text-xs font-semibold text-slate-700">
          <span className="sr-only">Filtrar por loja</span>
          <select
            value={filters.store}
            onChange={(e) => onFilterChange({ store: e.target.value as StoreId | 'all' })}
            className={selectClass}
          >
            <option value="all">Todas as lojas</option>
            {COMPARED_STORE_IDS.map((s) => (
              <option key={s} value={s}>
                {STORES_METADATA[s].name}
                {storeCounts && typeof storeCounts[s] === 'number' ? ` (${storeCounts[s]})` : ''}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          aria-pressed={filters.freteGratisOnly}
          onClick={() => onFilterChange({ freteGratisOnly: !filters.freteGratisOnly })}
          className={chipClass(filters.freteGratisOnly)}
        >
          <Truck className="w-3.5 h-3.5" aria-hidden="true" />
          Frete grátis
        </button>

        <button
          type="button"
          aria-pressed={filters.nationalOnly}
          onClick={() => onFilterChange({ nationalOnly: !filters.nationalOnly })}
          className={chipClass(filters.nationalOnly)}
        >
          <Flag className="w-3.5 h-3.5" aria-hidden="true" />
          Envio nacional
        </button>
      </div>

      {ownOrder && !isLoading && (
        <p className="text-[11px] text-slate-500 mb-3" data-testid="own-order-note">
          “{sortLabel(filters.sortBy)}” ordena os produtos que encontramos nesta busca: o Google não tem uma lista ordenada por avaliações.
        </p>
      )}

      {sortNotice && !isLoading && (
        <div
          role="status"
          data-testid="sort-notice"
          className="mb-3 rounded-xl bg-warn-soft border border-warn-line text-warn-ink px-3.5 py-3 text-xs"
        >
          <p className="font-bold">Ordenação parcial</p>
          <p className="mt-0.5">
            Não conseguimos pedir ao Google a lista completa ordenada por “{sortNotice.label}” agora. Estes produtos estão
            ordenados só entre os que já tínhamos encontrado nesta busca.
            {sortNotice.reason ? ` (${sortNotice.reason})` : ''}
          </p>
          {onRetrySort && (
            <button type="button" onClick={onRetrySort} className="mt-1.5 font-bold underline underline-offset-2">
              Tentar de novo
            </button>
          )}
        </div>
      )}

      <div className="mb-4">
        <AffiliateNotice />
      </div>

      {isLoading && (
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          role="status"
          aria-busy="true"
          aria-label="Buscando preços nas lojas"
        >
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-surface rounded-2xl border border-slate-200 p-4">
              <div className="skeleton aspect-[4/3] mb-3" />
              <div className="skeleton h-4 w-full mb-2" />
              <div className="skeleton h-4 w-3/4 mb-4" />
              <div className="skeleton h-7 w-1/3 mb-4" />
              <div className="skeleton h-10 w-full" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <div className="bg-surface rounded-2xl p-8 text-center border border-slate-200" data-testid="empty-results">
          <h3 className="text-base font-bold text-slate-900 mb-1 font-sans tracking-normal">
            {onlyStoreInTheWay && storeMeta
              ? `Não encontramos esta busca ${naLoja(storeMeta.name)}`
              : blockedByFilters
                ? 'Nenhum produto com esses filtros'
                : 'Nenhum produto encontrado'}
          </h3>
          <p className="text-sm text-slate-600 max-w-sm mx-auto mb-4">
            {emptyMessage ||
              (onlyStoreInTheWay && storeMeta
                ? `Entre os produtos desta busca, nenhum tem preço ${naLoja(storeMeta.name)}. Você pode procurar direto na loja ou ver todas as lojas.`
                : blockedByFilters
                  ? 'Remova algum filtro para ver mais resultados.'
                  : 'Tente um termo mais geral, como “fone”, “air fryer” ou “smartwatch”.')}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {onlyStoreInTheWay && storeMeta && storeHref && (
              <a
                href={storeHref}
                target="_blank"
                rel={AFFILIATE_REL}
                data-testid="store-search-link"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-bold hover:bg-brand-dark"
              >
                Buscar “{searchQuery}” {naLoja(storeMeta.name)}
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              </a>
            )}
            {onlyStoreInTheWay && (
              <button
                type="button"
                onClick={() => onFilterChange({ store: 'all' })}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-800 text-sm font-bold hover:bg-slate-50"
              >
                Ver todas as lojas
              </button>
            )}
            {blockedByFilters && !onlyStoreInTheWay && (
              <button
                type="button"
                onClick={onResetFilters}
                className="px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-bold hover:bg-brand-dark"
              >
                Limpar filtros
              </button>
            )}
            <button
              type="button"
              onClick={onClearSearch}
              className={`px-4 py-2.5 rounded-xl text-sm font-bold ${
                blockedByFilters
                  ? 'border border-slate-300 text-slate-800 hover:bg-slate-50'
                  : 'bg-brand text-white hover:bg-brand-dark'
              }`}
            >
              Voltar ao início
            </button>
          </div>
        </div>
      )}

      {!isLoading && items.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="results-grid">
            {paging.visible.map(({ product, offer }) => (
              <ProductCard key={product.id} product={product} offer={offer} onOpen={onOpenProductDetails} />
            ))}
          </div>
          {paging.hasMore && (
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={paging.showMore}
                data-testid="show-more"
                className="px-6 py-3 rounded-xl border border-slate-300 bg-surface text-sm font-bold text-slate-800 hover:bg-slate-50"
              >
                Ver mais ofertas ({paging.remaining})
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
