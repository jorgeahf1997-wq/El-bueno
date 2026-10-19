import React from 'react';
import { Bell, X } from 'lucide-react';
import { formatBRL } from '../utils/affiliate';
import { TriggeredAlert } from '../utils/alerts';
import { naLoja } from '../utils/offers';

interface AlertsBannerProps {
  triggered: TriggeredAlert[];
  onOpen: (t: TriggeredAlert) => void;
  onDismiss: (t: TriggeredAlert) => void;
}

/** Shown when a price alert saved on this device is met by a real, current price. */
export const AlertsBanner: React.FC<AlertsBannerProps> = ({ triggered, onOpen, onDismiss }) => {
  if (triggered.length === 0) return null;
  return (
    <div className="space-y-2 mb-4" role="status" aria-live="polite">
      {triggered.map((t) => (
        <div
          key={t.alert.id}
          className="flex items-start gap-3 rounded-xl bg-brand-soft border border-brand/20 px-3.5 py-3"
        >
          <Bell className="w-4 h-4 text-brand-fg mt-0.5 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold text-slate-900 line-clamp-1">{t.alert.productTitle}</p>
            <p className="text-xs text-slate-600">
              Seu alerta de {formatBRL(t.alert.targetPrice)} foi atingido: agora{' '}
              <strong className="text-slate-900">{formatBRL(t.price)}</strong> {naLoja(t.storeName)}.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpen(t)}
            className="shrink-0 text-xs font-bold text-brand-fg hover:underline"
          >
            Ver
          </button>
          <button
            type="button"
            aria-label="Remover alerta"
            onClick={() => onDismiss(t)}
            className="shrink-0 p-1 rounded-md text-slate-500 hover:bg-slate-900/10"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
};
