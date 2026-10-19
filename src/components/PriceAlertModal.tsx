import React, { useState } from 'react';
import { X, Bell, Check } from 'lucide-react';
import { Product } from '../types';
import { formatBRL } from '../utils/affiliate';
import { bestOffer } from '../utils/offers';
import { saveAlert } from '../utils/alerts';
import { parseDecimal } from '../utils/remessa';
import { useDialog } from '../hooks/useDialog';
import { useSiteConfig } from '../hooks/useSiteConfig';
import { ProductImage } from './ProductImage';

interface PriceAlertModalProps {
  product: Product | null;
  onClose: () => void;
  /** Called after the alert is saved so the app can re-check alerts immediately. */
  onSaved?: () => void;
}

type WhatsappResult = 'none' | 'ok' | 'failed';

export const PriceAlertModal: React.FC<PriceAlertModalProps> = ({ product, onClose, onSaved }) => {
  const dialogRef = useDialog<HTMLDivElement>(onClose, Boolean(product));
  const { whatsappAlerts, contactEmail } = useSiteConfig();
  const [targetPrice, setTargetPrice] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [savedTarget, setSavedTarget] = useState(0);
  const [whatsappResult, setWhatsappResult] = useState<WhatsappResult>('none');
  const [sending, setSending] = useState(false);

  if (!product) return null;

  // WhatsApp is offered only when the server can really send it AND people have a way to ask for deletion.
  const offerWhatsapp = whatsappAlerts && Boolean(contactEmail);

  const best = bestOffer(product);
  const current = best ? best.price : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const target = parseDecimal(targetPrice);
    if (!(target > 0)) {
      setError('Informe o preço que você quer pagar.');
      return;
    }
    if (current > 0 && target >= current) {
      setError(`O alerta só faz sentido abaixo do preço atual (${formatBRL(current)}).`);
      return;
    }
    const digits = whatsapp.replace(/\D/g, '');
    const wantsWhatsapp = offerWhatsapp && digits.length > 0;
    if (wantsWhatsapp && !/^\d{10,11}$/.test(digits)) {
      setError('WhatsApp inválido. Use DDD + número.');
      return;
    }
    if (wantsWhatsapp && !consent) {
      setError('Marque a autorização para receber o aviso por WhatsApp.');
      return;
    }

    saveAlert({
      id: `alert-${Date.now()}`,
      productId: product.id,
      productTitle: product.title,
      productImage: product.image,
      targetPrice: target,
      priceAtCreation: current,
      createdAt: new Date().toISOString()
    });
    setSavedTarget(target);
    onSaved?.();

    if (wantsWhatsapp) {
      setSending(true);
      try {
        const res = await fetch('/api/alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId: product.id,
            productTitle: product.title,
            targetPrice: target,
            currentPrice: current,
            whatsapp: digits,
            consent: true
          })
        });
        setWhatsappResult(res.ok ? 'ok' : 'failed');
      } catch {
        setWhatsappResult('failed');
      } finally {
        setSending(false);
      }
    }
    setSaved(true);
  };

  const suggestions = current > 0 ? [5, 10, 15] : [];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4 bg-black/60 animate-fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="alerta-titulo"
        tabIndex={-1}
        className="w-full max-w-md bg-surface rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto animate-sheet-up"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div>
            <h2 id="alerta-titulo" className="text-lg font-bold text-slate-900">
              Alerta de preço
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Mostramos um aviso quando o preço chegar no valor que você escolher.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-2 -mr-2 -mt-1 rounded-full text-slate-500 hover:bg-slate-100"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {saved ? (
          <div className="px-5 py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-save-soft text-save-dark flex items-center justify-center mx-auto mb-3">
              <Check className="w-6 h-6" aria-hidden="true" />
            </div>
            <h3 className="text-base font-bold text-slate-900 font-sans tracking-normal">Alerta salvo neste aparelho</h3>
            <p className="text-sm text-slate-600 mt-2 max-w-xs mx-auto">
              Quando você abrir o PreçoCerto e este produto aparecer por {formatBRL(savedTarget)} ou menos, mostramos um
              aviso na tela. Não conferimos preços com o app fechado.
            </p>
            {whatsappResult === 'ok' && (
              <p className="text-sm text-save-dark mt-2 font-semibold">Seu WhatsApp também foi registrado para o aviso.</p>
            )}
            {whatsappResult === 'failed' && (
              <p className="text-sm text-warn-ink mt-2">Não foi possível registrar o WhatsApp agora. O alerta na tela continua ativo.</p>
            )}
            <button
              type="button"
              onClick={onClose}
              className="mt-5 px-5 py-2.5 rounded-xl bg-ink text-on-ink text-sm font-bold hover:opacity-90"
            >
              Fechar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4" noValidate>
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 border border-slate-200 p-3">
              <ProductImage src={product.image} className="w-12 h-12 object-contain rounded-lg bg-photo p-1 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-800 line-clamp-2">{product.title}</p>
                {current > 0 && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    Preço atual <span className="font-bold text-slate-900">{formatBRL(current)}</span>
                  </p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="alerta-preco" className="block text-xs font-bold text-slate-700 mb-1">
                Quanto você quer pagar?
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400" aria-hidden="true">
                  R$
                </span>
                <input
                  id="alerta-preco"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder={current > 0 ? (current * 0.9).toFixed(2).replace('.', ',') : '0,00'}
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-surface border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </div>
              {suggestions.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {suggestions.map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setTargetPrice((current * (1 - pct / 100)).toFixed(2).replace('.', ','))}
                      className="text-xs font-semibold text-brand-fg bg-brand-soft hover:opacity-80 px-2.5 py-1.5 rounded-lg"
                    >
                      -{pct}% · {formatBRL(current * (1 - pct / 100))}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {offerWhatsapp && (
              <fieldset className="rounded-xl border border-slate-200 p-3 space-y-2.5">
                <legend className="px-1 text-xs font-bold text-slate-700">Aviso por WhatsApp (opcional)</legend>
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  aria-label="WhatsApp com DDD"
                  placeholder="(11) 98765-4321"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-surface border border-slate-300 rounded-xl text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
                <label className="flex items-start gap-2 text-xs text-slate-600 leading-snug">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded"
                  />
                  <span>
                    Autorizo o PreçoCerto a usar meu número apenas para este aviso de preço (LGPD). Para pedir a exclusão,
                    escreva para {contactEmail}.
                  </span>
                </label>
              </fieldset>
            )}

            {error && (
              <p role="alert" className="text-xs font-semibold text-danger-ink bg-danger-soft border border-danger-line rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={sending}
              className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-brand text-white text-sm font-bold hover:bg-brand-dark disabled:opacity-60"
            >
              <Bell className="w-4 h-4" aria-hidden="true" />
              {sending ? 'Salvando…' : 'Criar alerta'}
            </button>
            <p className="text-[11px] text-slate-500 text-center">
              Sem cadastro. O alerta fica salvo neste aparelho e só confere o preço quando você abre o app.
            </p>
          </form>
        )}
      </div>
    </div>
  );
};
