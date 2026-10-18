import React from 'react';
import { X, ExternalLink, TrendingDown, Bell, Share2, Calculator, Star } from 'lucide-react';
import { Product } from '../types';
import { formatBRL, STORES_METADATA } from '../utils/affiliate';
import {
  AFFILIATE_REL,
  bestOffer,
  priceStamp,
  ratingText,
  reportedDiscountPercent,
  resolveOfferUrl,
  naLoja,
  paraLoja,
  savingsVsNext,
  trackOfferClick
} from '../utils/offers';
import { useDialog } from '../hooks/useDialog';
import { AffiliateNotice } from './AffiliateNotice';
import { OfferList } from './OfferList';
import { ProductImage } from './ProductImage';
import { StoreMark } from './StoreMark';

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
  onOpenHistory: (product: Product) => void;
  onOpenAlert: (product: Product) => void;
  onOpenShare: (product: Product) => void;
  onOpenRemessaConforme?: () => void;
}

const IMPORT_STORES = new Set(['aliexpress', 'temu', 'shein']);

const actionClass =
  'flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border border-slate-200 bg-surface text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors';

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  onOpenHistory,
  onOpenAlert,
  onOpenShare,
  onOpenRemessaConforme
}) => {
  const dialogRef = useDialog<HTMLDivElement>(onClose, Boolean(product));
  if (!product) return null;

  const best = bestOffer(product);
  const storeName = best ? STORES_METADATA[best.storeId]?.name || best.storeName : '';
  const discount = reportedDiscountPercent(best);
  const savings = savingsVsNext(product);
  const stamp = priceStamp(product);
  const rating = ratingText(product.rating, product.reviewsCount);
  const href = best ? resolveOfferUrl(best) : '';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center sm:p-4 animate-fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="detalhe-titulo"
        tabIndex={-1}
        className="w-full max-w-lg bg-surface rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden animate-sheet-up"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 id="detalhe-titulo" className="text-base font-bold text-slate-900">
            Comparar preços
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-2 -mr-2 rounded-full text-slate-500 hover:bg-slate-100"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-5">
          <div className="flex gap-4">
            <div className="w-24 h-24 shrink-0 rounded-xl border border-slate-100 bg-photo flex items-center justify-center overflow-hidden">
              <ProductImage src={product.image} eager className="w-full h-full object-contain p-2" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-slate-900 leading-snug line-clamp-3 font-sans tracking-normal">
                {product.title}
              </h3>
              {rating && (
                <p className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" aria-hidden="true" />
                  {rating}
                </p>
              )}
              {best && (
                <div className="mt-2">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="price text-2xl font-extrabold text-slate-900">{formatBRL(best.price)}</span>
                    {discount > 0 && best.originalPrice ? (
                      <>
                        <span className="text-xs text-slate-400 line-through">{formatBRL(best.originalPrice)}</span>
                        <span className="text-xs font-bold text-save-dark bg-save-soft rounded-md px-1.5 py-0.5">
                          -{discount}%
                        </span>
                      </>
                    ) : null}
                  </div>
                  <p className="flex items-center gap-1.5 text-xs text-slate-600 mt-1">
                    <StoreMark storeId={best.storeId} size="sm" />
                    Menor preço encontrado: {storeName}
                  </p>
                  {savings && (
                    <p className="text-xs font-semibold text-save-dark mt-1">
                      {formatBRL(savings.amount)} mais barato que {naLoja(savings.storeName)}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className={`grid gap-2 ${best && IMPORT_STORES.has(best.storeId) && onOpenRemessaConforme ? 'grid-cols-4' : 'grid-cols-3'}`}>
            <button type="button" onClick={() => onOpenHistory(product)} className={actionClass}>
              <TrendingDown className="w-4 h-4 text-brand-fg" aria-hidden="true" />
              Histórico
            </button>
            <button type="button" onClick={() => onOpenAlert(product)} className={actionClass}>
              <Bell className="w-4 h-4 text-brand-fg" aria-hidden="true" />
              Alerta
            </button>
            <button type="button" onClick={() => onOpenShare(product)} className={actionClass}>
              <Share2 className="w-4 h-4 text-brand-fg" aria-hidden="true" />
              Compartilhar
            </button>
            {best && IMPORT_STORES.has(best.storeId) && onOpenRemessaConforme && (
              <button type="button" onClick={onOpenRemessaConforme} className={actionClass}>
                <Calculator className="w-4 h-4 text-brand-fg" aria-hidden="true" />
                Impostos
              </button>
            )}
          </div>

          <section aria-labelledby="lojas-titulo">
            <div className="flex items-baseline justify-between mb-1">
              <h3 id="lojas-titulo" className="text-sm font-bold text-slate-900 font-sans tracking-normal">
                Preço por loja
              </h3>
              {stamp && <span className="text-[11px] text-slate-400">{stamp}</span>}
            </div>
            <OfferList product={product} />
          </section>

          <AffiliateNotice />
        </div>

        {best && href && (
          <div className="px-5 py-3.5 border-t border-slate-100 bg-surface flex items-center gap-3">
            <div className="shrink-0">
              <p className="text-[11px] text-slate-500">A partir de</p>
              <p className="price text-lg font-extrabold text-slate-900">{formatBRL(best.price)}</p>
            </div>
            <a
              href={href}
              target="_blank"
              rel={AFFILIATE_REL}
              onClick={() => trackOfferClick(product, best, href)}
              aria-label={`Ir ${paraLoja(storeName)} (abre em nova aba)`}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-3 rounded-xl bg-brand text-white text-sm font-bold hover:bg-brand-dark transition-colors"
            >
              Ir {paraLoja(storeName)}
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
};
