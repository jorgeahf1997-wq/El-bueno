import React from 'react';
import { STORES_METADATA } from '../utils/affiliate';

const SHORT: Record<string, string> = {
  amazon: 'Am',
  mercadolivre: 'ML',
  shopee: 'Sp',
  shein: 'Sh',
  temu: 'Te',
  aliexpress: 'Ali',
  magalu: 'Mg',
  outras: '•'
};

// Brand colours that need dark text to stay readable.
const DARK_TEXT = new Set(['mercadolivre', 'amazon']);

interface StoreMarkProps {
  storeId: string;
  size?: 'sm' | 'md';
  className?: string;
}

/** Small brand-coloured badge used instead of emojis. Decorative: the store name is always written next to it. */
export const StoreMark: React.FC<StoreMarkProps> = ({ storeId, size = 'md', className = '' }) => {
  const meta = (STORES_METADATA as Record<string, { primaryColor: string }>)[storeId];
  const bg = meta?.primaryColor || '#64748B';
  const dim = size === 'sm' ? 'w-5 h-5 text-[9px]' : 'w-7 h-7 text-[10px]';
  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center justify-center rounded-lg font-bold shrink-0 ${dim} ${
        DARK_TEXT.has(storeId) ? 'text-[#111827]' : 'text-white'
      } ${className}`}
      style={{ backgroundColor: bg }}
    >
      {SHORT[storeId] || '•'}
    </span>
  );
};
