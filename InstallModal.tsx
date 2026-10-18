import React from 'react';
import { X, Download, Share, PlusSquare, CheckCircle2, ExternalLink } from 'lucide-react';
import { useDialog } from '../hooks/useDialog';

interface InstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  isIOS: boolean;
  hasNativePrompt: boolean;
  onTriggerInstall: () => void;
}

const BENEFITS = [
  'Abre com um toque, direto da tela inicial',
  'Tela cheia, sem a barra do navegador',
  'Sem loja de aplicativos e sem cadastro'
];

export const InstallModal: React.FC<InstallModalProps> = ({ isOpen, onClose, isIOS, hasNativePrompt, onTriggerInstall }) => {
  const dialogRef = useDialog<HTMLDivElement>(onClose, isOpen);
  if (!isOpen) return null;

  // Browsers do not offer installation from inside an embedded frame: open the site on its own tab first.
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

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
        aria-labelledby="instalar-titulo"
        tabIndex={-1}
        className="w-full max-w-md bg-surface rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto animate-sheet-up"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div className="flex items-center gap-3">
            <span
              className="w-12 h-12 rounded-2xl bg-brand text-white flex items-center justify-center font-display font-extrabold text-lg shrink-0"
              aria-hidden="true"
            >
              R$
            </span>
            <div>
              <h2 id="instalar-titulo" className="text-lg font-bold text-slate-900">
                Instalar o PreçoCerto
              </h2>
              <p className="text-xs text-slate-500">Use como um aplicativo, direto da tela inicial.</p>
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
          <ul className="rounded-2xl bg-slate-50 border border-slate-200 p-3.5 space-y-2 text-sm text-slate-700">
            {BENEFITS.map((text) => (
              <li key={text} className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-brand-fg shrink-0 mt-0.5" aria-hidden="true" />
                {text}
              </li>
            ))}
          </ul>

          {hasNativePrompt && (
            <button
              type="button"
              onClick={() => {
                onTriggerInstall();
                onClose();
              }}
              className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-brand text-white text-sm font-bold hover:bg-brand-dark transition-colors"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              Instalar agora
            </button>
          )}

          {!hasNativePrompt && isInIframe && (
            <div className="space-y-2">
              <p className="text-sm text-slate-600">
                A instalação não funciona dentro de uma página incorporada. Abra o site numa aba própria e instale por lá.
              </p>
              <button
                type="button"
                onClick={() => {
                  window.open(window.location.href, '_blank', 'noopener');
                  onClose();
                }}
                className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-brand text-white text-sm font-bold hover:bg-brand-dark transition-colors"
              >
                <ExternalLink className="w-4 h-4" aria-hidden="true" />
                Abrir em uma aba nova
              </button>
            </div>
          )}

          {!hasNativePrompt && !isInIframe && isIOS && (
            <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-700 space-y-2.5">
              <p className="font-semibold text-slate-900">No iPhone ou iPad (Safari):</p>
              <ol className="list-decimal list-inside space-y-1.5">
                <li>
                  Toque em <strong>Compartilhar</strong> (<Share className="w-3.5 h-3.5 inline text-brand-fg -mt-0.5" aria-hidden="true" />) na barra do Safari.
                </li>
                <li>
                  Role e escolha <strong>Adicionar à Tela de Início</strong> (<PlusSquare className="w-3.5 h-3.5 inline -mt-0.5" aria-hidden="true" />).
                </li>
                <li>
                  Toque em <strong>Adicionar</strong>, no canto superior direito.
                </li>
              </ol>
            </div>
          )}

          {!hasNativePrompt && !isInIframe && !isIOS && (
            <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-700 space-y-2">
              <p className="font-semibold text-slate-900">No Chrome ou no Edge:</p>
              <p>
                Abra o menu do navegador (
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 inline -mt-0.5 fill-current" aria-hidden="true">
                  <circle cx="12" cy="5" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="12" cy="19" r="2" />
                </svg>
                ) e escolha <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong>.
              </p>
              <p className="text-xs text-slate-500">Se a opção não aparecer, este navegador não permite instalar sites.</p>
            </div>
          )}

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
