import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { CouponItem } from '../types';
import { STORES_METADATA, trackAffiliateClick } from '../utils/affiliate';
import { copyText } from '../utils/clipboard';
import { AFFILIATE_REL } from '../utils/offers';
import { StoreMark } from './StoreMark';

interface CouponCardProps {
  coupon: CouponItem;
  compact?: boolean;
}

type CopyState = 'idle' | 'copied' | 'failed';

/** One real coupon. The code is copied on click; the store opens through a normal (sponsored) link. */
export const CouponCard: React.FC<CouponCardProps> = ({ coupon, compact = false }) => {
  const [copy, setCopy] = useState<CopyState>('idle');
  const storeName = STORES_METADATA[coupon.storeId]?.name || coupon.storeName;
  const href = coupon.affiliateUrl && coupon.affiliateUrl !== '#' ? coupon.affiliateUrl : '';

  const handleCopy = async () => {
    const ok = await copyText(coupon.code);
    setCopy(ok ? 'copied' : 'failed');
    setTimeout(() => setCopy('idle'), 2500);
  };

  return (
    <article className="h-full bg-surface rounded-2xl border border-slate-200 p-4 flex flex-col">
      <div className="flex items-center gap-2 mb-2">
        <StoreMark storeId={coupon.storeId} size="sm" />
        <h3 className="text-xs font-semibold text-slate-600 truncate font-sans tracking-normal">{storeName}</h3>
        {coupon.isVerified && (
          <span className="ml-auto text-[10px] font-bold text-save-dark bg-save-soft rounded-full px-2 py-0.5">
            Testado
          </span>
        )}
      </div>

      <p className="price text-xl font-extrabold text-slate-900">{coupon.discountText}</p>
      {coupon.minSpendText && <p className="text-xs text-slate-500 mt-0.5">{coupon.minSpendText}</p>}
      {!compact && coupon.description && (
        <p className="text-xs text-slate-600 mt-2 leading-relaxed">{coupon.description}</p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2">
        <code className="font-mono text-sm font-bold tracking-wider text-slate-900 select-all">{coupon.code}</code>
        {coupon.isExclusiveApp && <span className="text-[10px] font-semibold text-warn-ink">só no app</span>}
      </div>

      <p className="text-[11px] text-slate-500 mt-2">
        {coupon.expirationText}
        {coupon.verifiedAtText ? ` · ${coupon.verifiedAtText}` : ''}
      </p>

      <div className="mt-auto pt-3 flex gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 hover:bg-slate-50"
        >
          {copy === 'copied' ? (
            <Check className="w-4 h-4 text-save" aria-hidden="true" />
          ) : (
            <Copy className="w-4 h-4" aria-hidden="true" />
          )}
          {copy === 'copied' ? 'Copiado' : copy === 'failed' ? 'Copie o código' : 'Copiar'}
        </button>
        {href && (
          <a
            href={href}
            target="_blank"
            rel={AFFILIATE_REL}
            onClick={() => trackAffiliateClick(coupon.storeId, coupon.id, 0, `Cupom ${coupon.code}`, href)}
            aria-label={`Abrir a ${storeName} (abre em nova aba)`}
            className="flex-1 inline-flex items-center justify-center py-2.5 rounded-xl bg-brand text-white text-sm font-bold hover:bg-brand-dark"
          >
            Ir à loja
          </a>
        )}
      </div>
      <span role="status" className="sr-only">
        {copy === 'copied' ? 'Código copiado' : copy === 'failed' ? 'Não foi possível copiar. Selecione o código e copie.' : ''}
      </span>
    </article>
  );
};
