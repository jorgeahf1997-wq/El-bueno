/**
 * Keeps the tab title, the description, the canonical address and the social tags in step with the screen
 * the visitor is on. The server already sends the right tags for the first load (crawlers do not run this
 * code); this covers moving around inside the app.
 *
 * No domain is written here: everything is built from the address the page is running on.
 * The texts match the ones the server writes in server.ts (renderHtmlWithSeo).
 */

export interface PageMeta {
  title?: string;
  description?: string;
}

const STORES = 'Amazon, Mercado Livre, Shopee, Shein, Temu e AliExpress';

export const DEFAULT_TITLE = 'PreçoCerto Brasil - Comparador de preços das maiores lojas';
export const DEFAULT_DESCRIPTION = `Compare preços na ${STORES} e vá direto à loja com o menor preço que encontramos. Sem cadastro.`;
const OG_IMAGE_PATH = '/og-image.png';

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export const searchMeta = (term: string): PageMeta => {
  const label = capitalize(term);
  return {
    title: `${label} - Compare preços nas lojas | PreçoCerto`,
    description: `Compare preços de ${label} na ${STORES} e vá direto à loja.`
  };
};

export const categoryMeta = (name: string): PageMeta => ({
  title: `${name} - Compare preços nas lojas | PreçoCerto`,
  description: `Compare preços de ${name} na ${STORES} e vá direto à loja.`
});

export const categoriesMeta = (): PageMeta => ({
  title: 'Categorias - Compare preços nas lojas | PreçoCerto',
  description: `Escolha uma categoria e compare preços na ${STORES}.`
});

export const couponsMeta = (): PageMeta => ({
  title: 'Cupons de desconto com validade | PreçoCerto',
  description:
    'Cupons para Amazon, Shopee, Mercado Livre, Shein, AliExpress e Temu. Só mostramos os que estão no prazo, com a data de validade e do último teste.'
});

function setMeta(attr: 'name' | 'property', key: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export function updatePageMeta({ title, description }: PageMeta = {}): void {
  if (typeof document === 'undefined') return;

  const fullTitle = title || DEFAULT_TITLE;
  const fullDescription = description || DEFAULT_DESCRIPTION;
  const origin = window.location.origin;
  const path = window.location.pathname.replace(/\/+$/, '');
  const canonicalUrl = `${origin}${path}`;
  const imageUrl = `${origin}${OG_IMAGE_PATH}`;

  document.title = fullTitle;
  setMeta('name', 'description', fullDescription);

  setMeta('property', 'og:title', fullTitle);
  setMeta('property', 'og:description', fullDescription);
  setMeta('property', 'og:url', canonicalUrl);
  setMeta('property', 'og:image', imageUrl);
  setMeta('property', 'og:image:secure_url', imageUrl);

  setMeta('name', 'twitter:title', fullTitle);
  setMeta('name', 'twitter:description', fullDescription);
  setMeta('name', 'twitter:url', canonicalUrl);
  setMeta('name', 'twitter:image', imageUrl);

  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  canonical.setAttribute('href', canonicalUrl);

  // Search pages (/busca/...) stay out of Google's index: there is an endless number of them, they are thin and
  // each one costs a SerpApi credit. The server sends the same tag on the first load.
  if (/^\/busca\//i.test(window.location.pathname)) {
    setMeta('name', 'robots', 'noindex, follow');
  } else {
    document.head.querySelector('meta[name="robots"]')?.remove();
  }
}
