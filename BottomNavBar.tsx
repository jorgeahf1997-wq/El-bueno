import React from 'react';
import { Home, Grid, Search, Ticket, SlidersHorizontal } from 'lucide-react';

export type ActiveTabType = 'home' | 'categories' | 'search' | 'coupons' | 'profile';

interface BottomNavBarProps {
  currentTab: ActiveTabType;
  onSelectTab: (tab: ActiveTabType) => void;
}

const ITEMS: { id: ActiveTabType; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'home', label: 'Início', Icon: Home },
  { id: 'categories', label: 'Categorias', Icon: Grid },
  { id: 'search', label: 'Busca', Icon: Search },
  { id: 'coupons', label: 'Cupons', Icon: Ticket },
  { id: 'profile', label: 'Menu', Icon: SlidersHorizontal }
];

export const BottomNavBar: React.FC<BottomNavBarProps> = ({ currentTab, onSelectTab }) => {
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur border-t border-slate-200 sm:hidden pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="flex items-stretch justify-around max-w-md mx-auto">
        {ITEMS.map(({ id, label, Icon }) => {
          const active = currentTab === id;
          return (
            <li key={id} className="flex-1">
              <button
                type="button"
                onClick={() => onSelectTab(id)}
                aria-current={active ? 'page' : undefined}
                className={`w-full min-h-[56px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${
                  active ? 'text-brand-fg' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="w-5 h-5" aria-hidden="true" />
                {label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
