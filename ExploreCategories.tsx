import React from 'react';
import { Shirt, Footprints, Sparkles, Gamepad2, Watch, Dumbbell, Smartphone, Utensils, Headphones } from 'lucide-react';

export interface CategoryTile {
  id: string;
  name: string;
  /** Real search that the tile runs. */
  term: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const CATEGORY_TILES: CategoryTile[] = [
  { id: 'celulares', name: 'Celulares', term: 'smartphone', icon: Smartphone },
  { id: 'audio', name: 'Áudio e fones', term: 'fone bluetooth', icon: Headphones },
  { id: 'games', name: 'Games', term: 'console videogame', icon: Gamepad2 },
  { id: 'relogios', name: 'Relógios', term: 'smartwatch', icon: Watch },
  { id: 'cozinha', name: 'Casa e cozinha', term: 'air fryer', icon: Utensils },
  { id: 'tenis', name: 'Tênis', term: 'tenis corrida', icon: Footprints },
  { id: 'roupas', name: 'Roupas', term: 'camiseta masculina', icon: Shirt },
  { id: 'beleza', name: 'Beleza', term: 'perfume', icon: Sparkles },
  { id: 'esportes', name: 'Esportes', term: 'halteres', icon: Dumbbell }
];

interface ExploreCategoriesProps {
  onSearch: (term: string) => void;
  /** Larger grid for the dedicated categories screen. */
  grid?: boolean;
}

/** Every tile runs a real search, so what you see always comes from the stores. */
export const ExploreCategories: React.FC<ExploreCategoriesProps> = ({ onSearch, grid = false }) => {
  return (
    <section className="mb-8" aria-labelledby="categorias-title">
      <h2 id="categorias-title" className="text-lg sm:text-xl font-bold text-slate-900 mb-3">
        Explore por categoria
      </h2>
      <ul
        className={
          grid
            ? 'grid grid-cols-3 sm:grid-cols-5 gap-3'
            : 'flex items-stretch gap-3 overflow-x-auto no-scrollbar snap-x -mx-1 px-1 py-1'
        }
      >
        {CATEGORY_TILES.map(({ id, name, term, icon: Icon }) => (
          <li key={id} className={grid ? '' : 'shrink-0 snap-start'}>
            <button
              type="button"
              onClick={() => onSearch(term)}
              aria-label={`Buscar ${name}`}
              className={`${
                grid ? 'w-full' : 'w-[88px]'
              } flex flex-col items-center gap-2 rounded-2xl bg-surface border border-slate-200 px-2 py-3.5 hover:border-slate-300 hover:shadow-sm transition`}
            >
              <span className="w-10 h-10 rounded-xl bg-brand-soft text-brand-fg flex items-center justify-center">
                <Icon className="w-5 h-5" />
              </span>
              <span className="text-xs font-semibold text-slate-800 text-center leading-tight">{name}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
};
