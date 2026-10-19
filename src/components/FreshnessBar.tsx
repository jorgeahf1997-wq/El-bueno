import React, { useEffect, useState } from 'react';
import { RefreshCw, TrendingDown, X, ExternalLink } from 'lucide-react';
import { PriceDropEvent } from '../types';
import { formatBRL } from '../utils/affiliate';
import { AFFILIATE_REL, formatChecked, naLoja } from '../utils/offers';

interface FreshnessBarProps {
  isRefreshing: boolean;
  onRefresh: () => void;
  lastUpdatedTimestamp: number;
  lastUpdatedText: string;
  priceDrops: PriceDropEvent[];
  onSelectSearchTemplate?: (query: string) => void;
  retryNotice?: string;
}

const POPULAR = [
  { label: 'Tênis de corrida', query: 'tenis corrida' },
  { label: 'Smartwatch', query: 'smartwatch' },
  { label: 'Fone bluetooth', query: 'fone bluetooth' },
  { label: 'Smartphone', query: 'smartphone 5g' },
  { label: 'Air fryer', query: 'air fryer' }
];

/** Honest status: when prices were last checked, plus real price drops we observed. No fake countdowns. */
export const FreshnessBar: React.FC<FreshnessBarProps> = ({
  isRefreshing,
  onRefresh,
  lastUpdatedTimestamp,
  lastUpdatedText,
  priceDrops,
  onSelectSearchTemplate,
  retryNotice
}) => {
  const [, tick] = useState(0);
  const [dismissedDrop, setDismissedDrop] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const checked = formatChecked(lastUpdatedTimestamp);
  const drop = priceDrops && priceDrops.length > 0 ? priceDrops[0] : null;
  const dropKey = drop ? `${drop.productId}-${drop.newPrice}` : '';

  return (
    <div className="space-y-2.5 mb-4">
      <div className="flex items-center justify-between gap-3 text-xs text-slate-600">
        <p role="status" aria-live="polite" className="min-w-0">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-save mr-2 align-middle" aria-hidden="true" />
          {isRefreshing ? 'Atualizando preços…' : `Preços consultados ${checked}`}
          {!isRefreshing && lastUpdatedText ? <span className="hidden sm:inline text-slate-400"> · {lastUpdatedText}</span> : null}
        </p>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-surface text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
          Atualizar
        </button>
      </div>

      {retryNotice && (
        <p role="alert" className="text-xs rounded-lg bg-warn-soft border border-warn-line text-warn-ink px-3 py-2">
          {retryNotice}
        </p>
      )}

      {drop && dismissedDrop !== dropKey && (
        <div className="flex items-start gap-3 rounded-xl bg-save-soft border border-save/20 px-3.5 py-3">
          <TrendingDown className="w-4 h-4 text-save-dark mt-0.5 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold text-slate-900 line-clamp-1">{drop.title}</p>
            <p className="text-xs text-slate-600">
              Caiu de <span className="line-through">{formatBRL(drop.oldPrice)}</span> para{' '}
              <strong className="text-save-dark">{formatBRL(drop.newPrice)}</strong> (-{drop.discountPercent}%) {naLoja(drop.storeName)}, desde a nossa última verificação.
            </p>
          </div>
          {drop.affiliateUrl ? (
            <a
              href={drop.affiliateUrl}
              target="_blank"
              rel={AFFILIATE_REL}
              className="shrink-0 inline-flex items-center gap-1 text-xs font-bold text-save-dark hover:underline"
            >
              Ver <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </a>
          ) : null}
          <button
            type="button"
            aria-label="Fechar aviso de queda de preço"
            onClick={() => setDismissedDrop(dropKey)}
            className="shrink-0 p-1 rounded-md text-slate-500 hover:bg-slate-900/10"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {onSelectSearchTemplate && (
        <div className="flex items-center gap-2 -mx-1 px-1">
          <span id="populares-label" className="text-xs font-semibold text-slate-500 shrink-0">
            Populares
          </span>
          <ul aria-labelledby="populares-label" className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {POPULAR.map((t) => (
              <li key={t.query} className="shrink-0">
                <button
                  type="button"
                  onClick={() => onSelectSearchTemplate(t.query)}
                  className="px-3 py-1.5 rounded-full bg-surface border border-slate-200 text-xs font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                >
                  {t.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
