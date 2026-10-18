import React from 'react';
import { Check } from 'lucide-react';
import { StoreMark } from './StoreMark';

const STORES = [
  ['mercadolivre', 'Mercado Livre'],
  ['amazon', 'Amazon'],
  ['shopee', 'Shopee'],
  ['shein', 'Shein'],
  ['temu', 'Temu'],
  ['aliexpress', 'AliExpress']
] as const;

const POINTS = ['Sem cadastro', 'Você compra direto na loja', 'Cada preço mostra quando foi consultado'];

/** Static, factual intro. No invented discounts and no rotating "sale" banners. */
export const HeroIntro: React.FC = () => {
  return (
    <section className="mb-5 rounded-3xl bg-surface border border-slate-200 px-4 py-5 sm:px-8 sm:py-8">
      <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 leading-tight max-w-2xl">
        Compare preços nas maiores lojas do Brasil
      </h1>
      <p className="mt-2 text-sm sm:text-base text-slate-600 max-w-xl">
        Pesquise um produto, veja onde ele está mais barato e vá direto à loja.
      </p>

      <ul className="mt-3 sm:mt-4 flex flex-wrap gap-x-4 sm:gap-x-5 gap-y-1 text-[13px] sm:text-sm text-slate-700">
        {POINTS.map((text) => (
          <li key={text} className="inline-flex items-center gap-1.5">
            <Check className="w-4 h-4 text-brand-fg shrink-0" aria-hidden="true" />
            {text}
          </li>
        ))}
      </ul>

      <ul className="mt-4 sm:mt-5 flex flex-wrap items-center gap-1.5 sm:gap-2" aria-label="Lojas comparadas">
        {STORES.map(([id, name]) => (
          <li
            key={id}
            className="inline-flex items-center gap-1.5 pl-1.5 pr-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700"
          >
            <StoreMark storeId={id} size="sm" />
            {name}
          </li>
        ))}
      </ul>
    </section>
  );
};
