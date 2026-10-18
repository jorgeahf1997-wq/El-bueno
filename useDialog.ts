import { useEffect, useRef } from 'react';

/** Dialogs that are open right now, oldest first. Only the last one answers the keyboard. */
const openDialogs: symbol[] = [];
let scrollLocks = 0;
let overflowBeforeLock = '';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessibility for modal dialogs:
 * - Escape closes only the top-most dialog (a detail sheet with a history sheet on top closes one at a time).
 * - Focus moves into the dialog, Tab stays inside it, and focus returns to the opener on close.
 * - The page behind does not scroll while any dialog is open (counted, so closing in any order is safe).
 */
export function useDialog<T extends HTMLElement>(onClose: () => void, active = true) {
  const ref = useRef<T>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    const id = Symbol('dialog');
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    openDialogs.push(id);

    const focusables = () =>
      node ? Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0) : [];

    const first = focusables()[0];
    if (first) first.focus();
    else node?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (openDialogs[openDialogs.length - 1] !== id) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      const current = document.activeElement;
      if (e.shiftKey && (current === firstEl || !node?.contains(current))) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && (current === lastEl || !node?.contains(current))) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    if (scrollLocks === 0) {
      overflowBeforeLock = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    scrollLocks += 1;

    return () => {
      document.removeEventListener('keydown', onKey);
      const at = openDialogs.indexOf(id);
      if (at >= 0) openDialogs.splice(at, 1);
      scrollLocks = Math.max(0, scrollLocks - 1);
      if (scrollLocks === 0) document.body.style.overflow = overflowBeforeLock;
      if (opener && opener.isConnected) opener.focus();
    };
  }, [active]);

  return ref;
}
