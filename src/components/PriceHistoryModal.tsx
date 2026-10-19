import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Product, PriceHistoryPoint } from '../types';
import { formatBRL } from '../utils/affiliate';
import { bestOffer } from '../utils/offers';
import { useDialog } from '../hooks/useDialog';

interface PriceHistoryModalProps {
  product: Product | null;
  onClose: () => void;
}

interface HistoryResponse {
  points: PriceHistoryPoint[];
  observedSince: string | null;
}

/** Real history only: prices this server actually observed. Never back-filled or estimated. */
export const PriceHistoryModal: React.FC<PriceHistoryModalProps> = ({ product, onClose }) => {
  const dialogRef = useDialog<HTMLDivElement>(onClose, Boolean(product));
  const [points, setPoints] = useState<PriceHistoryPoint[]>(product?.priceHistory || []);
  const [since, setSince] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!product) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/price-history?id=${encodeURIComponent(product.id)}`)
      .then((r) => (r.ok ? (r.json() as Promise<HistoryResponse>) : null))
      .then((data) => {
        if (cancelled || !data) return;
        if (Array.isArray(data.points) && data.points.length >= (product.priceHistory?.length || 0)) {
          setPoints(data.points);
        }
        setSince(data.observedSince);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [product]);

  if (!product) return null;

  const best = bestOffer(product);
  const current = best ? best.price : points.length ? points[points.length - 1].price : 0;
  const enough = points.length >= 2;

  const prices = points.map((p) => p.price);
  const minPrice = enough ? Math.min(...prices) : 0;
  const maxPrice = enough ? Math.max(...prices) : 0;

  // Chart geometry
  const W = 360;
  const H = 150;
  const padX = 12;
  const padTop = 16;
  const padBottom = 24;
  const range = maxPrice - minPrice || 1;
  const coords = points.map((p, i) => ({
    x: padX + (points.length === 1 ? 0 : (i / (points.length - 1)) * (W - padX * 2)),
    y: padTop + (1 - (p.price - minPrice) / range) * (H - padTop - padBottom),
    ...p
  }));
  const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
  const area = enough
    ? `${line} L ${coords[coords.length - 1].x.toFixed(1)} ${H - padBottom} L ${coords[0].x.toFixed(1)} ${H - padBottom} Z`
    : '';
  const belowMaxPct = enough && maxPrice > current ? Math.round(((maxPrice - current) / maxPrice) * 100) : 0;

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
        aria-labelledby="historico-titulo"
        tabIndex={-1}
        className="w-full max-w-lg bg-surface rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto animate-sheet-up"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div>
            <h2 id="historico-titulo" className="text-lg font-bold text-slate-900">
              Histórico de preços
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{product.title}</p>
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
          <div className="flex items-baseline justify-between rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
            <span className="text-sm text-slate-600">Preço agora</span>
            <span className="price text-xl font-extrabold text-slate-900">{current ? formatBRL(current) : '—'}</span>
          </div>

          {loading && points.length < 2 && <div className="skeleton h-36 w-full" aria-hidden="true" />}

          {!loading && !enough && (
            <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center">
              <p className="text-sm font-semibold text-slate-900">Histórico em construção</p>
              <p className="text-xs text-slate-600 mt-1.5 max-w-xs mx-auto leading-relaxed">
                Guardamos o preço de cada consulta que fazemos. Ainda não há consultas suficientes deste produto para
                desenhar um gráfico. Não inventamos preços do passado.
              </p>
              {points.length === 1 && (
                <p className="text-[11px] text-slate-400 mt-2">Primeiro registro: {points[0].date}</p>
              )}
            </div>
          )}

          {enough && (
            <>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-save-soft px-2 py-2.5">
                  <p className="text-[11px] font-semibold text-save-dark">Menor registrado</p>
                  <p className="price text-sm font-extrabold text-slate-900 mt-0.5">{formatBRL(minPrice)}</p>
                </div>
                <div className="rounded-xl bg-slate-100 px-2 py-2.5">
                  <p className="text-[11px] font-semibold text-slate-600">Maior registrado</p>
                  <p className="price text-sm font-extrabold text-slate-900 mt-0.5">{formatBRL(maxPrice)}</p>
                </div>
                <div className="rounded-xl bg-slate-100 px-2 py-2.5">
                  <p className="text-[11px] font-semibold text-slate-600">Agora vs. maior</p>
                  <p className="price text-sm font-extrabold text-slate-900 mt-0.5">
                    {belowMaxPct > 0 ? `-${belowMaxPct}%` : 'igual'}
                  </p>
                </div>
              </div>

              <figure className="rounded-xl border border-slate-200 p-3">
                <svg
                  viewBox={`0 0 ${W} ${H}`}
                  className="w-full h-40"
                  role="img"
                  aria-label={`Gráfico de preço com ${points.length} registros, de ${formatBRL(minPrice)} a ${formatBRL(maxPrice)}.`}
                >
                  <line x1={padX} y1={H - padBottom} x2={W - padX} y2={H - padBottom} className="stroke-slate-200" />
                  <path d={area} className="fill-brand-fg" opacity="0.1" />
                  <path d={line} fill="none" className="stroke-brand-fg" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                  {points.length <= 24 &&
                    coords.map((c, i) => <circle key={i} cx={c.x} cy={c.y} r="3" className="fill-brand-fg" />)}
                  <text x={padX} y={12} fontSize="10" className="fill-slate-500">
                    {formatBRL(maxPrice)}
                  </text>
                  <text x={padX} y={H - padBottom - 6} fontSize="10" className="fill-slate-500">
                    {formatBRL(minPrice)}
                  </text>
                  <text x={padX} y={H - 6} fontSize="10" className="fill-slate-400">
                    {points[0].date}
                  </text>
                  <text x={W - padX} y={H - 6} fontSize="10" className="fill-slate-400" textAnchor="end">
                    {points[points.length - 1].date}
                  </text>
                </svg>
                <table className="sr-only">
                  <caption>Preços registrados</caption>
                  <tbody>
                    {points.map((p, i) => (
                      <tr key={i}>
                        <td>{p.date}</td>
                        <td>{formatBRL(p.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <figcaption className="text-[11px] text-slate-500 mt-2">
                  {points.length} registros{since ? `, desde ${since}` : ''}. Mostramos só preços que realmente
                  observamos.
                </figcaption>
              </figure>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
