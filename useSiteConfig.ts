import { useEffect, useState } from 'react';

/** What the server tells every visitor about itself. Booleans and a public contact only, never keys. */
export interface SiteConfig {
  /** false until the answer arrives (or when the server cannot be reached) */
  loaded: boolean;
  hasSerpApi: boolean;
  whatsappAlerts: boolean;
  contactEmail: string;
}

const EMPTY: SiteConfig = { loaded: false, hasSerpApi: false, whatsappAlerts: false, contactEmail: '' };

let pending: Promise<SiteConfig> | null = null;

function load(): Promise<SiteConfig> {
  if (!pending) {
    pending = fetch('/api/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg): SiteConfig => {
        if (!cfg || typeof cfg !== 'object') {
          pending = null; // try again the next time something asks
          return EMPTY;
        }
        return {
          loaded: true,
          hasSerpApi: cfg.hasSerpApi === true,
          whatsappAlerts: cfg.whatsappAlerts === true,
          contactEmail: typeof cfg.contactEmail === 'string' ? cfg.contactEmail : ''
        };
      })
      .catch(() => {
        pending = null;
        return EMPTY;
      });
  }
  return pending;
}

/** One request per page load, shared by every component that needs it. */
export function useSiteConfig(): SiteConfig {
  const [config, setConfig] = useState<SiteConfig>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    load().then((value) => {
      if (!cancelled) setConfig(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return config;
}
