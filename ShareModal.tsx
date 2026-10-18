import React, { useState } from 'react';
import { X, Copy, Check, MessageCircle, Send } from 'lucide-react';
import { Product } from '../types';
import { formatBRL, STORES_METADATA } from '../utils/affiliate';
import { naLoja, pricedOffers, resolveOfferUrl } from '../utils/offers';
import { copyText } from '../utils/clipboard';
import { useDialog } from '../hooks/useDialog';

interface ShareModalProps {
  product: Product | null;
  onClose: () => void;
}

/** Plain, factual share message: product, real price, store, link. No invented claims or urgency. */
export const ShareModal: React.FC<ShareModalProps> = ({ product, onClose }) => {
  const dialogRef = useDialog<HTMLDivElement>(onClose, Boolean(product));
  const [copied, setCopied] = useState(false);
  const [index, setIndex] = useState(0);

  if (!product) return null;
  const offers = pricedOffers(product);
  if (offers.length === 0) return null;

  const offer = offers[Math.min(index, offers.length - 1)];
  const storeName = STORES_METADATA[offer.storeId]?.name || offer.storeName;
  const url = resolveOfferUrl(offer);
  const when = product.checkedAt
    ? new Date(product.checkedAt).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo'
      })
    : '';

  const message = [
    `*${product.title}*`,
    `${formatBRL(offer.price)} ${naLoja(storeName)}${when ? ` (preço verificado em ${when}; pode mudar)` : ''}`,
    url,
    '(link de afiliado)'
  ]
    .filter(Boolean)
    .join('\n');

  const handleCopy = async () => {
    const ok = await copyText(message);
    setCopied(ok);
    if (ok) setTimeout(() => setCopied(false), 2500);
  };

  const encoded = encodeURIComponent(message);

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
        aria-labelledby="compartilhar-titulo"
        tabIndex={-1}
        className="w-full max-w-md bg-surface rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto animate-sheet-up"
      >
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 id="compartilhar-titulo" className="text-lg font-bold text-slate-900">
            Compartilhar
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

        <div className="px-5 py-4 space-y-4">
          {offers.length > 1 && (
            <label className="block text-xs font-semibold text-slate-700">
              Loja
              <select
                value={index}
                onChange={(e) => setIndex(Number(e.target.value))}
                className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-surface text-sm text-slate-900"
              >
                {offers.map((o, i) => (
                  <option key={o.id} value={i}>
                    {(STORES_METADATA[o.storeId]?.name || o.storeName) + ' · ' + formatBRL(o.price)}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div>
            <p className="text-xs font-semibold text-slate-700 mb-1">Mensagem</p>
            <pre className="select-all whitespace-pre-wrap break-words rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-800 font-sans max-h-44 overflow-y-auto">
              {message}
            </pre>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <a
              href={`https://api.whatsapp.com/send?text=${encoded}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#25D366] text-white text-sm font-bold hover:brightness-95"
            >
              <MessageCircle className="w-4 h-4" aria-hidden="true" />
              WhatsApp
            </a>
            <a
              href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(
                `${product.title}\n${formatBRL(offer.price)} ${naLoja(storeName)}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#229ED9] text-white text-sm font-bold hover:brightness-95"
            >
              <Send className="w-4 h-4" aria-hidden="true" />
              Telegram
            </a>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm font-bold hover:bg-slate-50"
            >
              {copied ? <Check className="w-4 h-4 text-save" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            O link é de afiliado: o PreçoCerto pode receber uma comissão, sem custo extra para quem compra.
          </p>
        </div>
      </div>
    </div>
  );
};
