import React from 'react';
import { SlidersHorizontal, Truck, Flag, X } from 'lucide-react';
import { Product, FilterState, SortOption, StoreId } from '../types';
import { STORES_METADATA } from '../utils/affiliate';
import { AffiliateNotice } from './AffiliateNotice';
import { ProductCard } from './ProductCard';

interface SearchResultsViewProps {
  products: Product[];
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
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'relevance', label: 'Relevância' },
  { value: 'price_asc', label: 'Menor preço' },
  { value: 'price_desc', label: 'Maior preço' },
  { value: 'discount', label: 'Maior desconto informado' },
  { value: 'rating', label: 'Melhor avaliados' },
  { value: 'sales', label: 'Mais avaliações' }
];

const STORE_OPTIONS: StoreId[] = ['mercadolivre', 'amazon', 'shopee', 'shein', 'temu', 'aliexpress'];

const chipClass = (active: boolean) =>
  `inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-xs font-semibold shrink-0 transition-colors ${
    active
      ? 'bg-ink border-ink text-on-ink'
      : 'bg-surface border-slate-300 text-slate-800 hover:bg-slate-50'
  }`;

const selectClass =
  'px-3 py-2 rounded-full border border-slate-300 bg-surface text-xs font-semibold text-slate-800 focus:outline-none focus:border-brand';

export const SearchResultsView: React.FC<SearchResultsViewProps> = ({
  products,
  searchQuery,
  filters,
  onFilterChange,
  onOpenAdvancedFilters,
  onOpenProductDetails,
  onClearSearch,
  onResetFilters,
  filtersActive = false,
  isLoading,
  emptyMessage
}) => {
  const blockedByFilters = filtersActive && Boolean(onResetFilters);

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
            <p className="text-xs text-slate-500 mt-0.5" aria-live="polite">
              {products.length} {products.length === 1 ? 'produto' : 'produtos'}
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
            {STORE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {STORES_METADATA[s].name}
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

      {!isLoading && products.length === 0 && (
        <div className="bg-surface rounded-2xl p-8 text-center border border-slate-200">
          <h3 className="text-base font-bold text-slate-900 mb-1 font-sans tracking-normal">
            {blockedByFilters ? 'Nenhum produto com esses filtros' : 'Nenhum produto encontrado'}
          </h3>
          <p className="text-sm text-slate-600 max-w-sm mx-auto mb-4">
            {emptyMessage ||
              (blockedByFilters
                ? 'Remova algum filtro para ver mais resultados.'
                : 'Tente um termo mais geral, como “fone”, “air fryer” ou “smartwatch”.')}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {blockedByFilters && (
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

      {!isLoading && products.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} onOpen={onOpenProductDetails} />
          ))}
        </div>
      )}
    </div>
  );
};
