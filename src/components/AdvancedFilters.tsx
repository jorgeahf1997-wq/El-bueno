import React, { useState } from 'react';
import { X } from 'lucide-react';
import { FilterState, StoreId, SortOption } from '../types';
import { STORES_METADATA } from '../utils/affiliate';
import { parseDecimal } from '../utils/remessa';
import { useDialog } from '../hooks/useDialog';

interface AdvancedFiltersProps {
  filters: FilterState;
  onFilterChange: (filters: Partial<FilterState>) => void;
  onReset: () => void;
  onClose: () => void;
}

const STORE_IDS: StoreId[] = ['mercadolivre', 'amazon', 'shopee', 'shein', 'temu', 'aliexpress'];

const SORTS: { id: SortOption; label: string }[] = [
  { id: 'relevance', label: 'Relevância' },
  { id: 'price_asc', label: 'Menor preço' },
  { id: 'price_desc', label: 'Maior preço' },
  { id: 'discount', label: 'Maior desconto informado pela loja' },
  { id: 'rating', label: 'Melhor avaliados' },
  { id: 'sales', label: 'Mais avaliações' }
];

const priceToText = (n?: number) => (n ? String(n).replace('.', ',') : '');
const textToPrice = (v: string): number | undefined => {
  const n = parseDecimal(v);
  return n > 0 ? n : undefined;
};

const inputClass =
  'mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-surface text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

const optionRow = 'flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm text-slate-800 hover:bg-slate-50';

export const AdvancedFilters: React.FC<AdvancedFiltersProps> = ({ filters, onFilterChange, onReset, onClose }) => {
  const dialogRef = useDialog<HTMLDivElement>(onClose, true);
  // Typed text is kept as typed ("12," while the person is still typing); the number goes to the filters.
  const [minText, setMinText] = useState(priceToText(filters.minPrice));
  const [maxText, setMaxText] = useState(priceToText(filters.maxPrice));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 animate-fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="filtros-titulo"
        tabIndex={-1}
        className="w-full max-w-md bg-surface rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto animate-sheet-up"
      >
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 id="filtros-titulo" className="text-lg font-bold text-slate-900">
            Filtros
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

        <div className="px-5 py-4 space-y-5">
          <fieldset>
            <legend className="text-xs font-bold text-slate-700 mb-2">Loja</legend>
            <div className="flex flex-wrap gap-2">
              {(['all', ...STORE_IDS] as (StoreId | 'all')[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={filters.store === id}
                  onClick={() => onFilterChange({ store: id })}
                  className={`px-3.5 py-2 rounded-full border text-xs font-semibold transition-colors ${
                    filters.store === id
                      ? 'bg-ink border-ink text-on-ink'
                      : 'bg-surface border-slate-300 text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  {id === 'all' ? 'Todas' : STORES_METADATA[id].name}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-xs font-bold text-slate-700 mb-2">Faixa de preço (R$)</legend>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-slate-600">
                Mínimo
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={minText}
                  onChange={(e) => {
                    setMinText(e.target.value);
                    onFilterChange({ minPrice: textToPrice(e.target.value) });
                  }}
                  placeholder="0"
                  className={inputClass}
                />
              </label>
              <label className="text-xs text-slate-600">
                Máximo
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={maxText}
                  onChange={(e) => {
                    setMaxText(e.target.value);
                    onFilterChange({ maxPrice: textToPrice(e.target.value) });
                  }}
                  placeholder="sem limite"
                  className={inputClass}
                />
              </label>
            </div>
            {filters.store !== 'all' && (
              <p className="mt-1.5 text-[11px] text-slate-500">
                Com uma loja escolhida, a faixa vale para o preço nessa loja.
              </p>
            )}
          </fieldset>

          <fieldset>
            <legend className="text-xs font-bold text-slate-700 mb-2">Ordenar por</legend>
            <div className="space-y-1">
              {SORTS.map((opt) => (
                <label key={opt.id} className={optionRow}>
                  <input
                    type="radio"
                    name="sortBy"
                    checked={filters.sortBy === opt.id}
                    onChange={() => onFilterChange({ sortBy: opt.id })}
                    className="w-4 h-4"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-xs font-bold text-slate-700 mb-2">Envio</legend>
            <div className="space-y-1">
              <label className={optionRow}>
                <input
                  type="checkbox"
                  checked={filters.freteGratisOnly}
                  onChange={(e) => onFilterChange({ freteGratisOnly: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                Só com frete grátis informado
              </label>
              <label className={optionRow}>
                <input
                  type="checkbox"
                  checked={filters.nationalOnly}
                  onChange={(e) => onFilterChange({ nationalOnly: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                Só lojas com envio nacional (Amazon, Mercado Livre, Magalu)
              </label>
            </div>
          </fieldset>
        </div>

        <div className="sticky bottom-0 flex gap-3 px-5 py-3.5 bg-surface border-t border-slate-100">
          <button
            type="button"
            onClick={() => {
              onReset();
              setMinText('');
              setMaxText('');
            }}
            className="px-4 py-3 rounded-xl border border-slate-300 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Limpar
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-brand text-white text-sm font-bold hover:bg-brand-dark"
          >
            Ver resultados
          </button>
        </div>
      </div>
    </div>
  );
};
