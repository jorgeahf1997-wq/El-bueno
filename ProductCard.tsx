import React from 'react';
import { ExternalLink, Star } from 'lucide-react';
import { Product } from '../types';
import { formatBRL, STORES_METADATA } from '../utils/affiliate';
import {
  AFFILIATE_REL,
  bestOffer,
  naLoja,
  pricedOffers,
  priceStamp,
  ratingText,
  reportedDiscountPercent,
  resolveOfferUrl,
  savingsVsNext,
  trackOfferClick
} from '../utils/offers';
import { OfferList } from './OfferList';
import { ProductImage } from './ProductImage';
import { StoreMark } from './StoreMark';

interface ProductCardProps {
  product: Product;
  onOpen: (product: Product) => void;
  variant?: 'grid' | 'compact';
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onOpen, variant = 'grid' }) => {
  const best = bestOffer(product);
  if (!best) return null;

  const storeName = STORES_METADATA[best.storeId]?.name || best.storeName;
  const where = naLoja(storeName);
  const discount = reportedDiscountPercent(best);

  if (variant === 'compact') {
    // The whole card is one click target, but the heading stays a real heading: the button lives inside it
    // and its ::after stretches over the card ("stretched link" pattern).
    return (
      <article className="relative w-[156px] sm:w-[176px] shrink-0 snap-start bg-surface rounded-2xl border border-slate-200 p-3 hover:border-slate-300 hover:shadow-sm transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-fg">
        <div className="aspect-square rounded-xl bg-photo flex items-center justify-center overflow-hidden mb-2.5">
          <ProductImage src={product.image} className="w-full h-full object-contain" />
        </div>
        <h3 className="text-[13px] font-semibold text-slate-900 leading-snug min-h-[2.5rem] font-sans tracking-normal">
          <button
            type="button"
            onClick={() => onOpen(product)}
            aria-label={`${product.title}, ${formatBRL(best.price)} ${where}. Ver comparação`}
            className="block w-full text-left line-clamp-2 focus-visible:outline-none after:absolute after:inset-0 after:rounded-2xl"
          >
            {product.title}
          </button>
        </h3>
        <p className="price text-lg font-extrabold text-slate-900 mt-1.5">{formatBRL(best.price)}</p>
        <p className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
          <StoreMark storeId={best.storeId} size="sm" />
          <span className="truncate">{storeName}</span>
        </p>
      </article>
    );
  }

  const href = resolveOfferUrl(best);
  const savings = savingsVsNext(product);
  const rating = ratingText(product.rating, product.reviewsCount);
  const priced = pricedOffers(product);
  const stamp = priceStamp(product);

  return (
    <article className="bg-surface rounded-2xl border border-slate-200 p-3.5 sm:p-4 flex flex-col hover:shadow-md hover:border-slate-300 transition">
      {/* Phone: the photo sits beside the text so one screen shows several results. Wider screens: photo on top. */}
      <div className="flex gap-3.5 sm:block">
        <div className="w-24 h-24 sm:w-full sm:h-auto sm:aspect-[4/3] shrink-0 rounded-xl bg-photo border border-slate-100 flex items-center justify-center overflow-hidden sm:mb-3">
          <ProductImage src={product.image} className="w-full h-full object-contain p-2 sm:p-3" />
        </div>

        <div className="min-w-0 flex-1">
          {product.isHistoricalLow && (
            <span className="inline-block mb-1.5 text-[11px] font-bold bg-save-soft text-save-dark rounded-full px-2.5 py-0.5">
              Menor preço registrado
            </span>
          )}

          <h3 className="text-sm font-semibold text-slate-900 leading-snug font-sans tracking-normal">
            <button type="button" onClick={() => onOpen(product)} className="block text-left line-clamp-2 hover:text-brand-fg">
              {product.title}
            </button>
          </h3>

          {rating && (
            <p className="flex items-center gap-1 text-xs text-slate-500 mt-1">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" aria-hidden="true" />
              <span className="sr-only">Avaliação </span>
              {rating}
            </p>
          )}

          <div className="mt-2 sm:mt-3">
            <div className="flex items-baseline gap-x-2 flex-wrap">
              <span className="price text-2xl font-extrabold text-slate-900">{formatBRL(best.price)}</span>
              {discount > 0 && best.originalPrice ? (
                <>
                  <span className="text-xs text-slate-400 line-through">{formatBRL(best.originalPrice)}</span>
                  <span className="text-xs font-bold text-save-dark bg-save-soft rounded-md px-1.5 py-0.5">-{discount}%</span>
                </>
              ) : null}
            </div>
            <p className="flex items-center gap-1.5 text-xs text-slate-600 mt-1">
              <StoreMark storeId={best.storeId} size="sm" />
              <span>{where}</span>
            </p>
            {savings && (
              <p className="text-xs font-semibold text-save-dark mt-1.5">
                {formatBRL(savings.amount)} mais barato que {naLoja(savings.storeName)}
              </p>
            )}
          </div>
        </div>
      </div>

      {priced.length > 1 && (
        <div className="mt-3 pt-1 border-t border-slate-100">
          <OfferList product={product} limit={3} showLinkOnly={false} />
        </div>
      )}

      <div className="mt-auto pt-3 space-y-2">
        <div className="flex gap-2">
          {href && (
            <a
              href={href}
              target="_blank"
              rel={AFFILIATE_REL}
              onClick={() => trackOfferClick(product, best, href)}
              aria-label={`Ver ${product.title} ${where} (abre em nova aba)`}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-brand text-white text-sm font-bold hover:bg-brand-dark transition-colors"
            >
              Ver {where}
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
          )}
          <button
            type="button"
            onClick={() => onOpen(product)}
            className="px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors"
          >
            Comparar
          </button>
        </div>
        {stamp && <p className="text-[11px] text-slate-400">{stamp}</p>}
      </div>
    </article>
  );
};
