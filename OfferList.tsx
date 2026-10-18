import React from 'react';
import { ExternalLink, Truck } from 'lucide-react';
import { Product, ProductOffer } from '../types';
import { formatBRL, STORES_METADATA } from '../utils/affiliate';
import { AFFILIATE_REL, linkOnlyOffers, naLoja, pricedOffers, resolveOfferUrl, trackOfferClick } from '../utils/offers';
import { StoreMark } from './StoreMark';

interface OfferListProps {
  product: Product;
  /** Max rows with a real price (all when omitted). */
  limit?: number;
  /** Show the "stores without a confirmed price" block. */
  showLinkOnly?: boolean;
}

const storeName = (o: ProductOffer) => STORES_METADATA[o.storeId]?.name || o.storeName;

/** Stores ranked by REAL price, then plain links for stores where no price was found. */
export const OfferList: React.FC<OfferListProps> = ({ product, limit, showLinkOnly = true }) => {
  const priced = pricedOffers(product);
  const shown = typeof limit === 'number' ? priced.slice(0, limit) : priced;
  const linkOnly = showLinkOnly ? linkOnlyOffers(product) : [];

  return (
    <div>
      <ul className="divide-y divide-slate-100" aria-label="Preços por loja">
        {shown.map((offer, idx) => {
          const href = resolveOfferUrl(offer);
          const isBest = idx === 0 && priced.length > 1 && offer.isBestPrice;
          const name = storeName(offer);

          // The whole row is the link: a phone has no room for a price AND a text button side by side.
          const content = (
            <>
              <StoreMark storeId={offer.storeId} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-900 leading-tight">{name}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-slate-500">
                  {offer.freteGratis && (
                    <span className="inline-flex items-center gap-1 text-save-dark whitespace-nowrap">
                      <Truck className="w-3 h-3" aria-hidden="true" />
                      Frete grátis
                    </span>
                  )}
                  {offer.rating ? <span className="whitespace-nowrap">Nota {offer.rating.toFixed(1)}</span> : null}
                  {!offer.freteGratis && !offer.rating ? <span>Confirme o frete na loja</span> : null}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className={`price block text-base font-extrabold ${isBest ? 'text-save-dark' : 'text-slate-900'}`}>
                  {formatBRL(offer.price)}
                </span>
                {isBest && <span className="block text-[11px] font-semibold text-save-dark">Menor preço</span>}
              </span>
              {href ? (
                <ExternalLink
                  className="w-4 h-4 shrink-0 text-slate-400 group-hover:text-brand-fg"
                  aria-hidden="true"
                />
              ) : null}
            </>
          );

          return (
            <li key={offer.id}>
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel={AFFILIATE_REL}
                  onClick={() => trackOfferClick(product, offer, href)}
                  aria-label={`${name}, ${formatBRL(offer.price)}${isBest ? ', menor preço' : ''}. Ver ${naLoja(name)} (abre em nova aba)`}
                  className="group flex items-center gap-3 py-3 -mx-2 px-2 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  {content}
                </a>
              ) : (
                <div className="flex items-center gap-3 py-3 -mx-2 px-2">{content}</div>
              )}
            </li>
          );
        })}
      </ul>

      {linkOnly.length > 0 && (
        <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 p-3">
          <p className="text-xs font-semibold text-slate-700">Sem preço confirmado nestas lojas</p>
          <p className="text-[11px] text-slate-500 mb-2">
            Abrimos a página da loja para você ver o valor atual. Nós não estimamos preços.
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {linkOnly.map((offer) => {
              const href = resolveOfferUrl(offer);
              if (!href) return null;
              return (
                <li key={offer.id}>
                  <a
                    href={href}
                    target="_blank"
                    rel={AFFILIATE_REL}
                    onClick={() => trackOfferClick(product, offer, href)}
                    aria-label={`Procurar ${naLoja(storeName(offer))} (abre em nova aba)`}
                    className="inline-flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full bg-surface border border-slate-200 text-xs font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-100"
                  >
                    <StoreMark storeId={offer.storeId} size="sm" />
                    {storeName(offer)}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};
