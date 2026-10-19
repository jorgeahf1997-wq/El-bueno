import React, { useState } from 'react';
import { X, Calculator, Download, Trash, Plus, Lock, ChevronRight, Check, Sun, Moon, Monitor } from 'lucide-react';
import { useDialog } from '../hooks/useDialog';
import type { ThemeChoice } from '../hooks/useTheme';
import { isAdminLocation } from '../utils/route';

interface OptionsMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenRemessaCalculator: () => void;
  onOpenInstallApp: () => void;
  onOpenAdminPanel: () => void;
  onOpenAddProduct?: () => void;
  isInstalled: boolean;
  theme: ThemeChoice;
  onThemeChange: (theme: ThemeChoice) => void;
  /** Called after the data saved on this device was erased, so the screen can forget it too. */
  onDataCleared?: () => void;
}

const LOCAL_KEYS = [
  'precocerto_recent_searches',
  'precocerto_custom_products',
  'price_alerts',
  'affiliate_clicks_history'
];

const THEMES: { id: ThemeChoice; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'system', label: 'Automático', Icon: Monitor },
  { id: 'light', label: 'Claro', Icon: Sun },
  { id: 'dark', label: 'Escuro', Icon: Moon }
];

const rowClass =
  'w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border border-slate-200 bg-surface text-left hover:bg-slate-50 transition-colors';

export const OptionsMenuModal: React.FC<OptionsMenuModalProps> = ({
  isOpen,
  onClose,
  onOpenRemessaCalculator,
  onOpenInstallApp,
  onOpenAdminPanel,
  onOpenAddProduct,
  isInstalled,
  theme,
  onThemeChange,
  onDataCleared
}) => {
  const dialogRef = useDialog<HTMLDivElement>(onClose, isOpen);
  const [cleared, setCleared] = useState(false);

  if (!isOpen) return null;

  // The owner panel is only reachable through ?admin, never advertised to visitors.
  const isAdminUrl = isAdminLocation(window.location);

  const handleClear = () => {
    if (!window.confirm('Apagar alertas, buscas e produtos salvos neste aparelho?')) return;
    try {
      LOCAL_KEYS.forEach((k) => localStorage.removeItem(k));
    } catch {
      // storage unavailable
    }
    onDataCleared?.();
    setCleared(true);
    setTimeout(() => setCleared(false), 2500);
  };

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
        aria-labelledby="menu-titulo"
        tabIndex={-1}
        className="w-full max-w-md bg-surface rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto animate-sheet-up"
      >
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 id="menu-titulo" className="text-lg font-bold text-slate-900">
            Menu
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

        <div className="px-5 py-4 space-y-2">
          {cleared && (
            <p role="status" className="flex items-center gap-2 rounded-lg bg-save-soft text-save-dark text-xs font-semibold px-3 py-2">
              <Check className="w-4 h-4" aria-hidden="true" />
              Dados deste aparelho apagados.
            </p>
          )}

          <div className="rounded-xl border border-slate-200 px-3.5 py-3">
            <p id="aparencia-label" className="text-sm font-semibold text-slate-900 mb-2">
              Aparência
            </p>
            <div
              role="group"
              aria-labelledby="aparencia-label"
              className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1"
            >
              {THEMES.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={theme === id}
                  onClick={() => onThemeChange(id)}
                  className={`inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                    theme === id ? 'bg-surface text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenRemessaCalculator();
            }}
            className={rowClass}
          >
            <Calculator className="w-5 h-5 text-brand-fg shrink-0" aria-hidden="true" />
            <span className="flex-1">
              <span className="block text-sm font-semibold text-slate-900">Calculadora de impostos</span>
              <span className="block text-xs text-slate-500">Estimativa para compras internacionais (Remessa Conforme)</span>
            </span>
            <ChevronRight className="w-4 h-4 text-slate-400" aria-hidden="true" />
          </button>

          {!isInstalled && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenInstallApp();
              }}
              className={rowClass}
            >
              <Download className="w-5 h-5 text-brand-fg shrink-0" aria-hidden="true" />
              <span className="flex-1">
                <span className="block text-sm font-semibold text-slate-900">Instalar na tela inicial</span>
                <span className="block text-xs text-slate-500">Abre como um aplicativo, sem baixar da loja</span>
              </span>
              <ChevronRight className="w-4 h-4 text-slate-400" aria-hidden="true" />
            </button>
          )}

          {onOpenAddProduct && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAddProduct();
              }}
              className={rowClass}
            >
              <Plus className="w-5 h-5 text-brand-fg shrink-0" aria-hidden="true" />
              <span className="flex-1">
                <span className="block text-sm font-semibold text-slate-900">Adicionar produto por link</span>
                <span className="block text-xs text-slate-500">Fica salvo só neste aparelho</span>
              </span>
              <ChevronRight className="w-4 h-4 text-slate-400" aria-hidden="true" />
            </button>
          )}

          <button type="button" onClick={handleClear} className={rowClass}>
            <Trash className="w-5 h-5 text-slate-500 shrink-0" aria-hidden="true" />
            <span className="flex-1">
              <span className="block text-sm font-semibold text-slate-900">Apagar dados deste aparelho</span>
              <span className="block text-xs text-slate-500">Alertas de preço, buscas recentes e produtos salvos</span>
            </span>
          </button>

          {isAdminUrl && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAdminPanel();
              }}
              className="w-full mt-2 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              <Lock className="w-3.5 h-3.5" aria-hidden="true" />
              Área do dono
            </button>
          )}

          <p className="pt-3 text-[11px] leading-relaxed text-slate-500">
            O PreçoCerto não pede conta nem senha. Podemos receber comissão pelas compras feitas nos links das lojas, sem
            custo extra para você. Os preços podem mudar: confirme sempre na loja.
          </p>
        </div>
      </div>
    </div>
  );
};
