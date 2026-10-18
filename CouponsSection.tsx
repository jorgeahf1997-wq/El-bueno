import React, { useState } from 'react';
import { CouponItem, StoreId } from '../types';
import { STORES_METADATA, buildAffiliateUrl } from '../utils/affiliate';
import { AFFILIATE_REL } from '../utils/offers';
import { AffiliateNotice } from './AffiliateNotice';
import { CouponCard } from './CouponCard';
import { StoreMark } from './StoreMark';

interface CouponsSectionProps {
  coupons: CouponItem[];
  /** false while the first answer is still on its way */
  loaded?: boolean;
}

const TABS: { id: StoreId | 'all'; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'mercadolivre', label: 'Mercado Livre' },
  { id: 'amazon', label: 'Amazon' },
  { id: 'shopee', label: 'Shopee' },
  { id: 'shein', label: 'Shein' },
  { id: 'temu', label: 'Temu' },
  { id: 'aliexpress', label: 'AliExpress' }
];

const STORE_LINKS: StoreId[] = ['mercadolivre', 'amazon', 'shopee', 'shein', 'temu', 'aliexpress'];

export const CouponsSection: React.FC<CouponsSectionProps> = ({ coupons, loaded = true }) => {
  const [store, setStore] = useState<StoreId | 'all'>('all');
  const list = coupons.filter((c) => store === 'all' || c.storeId === store);

  return (
    <section id="cupons-section" aria-labelledby="cupons-title" className="scroll-mt-24">
      <h2 id="cupons-title" className="text-xl font-bold text-slate-900">
        Cupons de desconto
      </h2>
      <p className="text-sm text-slate-600 mt-1 mb-4">
        Só mostramos cupons que testamos e que ainda estão no prazo. Quando não há nenhum, é porque não há.
      </p>

      {coupons.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 py-1 mb-4" role="group" aria-label="Filtrar por loja">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={store === t.id}
              onClick={() => setStore(t.id)}
              className={`shrink-0 px-3.5 py-2 rounded-full border text-xs font-semibold transition-colors ${
                store === t.id
                  ? 'bg-ink border-ink text-on-ink'
                  : 'bg-surface border-slate-300 text-slate-800 hover:bg-slate-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {!loaded && coupons.length === 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-surface rounded-2xl border border-slate-200 p-4">
              <div className="skeleton h-4 w-1/3 mb-3" />
              <div className="skeleton h-6 w-1/2 mb-3" />
              <div className="skeleton h-10 w-full" />
            </div>
          ))}
        </div>
      )}

      {loaded && list.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((c) => (
            <CouponCard key={c.id} coupon={c} />
          ))}
        </div>
      )}

      {loaded && list.length === 0 && (
        <div className="bg-surface rounded-2xl border border-slate-200 p-6">
          <h3 className="text-base font-bold text-slate-900 font-sans tracking-normal">
            {coupons.length > 0 ? 'Nenhum cupom verificado para esta loja' : 'Nenhum cupom verificado no momento'}
          </h3>
          <p className="text-sm text-slate-600 mt-1 mb-4">Veja a página de cupons e as ofertas do dia direto nas lojas:</p>
          <ul className="flex flex-wrap gap-2">
            {STORE_LINKS.map((id) => {
              const meta = STORES_METADATA[id];
              const href = buildAffiliateUrl(id, meta.domainUrl);
              return (
                <li key={id}>
                  <a
                    href={href}
                    target="_blank"
                    rel={AFFILIATE_REL}
                    aria-label={`Abrir a ${meta.name} (abre em nova aba)`}
                    className="inline-flex items-center gap-2 pl-2 pr-3.5 py-2 rounded-full bg-surface border border-slate-300 text-sm font-medium text-slate-800 hover:bg-slate-50"
                  >
                    <StoreMark storeId={id} size="sm" />
                    {meta.name}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="mt-6">
        <AffiliateNotice />
      </div>
    </section>
  );
};
