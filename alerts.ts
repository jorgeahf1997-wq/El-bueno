import { Product } from '../types';
import { bestOffer } from './offers';

export interface SavedAlert {
  id: string;
  productId: string;
  productTitle: string;
  productImage?: string;
  targetPrice: number;
  priceAtCreation: number;
  createdAt: string;
}

const KEY = 'price_alerts';

export function loadAlerts(): SavedAlert[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((a) => a && a.productId && a.targetPrice > 0) : [];
  } catch {
    return [];
  }
}

/** One alert per product: saving again replaces the previous target. */
export function saveAlert(alert: SavedAlert): void {
  try {
    const rest = loadAlerts().filter((a) => a.productId !== alert.productId);
    localStorage.setItem(KEY, JSON.stringify([alert, ...rest].slice(0, 50)));
  } catch {
    // storage unavailable: the alert simply will not persist
  }
}

export function removeAlert(id: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(loadAlerts().filter((a) => a.id !== id)));
  } catch {
    // ignore
  }
}

export interface TriggeredAlert {
  alert: SavedAlert;
  product: Product;
  price: number;
  storeName: string;
}

/** Alerts whose target is met by a REAL current price in the products we just loaded. */
export function findTriggered(products: Product[], alerts: SavedAlert[]): TriggeredAlert[] {
  const result: TriggeredAlert[] = [];
  for (const alert of alerts) {
    const product = products.find((p) => p.id === alert.productId);
    if (!product) continue;
    const best = bestOffer(product);
    if (best && best.price <= alert.targetPrice) {
      result.push({ alert, product, price: best.price, storeName: best.storeName });
    }
  }
  return result;
}
