import React from 'react';
import { Search, X, SlidersHorizontal, Sun, Moon, Ticket } from 'lucide-react';
import type { ResolvedTheme } from '../hooks/useTheme';
import { CATEGORY_TILES } from './ExploreCategories';

interface NavbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
  onClearSearch: () => void;
  onGoHome: () => void;
  onOpenOptions: () => void;
  onOpenCoupons: () => void;
  /** Runs the real search that belongs to the category. */
  onSelectCategory: (categoryId: string) => void;
  activeCategoryId: string | null;
  couponsActive: boolean;
  theme: ResolvedTheme;
  onToggleTheme: () => void;
}

const pillClass = (selected: boolean) =>
  `inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-semibold whitespace-nowrap transition-colors ${
    selected
      ? 'bg-ink border-ink text-on-ink'
      : 'bg-surface border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
  }`;

export const Navbar: React.FC<NavbarProps> = ({
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  onClearSearch,
  onGoHome,
  onOpenOptions,
  onOpenCoupons,
  onSelectCategory,
  activeCategoryId,
  couponsActive,
  theme,
  onToggleTheme
}) => {
  return (
    <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 pb-2.5">
        <div className="flex items-center gap-2 sm:gap-3">
          <a
            href="/"
            onClick={(e) => {
              // Plain clicks stay inside the app; ctrl/cmd/middle click still opens a new tab.
              if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
              e.preventDefault();
              onGoHome();
            }}
            aria-label="PreçoCerto Brasil, ir para o início"
            className="flex items-center gap-2 shrink-0 text-slate-900"
          >
            <span
              className="w-9 h-9 rounded-xl bg-brand text-white flex items-center justify-center font-display font-extrabold text-sm"
              aria-hidden="true"
            >
              R$
            </span>
            <span className="hidden sm:inline font-display font-extrabold text-lg tracking-tight">
              Preço<span className="text-brand-fg">Certo</span>
            </span>
          </a>

          <form onSubmit={onSearchSubmit} role="search" className="flex-1 flex items-center gap-2 min-w-0">
            <div className="relative flex-1 min-w-0">
              <label htmlFor="busca" className="sr-only">
                Buscar produto
              </label>
              <Search
                className="hidden sm:block w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="busca"
                type="search"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Buscar produto"
                autoComplete="off"
                enterKeyHint="search"
                maxLength={100}
                className="w-full h-10 pl-3.5 sm:pl-10 pr-9 rounded-xl bg-slate-100 border border-transparent text-sm text-slate-900 placeholder:text-slate-500 focus:bg-surface focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={onClearSearch}
                  aria-label="Limpar busca"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-slate-500 hover:bg-slate-200"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
            <button
              type="submit"
              aria-label="Buscar"
              className="shrink-0 h-10 w-10 sm:w-auto sm:px-4 inline-flex items-center justify-center rounded-xl bg-brand text-white text-sm font-bold hover:bg-brand-dark transition-colors"
            >
              <Search className="w-4 h-4 sm:hidden" aria-hidden="true" />
              <span className="hidden sm:inline">Buscar</span>
            </button>
          </form>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Mudar para o tema claro' : 'Mudar para o tema escuro'}
            className="hidden sm:inline-flex shrink-0 h-10 w-10 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" aria-hidden="true" /> : <Moon className="w-5 h-5" aria-hidden="true" />}
          </button>

          <button
            type="button"
            onClick={onOpenOptions}
            aria-label="Abrir menu e ferramentas"
            className="shrink-0 h-10 w-10 inline-flex items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100"
          >
            <SlidersHorizontal className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <nav aria-label="Categorias" className="mt-2.5">
          <ul className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
            {CATEGORY_TILES.map((tile) => (
              <li key={tile.id} className="shrink-0">
                <button
                  type="button"
                  aria-pressed={activeCategoryId === tile.id}
                  onClick={() => onSelectCategory(tile.id)}
                  className={pillClass(activeCategoryId === tile.id)}
                >
                  {tile.name}
                </button>
              </li>
            ))}
            <li className="shrink-0">
              <button type="button" aria-pressed={couponsActive} onClick={onOpenCoupons} className={pillClass(couponsActive)}>
                <Ticket className="w-3.5 h-3.5" aria-hidden="true" />
                Cupons
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
};
