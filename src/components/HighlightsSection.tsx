import React from 'react';
import { Product } from '../types';
import { usePaging } from '../hooks/usePaging';
import { hasPrice } from '../utils/offers';
import { ProductCard } from './ProductCard';

interface HighlightsSectionProps {
  products: Product[];
  status: 'loading' | 'ok' | 'unavailable';
  onOpenProduct: (product: Product) => void;
  onRetry: () => void;
}

/** Offers shown the first time, and each time "Ver mais ofertas" is pressed. */
export const HIGHLIGHTS_PAGE = 10;

const GRID = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3';

/** Home offers: a grid (not a strip to scroll sideways) built only from products that have a real price. */
export const HighlightsSection: React.FC<HighlightsSectionProps> = ({ products, status, onOpenProduct, onRetry }) => {
  const items = React.useMemo(
    () => products.filter((p) => hasPrice(p.lowestOffer) || p.offers.some(hasPrice)),
    [products]
  );
  const paging = usePaging(items, HIGHLIGHTS_PAGE);

  return (
    <section className="mb-8" aria-labelledby="destaques-title">
      <div className="flex items-end justify-between mb-3">
        <div>
          <h2 id="destaques-title" className="text-lg sm:text-xl font-bold text-slate-900">
            Destaques de hoje
          </h2>
          <p className="text-xs text-slate-500">Produtos em alta, com o menor preço que encontramos.</p>
        </div>
      </div>

      {status === 'loading' && items.length === 0 && (
        <div className={GRID} aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-surface rounded-2xl border border-slate-200 p-3">
              <div className="skeleton aspect-square mb-2.5" />
              <div className="skeleton h-3.5 w-full mb-1.5" />
              <div className="skeleton h-3.5 w-2/3 mb-3" />
              <div className="skeleton h-5 w-1/2" />
            </div>
          ))}
        </div>
      )}

      {status === 'unavailable' && items.length === 0 && (
        <div className="rounded-2xl bg-surface border border-slate-200 p-6 text-center">
          <p className="text-sm font-semibold text-slate-900">Os destaques não estão disponíveis agora.</p>
          <p className="text-xs text-slate-500 mt-1 mb-3">Não mostramos preços de exemplo. Tente de novo em alguns minutos.</p>
          <button
            type="button"
            onClick={onRetry}
            className="px-4 py-2 rounded-xl bg-brand text-white text-sm font-bold hover:bg-brand-dark"
          >
            Tentar de novo
          </button>
        </div>
      )}

      {items.length > 0 && (
        <>
          <div className={GRID} data-testid="highlights-grid">
            {paging.visible.map((p) => (
              <ProductCard key={p.id} product={p} onOpen={onOpenProduct} variant="compact" fluid />
            ))}
          </div>
          {paging.hasMore && (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={paging.showMore}
                className="px-5 py-2.5 rounded-xl border border-slate-300 bg-surface text-sm font-bold text-slate-800 hover:bg-slate-50"
              >
                Ver mais ofertas ({paging.remaining})
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
};
