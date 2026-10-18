import React, { useEffect, useState } from 'react';
import { X, Copy, Check, ExternalLink, RefreshCw, Trash } from 'lucide-react';
import { StoreId } from '../types';
import { useDialog } from '../hooks/useDialog';
import {
  DEFAULT_AFFILIATE_TAGS,
  STORES_METADATA,
  buildAffiliateUrl,
  getActiveAffiliateTag,
  getAffiliateClicksHistory,
  clearAffiliateClicksHistory,
  AffiliateClickRecord
} from '../utils/affiliate';
import { AFFILIATE_REL } from '../utils/offers';
import { StoreMark } from './StoreMark';

interface ApiConfigModalProps {
  onClose: () => void;
}

interface ServerStatus {
  hasSerpApi: boolean;
  hasSupabase: boolean;
  storageConnected: boolean;
  whatsappAlerts: boolean;
  contactEmail: string;
}

interface ServerTest {
  storeId: string;
  storeName: string;
  verified: boolean;
  paramUsed: string;
  affiliateUrl: string;
}

const SAMPLE_LINKS: { storeId: StoreId; url: string }[] = [
  { storeId: 'amazon', url: 'https://www.amazon.com.br/dp/B09SWW583J' },
  { storeId: 'mercadolivre', url: 'https://www.mercadolivre.com.br/p/MLB12345678' },
  { storeId: 'shopee', url: 'https://shopee.com.br/product/298839210/18399541262' },
  { storeId: 'shein', url: 'https://br.shein.com/goods-p-6310987385.html' },
  { storeId: 'temu', url: 'https://www.temu.com/br/goods-601099.html' },
  { storeId: 'aliexpress', url: 'https://pt.aliexpress.com/item/1005001234567.html' }
];

// Placeholders only: real keys live in the server's .env and are never typed or shown here.
const ENV_TEMPLATE = `# .env (raiz do projeto, só no servidor; nunca suba este arquivo para um repositório público)
SERPAPI_API_KEY=
SERPAPI_DAILY_BUDGET=30
SERPAPI_IMMERSIVE_LOOKUPS=3
LIVE_DEALS_TTL_MINUTES=1440
SEARCH_CACHE_MINUTES=60

# Opcional: histórico guardado e alertas (veja supabase/schema.sql)
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
WHATSAPP_ALERTS_ENABLED=false

# Endereço público do site e contato mostrado no rodapé
PUBLIC_URL=
CONTACT_EMAIL=

# IDs de afiliado (se não definir, valem os do código)
AFFILIATE_AMAZON=
AFFILIATE_MERCADOLIVRE=
AFFILIATE_SHOPEE=
AFFILIATE_SHEIN=
AFFILIATE_TEMU=
AFFILIATE_ALIEXPRESS=`;

const sectionTitle = 'text-sm font-bold text-slate-900 font-sans tracking-normal';
const smallButton =
  'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-surface text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60';

/** Highlights every occurrence of the affiliate ID inside a generated link. */
function Highlighted({ url, tag }: { url: string; tag: string }) {
  if (!tag) return <>{url}</>;
  const parts = url.split(tag);
  return (
    <>
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {part}
          {i < parts.length - 1 && <mark className="bg-save-soft text-save-dark font-bold rounded px-0.5">{tag}</mark>}
        </React.Fragment>
      ))}
    </>
  );
}

function StatusRow({ label, ok, okText, offText }: { label: string; ok: boolean; okText: string; offText: string }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <span className="text-sm text-slate-800">{label}</span>
      <span
        className={`text-xs font-semibold rounded-full px-2.5 py-1 ${
          ok ? 'bg-save-soft text-save-dark' : 'bg-slate-100 text-slate-600'
        }`}
      >
        {ok ? okText : offText}
      </span>
    </li>
  );
}

/**
 * Owner panel (opened with ?admin). It never shows or stores secrets: keys live only in the server's .env.
 * Everything here is either read from the server or measured in this browser.
 */
export const ApiConfigModal: React.FC<ApiConfigModalProps> = ({ onClose }) => {
  const dialogRef = useDialog<HTMLDivElement>(onClose, true);
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [tests, setTests] = useState<ServerTest[] | null>(null);
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [clicks, setClicks] = useState<AffiliateClickRecord[]>([]);
  const [overridden, setOverridden] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/config')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('status'))))
      .then((cfg) => {
        if (!cancelled) setStatus(cfg as ServerStatus);
      })
      .catch(() => {
        if (!cancelled) setStatusError(true);
      });
    setClicks(getAffiliateClicksHistory().slice(0, 30));
    setOverridden(SAMPLE_LINKS.some(({ storeId }) => getActiveAffiliateTag(storeId) !== DEFAULT_AFFILIATE_TAGS[storeId]));
    return () => {
      cancelled = true;
    };
  }, []);

  const copy = (text: string, id: string) => {
    const done = () => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2200);
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, () => {});
  };

  const runServerTest = async () => {
    setTesting(true);
    setTestError(false);
    try {
      const res = await fetch('/api/test-affiliates');
      if (!res.ok) throw new Error('status');
      const data = await res.json();
      setTests(Array.isArray(data.tests) ? data.tests : []);
    } catch {
      setTestError(true);
    } finally {
      setTesting(false);
    }
  };

  const resetLocalTags = () => {
    try {
      SAMPLE_LINKS.forEach(({ storeId }) => localStorage.removeItem(`affiliate_tag_${storeId}`));
    } catch {
      // storage unavailable
    }
    setOverridden(false);
  };

  const clearClicks = () => {
    clearAffiliateClicksHistory();
    setClicks([]);
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
        aria-labelledby="dono-titulo"
        tabIndex={-1}
        className="w-full max-w-2xl bg-surface rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto animate-sheet-up"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 px-5 pt-5 pb-3 bg-surface border-b border-slate-100">
          <div>
            <h2 id="dono-titulo" className="text-lg font-bold text-slate-900">
              Área do dono
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Nada aqui mostra nem guarda senhas ou chaves: elas ficam só no arquivo .env do servidor.
            </p>
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

        <div className="px-5 py-5 space-y-7">
          {/* 1. Server status */}
          <section aria-labelledby="dono-servidor">
            <h3 id="dono-servidor" className={sectionTitle}>
              Servidor
            </h3>
            {statusError && (
              <p role="alert" className="mt-2 text-xs rounded-lg bg-warn-soft border border-warn-line text-warn-ink px-3 py-2">
                Não foi possível ler o estado do servidor.
              </p>
            )}
            {status && (
              <ul className="mt-1 divide-y divide-slate-100">
                <StatusRow label="Busca de preços (SerpApi)" ok={status.hasSerpApi} okText="Configurada" offText="Sem chave: busca desativada" />
                <StatusRow label="Banco de dados (Supabase)" ok={status.storageConnected} okText="Conectado" offText="Não conectado (opcional)" />
                <StatusRow label="Alertas por WhatsApp" ok={status.whatsappAlerts} okText="Ativos" offText="Desativados" />
                <StatusRow label="Contato público no rodapé" ok={Boolean(status.contactEmail)} okText={status.contactEmail || 'Definido'} offText="Defina CONTACT_EMAIL" />
              </ul>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => copy(ENV_TEMPLATE, 'env')} className={smallButton}>
                {copied === 'env' ? <Check className="w-3.5 h-3.5 text-save" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
                {copied === 'env' ? 'Copiado' : 'Copiar modelo do .env'}
              </button>
            </div>
          </section>

          {/* 2. Affiliate links */}
          <section aria-labelledby="dono-afiliados">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 id="dono-afiliados" className={sectionTitle}>
                Links de afiliado
              </h3>
              <button type="button" onClick={runServerTest} disabled={testing} className={smallButton}>
                <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} aria-hidden="true" />
                Verificar no servidor
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Exemplos gerados com os IDs ativos. Abra um para conferir que a loja carrega com o seu código na barra de endereço.
            </p>

            {testError && (
              <p role="alert" className="mt-2 text-xs rounded-lg bg-warn-soft border border-warn-line text-warn-ink px-3 py-2">
                Não foi possível consultar o servidor.
              </p>
            )}
            {tests && (
              <ul className="mt-3 rounded-xl border border-slate-200 divide-y divide-slate-100" aria-label="Resultado da verificação no servidor">
                {tests.map((t) => (
                  <li key={t.storeId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="text-slate-800">
                      {t.storeName} <span className="text-xs text-slate-500">({t.paramUsed})</span>
                    </span>
                    <span
                      className={`text-xs font-semibold rounded-full px-2.5 py-1 ${
                        t.verified ? 'bg-save-soft text-save-dark' : 'bg-danger-soft text-danger-ink'
                      }`}
                    >
                      {t.verified ? 'ID presente no link' : 'ID ausente'}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {overridden && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-warn-soft border border-warn-line px-3 py-2.5 text-xs text-warn-ink">
                <span>Este navegador tem IDs de afiliado diferentes dos padrões (guardados por uma versão antiga do painel).</span>
                <button type="button" onClick={resetLocalTags} className="font-bold underline">
                  Voltar aos IDs padrão
                </button>
              </div>
            )}

            <ul className="mt-3 space-y-3">
              {SAMPLE_LINKS.map(({ storeId, url }) => {
                const tag = getActiveAffiliateTag(storeId);
                const generated = buildAffiliateUrl(storeId, url);
                return (
                  <li key={storeId} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center gap-2">
                      <StoreMark storeId={storeId} size="sm" />
                      <span className="text-sm font-semibold text-slate-900">{STORES_METADATA[storeId].name}</span>
                      <span className="text-xs text-slate-500">ID: {tag}</span>
                    </div>
                    <code className="mt-2 block rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-2 text-[11px] leading-relaxed text-slate-700 break-all select-all">
                      <Highlighted url={generated} tag={tag} />
                    </code>
                    <div className="mt-2 flex gap-2">
                      <a
                        href={generated}
                        target="_blank"
                        rel={AFFILIATE_REL}
                        aria-label={`Abrir o link de teste da ${STORES_METADATA[storeId].name} (abre em nova aba)`}
                        className={smallButton}
                      >
                        <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                        Abrir
                      </a>
                      <button type="button" onClick={() => copy(generated, storeId)} className={smallButton}>
                        {copied === storeId ? <Check className="w-3.5 h-3.5 text-save" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
                        {copied === storeId ? 'Copiado' : 'Copiar'}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-[11px] text-slate-500">
              Para trocar um ID para todos os visitantes, edite a variável AFFILIATE_* no .env (ou o valor padrão em
              src/utils/affiliate.ts) e reinicie o servidor.
            </p>
          </section>

          {/* 3. Local click log */}
          <section aria-labelledby="dono-cliques">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 id="dono-cliques" className={sectionTitle}>
                Cliques neste aparelho ({clicks.length})
              </h3>
              {clicks.length > 0 && (
                <button type="button" onClick={clearClicks} className={smallButton}>
                  <Trash className="w-3.5 h-3.5" aria-hidden="true" />
                  Limpar
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Só conta os cliques feitos neste navegador. Para cliques e comissões reais, use o painel de cada programa de
              afiliados.
            </p>
            {clicks.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-slate-300 px-4 py-5 text-center text-xs text-slate-500">
                Nenhum clique registrado neste aparelho.
              </p>
            ) : (
              <ul className="mt-3 max-h-64 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-200">
                {clicks.map((c) => (
                  <li key={c.id} className="px-3 py-2 text-xs">
                    <p className="font-semibold text-slate-800">
                      {STORES_METADATA[c.storeId]?.name || c.storeId}
                      <span className="font-normal text-slate-500"> · {new Date(c.timestamp).toLocaleString('pt-BR')}</span>
                    </p>
                    <p className="text-slate-600 truncate">{c.productTitle}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
