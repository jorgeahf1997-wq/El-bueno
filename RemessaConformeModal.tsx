import React, { useState } from 'react';
import { X, Calculator } from 'lucide-react';
import { formatBRL } from '../utils/affiliate';
import { REMESSA, calcRemessa, parseDecimal } from '../utils/remessa';
import { useDialog } from '../hooks/useDialog';

interface RemessaConformeModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Price of the product the visitor was looking at (offered as a one-click value, never filled in silently). */
  initialBRL?: number;
}

const usd = (n: number) => `US$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const inputClass =
  'w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-surface text-sm font-semibold text-slate-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

export const RemessaConformeModal: React.FC<RemessaConformeModalProps> = ({ isOpen, onClose, initialBRL }) => {
  const dialogRef = useDialog<HTMLDivElement>(onClose, isOpen);
  const [mode, setMode] = useState<'usd' | 'brl'>('usd');
  const [valueText, setValueText] = useState('');
  const [shippingText, setShippingText] = useState('');
  const [rateText, setRateText] = useState(String(REMESSA.defaultRate).replace('.', ',') + (Number.isInteger(REMESSA.defaultRate) ? ',00' : ''));
  const [icms, setIcms] = useState<number>(REMESSA.icmsOptions[0]);

  if (!isOpen) return null;

  const typedRate = parseDecimal(rateText);
  const rate = typedRate > 0 ? typedRate : REMESSA.defaultRate;
  const value = parseDecimal(valueText);
  const goodsUSD = mode === 'usd' ? value : value / rate;
  const shippingUSD = parseDecimal(shippingText);

  const result = calcRemessa({ goodsUSD, shippingUSD, icmsPercent: icms });
  const toBRL = (dollars: number) => dollars * rate;
  const hasValue = result.customsUSD > 0;

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
        aria-labelledby="remessa-titulo"
        tabIndex={-1}
        className="w-full max-w-lg bg-surface rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto animate-sheet-up"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-2xl bg-brand-soft text-brand-fg flex items-center justify-center shrink-0">
              <Calculator className="w-5 h-5" aria-hidden="true" />
            </span>
            <div>
              <h2 id="remessa-titulo" className="text-lg font-bold text-slate-900">
                Calculadora de impostos
              </h2>
              <p className="text-xs text-slate-500">Estimativa para compras em lojas internacionais (Remessa Conforme).</p>
            </div>
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

        <div className="px-5 py-4 space-y-4">
          <div className="rounded-xl bg-warn-soft border border-warn-line px-3.5 py-2.5 text-xs leading-relaxed text-warn-ink">
            Use o valor do produto <strong>sem impostos</strong>. Se a loja já mostra o preço com impostos incluídos, o
            total que vale é o do pagamento na loja.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="rc-valor" className="text-xs font-bold text-slate-700">
                  Valor do produto
                </label>
                <div role="group" aria-label="Moeda do valor" className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg text-[11px] font-bold">
                  {(['usd', 'brl'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={mode === m}
                      onClick={() => setMode(m)}
                      className={`px-2 py-0.5 rounded-md transition-colors ${
                        mode === m ? 'bg-surface text-brand-fg shadow-2xs' : 'text-slate-500'
                      }`}
                    >
                      {m === 'usd' ? 'US$' : 'R$'}
                    </button>
                  ))}
                </div>
              </div>
              <input
                id="rc-valor"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder={mode === 'usd' ? 'ex.: 40' : 'ex.: 200'}
                value={valueText}
                onChange={(e) => setValueText(e.target.value)}
                className={inputClass}
              />
              {initialBRL && initialBRL > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setMode('brl');
                    setValueText(initialBRL.toFixed(2).replace('.', ','));
                  }}
                  className="mt-1.5 text-[11px] font-semibold text-brand-fg hover:underline"
                >
                  Usar o preço do produto ({formatBRL(initialBRL)})
                </button>
              ) : null}
            </div>

            <div>
              <label htmlFor="rc-frete" className="block text-xs font-bold text-slate-700 mb-1">
                Frete internacional (US$)
              </label>
              <input
                id="rc-frete"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                value={shippingText}
                onChange={(e) => setShippingText(e.target.value)}
                className={inputClass}
              />
              <p className="mt-1.5 text-[11px] text-slate-500">Deixe vazio se o frete é grátis.</p>
            </div>

            <div>
              <label htmlFor="rc-cotacao" className="block text-xs font-bold text-slate-700 mb-1">
                Cotação do dólar (R$)
              </label>
              <input
                id="rc-cotacao"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={rateText}
                onChange={(e) => setRateText(e.target.value)}
                aria-invalid={typedRate === 0}
                aria-describedby="rc-cotacao-ajuda"
                className={inputClass}
              />
              <p id="rc-cotacao-ajuda" className={`mt-1.5 text-[11px] ${typedRate === 0 ? 'text-danger-ink font-semibold' : 'text-slate-500'}`}>
                {typedRate === 0
                  ? `Informe a cotação. Usando R$ ${REMESSA.defaultRate.toFixed(2).replace('.', ',')} por enquanto.`
                  : 'Valor de referência: ajuste para a cotação de hoje.'}
              </p>
            </div>

            <div>
              <label htmlFor="rc-icms" className="block text-xs font-bold text-slate-700 mb-1">
                ICMS do seu estado
              </label>
              <select id="rc-icms" value={icms} onChange={(e) => setIcms(Number(e.target.value))} className={inputClass}>
                {REMESSA.icmsOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}%
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-[11px] text-slate-500">Varia por estado. Confira a alíquota do seu.</p>
            </div>
          </div>

          {hasValue ? (
            <div aria-live="polite">
              <dl className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-2.5 text-sm">
                <div className="flex justify-between gap-3 text-slate-600">
                  <dt>Produto + frete</dt>
                  <dd className="font-semibold text-slate-900 text-right">
                    {formatBRL(toBRL(result.customsUSD))}
                    <span className="block text-[11px] font-normal text-slate-500">{usd(result.customsUSD)}</span>
                  </dd>
                </div>
                <div className="flex justify-between gap-3 text-slate-600">
                  <dt>
                    Imposto de importação
                    <span className="block text-[11px] text-slate-500">
                      {result.exempt
                        ? `0% (até ${usd(REMESSA.freeUpToUSD).replace(',00', '')})`
                        : `${Math.round(REMESSA.importRate * 100)}% menos ${usd(REMESSA.deductionUSD).replace(',00', '')}`}
                    </span>
                  </dt>
                  <dd className="font-semibold text-danger-ink text-right">+ {formatBRL(toBRL(result.importTaxUSD))}</dd>
                </div>
                <div className="flex justify-between gap-3 text-slate-600">
                  <dt>
                    ICMS
                    <span className="block text-[11px] text-slate-500">{icms}%, calculado por dentro</span>
                  </dt>
                  <dd className="font-semibold text-danger-ink text-right">+ {formatBRL(toBRL(result.icmsUSD))}</dd>
                </div>
                <div className="flex justify-between gap-3 pt-2.5 border-t border-slate-200 font-semibold text-slate-800">
                  <dt>Total de impostos</dt>
                  <dd className="text-danger-ink">{formatBRL(toBRL(result.totalTaxesUSD))}</dd>
                </div>
                <div className="flex justify-between items-baseline gap-3 rounded-xl bg-surface border border-slate-200 px-3.5 py-3">
                  <dt className="font-bold text-slate-900">Total estimado</dt>
                  <dd className="price text-xl font-extrabold text-brand-fg text-right">
                    {formatBRL(toBRL(result.finalUSD))}
                    <span className="block text-[11px] font-normal text-slate-500">{usd(result.finalUSD)}</span>
                  </dd>
                </div>
              </dl>

              {result.overLimit && (
                <p role="alert" className="mt-3 text-xs rounded-lg bg-danger-soft border border-danger-line text-danger-ink px-3 py-2">
                  Acima de {usd(REMESSA.regimeLimitUSD).replace(',00', '')} a compra não entra na remessa simplificada, e
                  esta estimativa não vale.
                </p>
              )}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-center text-sm text-slate-500">
              Digite o valor do produto para ver a estimativa.
            </p>
          )}

          <div className="text-[11px] leading-relaxed text-slate-500 space-y-1">
            <p>
              Regras usadas ({REMESSA.asOf}): até {usd(REMESSA.freeUpToUSD).replace(',00', '')}, imposto de importação de 0%; de
              US$ 50,01 a {usd(REMESSA.regimeLimitUSD).replace(',00', '')}, 60% menos {usd(REMESSA.deductionUSD).replace(',00', '')};
              ICMS estadual por cima.
            </p>
            <p>
              Vale para lojas que participam do Remessa Conforme. Fora do programa, o imposto federal é de 60%, sem
              desconto, mesmo abaixo de US$ 50.
            </p>
            <p>
              É só uma estimativa: a loja calcula o valor final no pagamento e as regras podem mudar (a Lei 15.502/2026
              permite ao Ministério da Fazenda reduzir a alíquota acima de US$ 50). Confirme em gov.br/receitafederal antes
              de comprar.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
