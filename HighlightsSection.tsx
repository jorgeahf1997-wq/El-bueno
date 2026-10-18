import React from 'react';
import { Product } from '../types';
import { hasPrice } from '../utils/offers';
import { ProductCard } from './ProductCard';

interface HighlightsSectionProps {
  products: Product[];
  status: 'loading' | 'ok' | 'unavailable';
  onOpenProduct: (product: Product) => void;
  onRetry: () => void;
}

/** Home carousel built only from products that have a real price. */
export const HighlightsSection: React.FC<HighlightsSectionProps> = ({ products, status, onOpenProduct, onRetry }) => {
  const items = products.filter((p) => hasPrice(p.lowestOffer) || p.offers.some(hasPrice));

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
        <div className="flex gap-3 overflow-hidden" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="w-[156px] sm:w-[176px] shrink-0 bg-surface rounded-2xl border border-slate-200 p-3">
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
        <div className="flex items-stretch gap-3 overflow-x-auto no-scrollbar snap-x -mx-1 px-1 py-1">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} onOpen={onOpenProduct} variant="compact" />
          ))}
        </div>
      )}
    </section>
  );
};
