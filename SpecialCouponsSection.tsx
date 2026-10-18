import React from 'react';
import { CouponItem } from '../types';
import { CouponCard } from './CouponCard';

interface SpecialCouponsSectionProps {
  coupons: CouponItem[];
  onViewAll?: () => void;
}

/** Home strip. Rendered only when there are real, non-expired coupons. */
export const SpecialCouponsSection: React.FC<SpecialCouponsSectionProps> = ({ coupons, onViewAll }) => {
  if (coupons.length === 0) return null;
  return (
    <section className="mb-8" aria-labelledby="cupons-home-title">
      <div className="flex items-end justify-between mb-3">
        <div>
          <h2 id="cupons-home-title" className="text-lg sm:text-xl font-bold text-slate-900">
            Cupons com validade
          </h2>
          <p className="text-xs text-slate-500">Cada cupom mostra até quando vale e quando foi testado.</p>
        </div>
        {onViewAll && (
          <button type="button" onClick={onViewAll} className="text-sm font-semibold text-brand-fg hover:underline">
            Ver todos
          </button>
        )}
      </div>
      <div className="flex items-stretch gap-3 overflow-x-auto no-scrollbar snap-x -mx-1 px-1 py-1">
        {coupons.slice(0, 8).map((c) => (
          <div key={c.id} className={`${coupons.length === 1 ? 'w-full sm:w-[260px]' : 'w-[240px]'} shrink-0 snap-start`}>
            <CouponCard coupon={c} compact />
          </div>
        ))}
      </div>
    </section>
  );
};
