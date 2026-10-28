import { useCallback, useMemo, useState } from 'react';

export interface Paging<T> {
  /** The items to show now: the first page, plus one more page for every time the visitor asked for more. */
  visible: T[];
  total: number;
  remaining: number;
  hasMore: boolean;
  showMore: () => void;
}

/**
 * Shows a long list a page at a time. The list starts again from its first page whenever it is a different list (another
 * search, order or filter), decided while rendering, so a longer old page is never shown for one frame with new items.
 */
export function usePaging<T>(items: readonly T[], pageSize: number): Paging<T> {
  const [state, setState] = useState<{ list: readonly T[]; count: number }>({ list: items, count: pageSize });
  const count = state.list === items ? state.count : pageSize;

  const showMore = useCallback(() => setState({ list: items, count: count + pageSize }), [items, count, pageSize]);
  const visible = useMemo(() => items.slice(0, count), [items, count]);

  return { visible, total: items.length, remaining: Math.max(0, items.length - count), hasMore: count < items.length, showMore };
}
