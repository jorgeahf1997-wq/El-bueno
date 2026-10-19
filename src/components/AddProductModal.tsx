import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { Product, StoreId, ProductOffer } from '../types';
import { detectStoreFromUrl, STORES_METADATA, buildAffiliateUrl } from '../utils/affiliate';
import { PLACEHOLDER_IMAGE } from '../utils/offers';
import { parseDecimal } from '../utils/remessa';
import { useDialog } from '../hooks/useDialog';

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddProduct: (product: Product) => void;
}

// The app compares only these six stores.
const STORE_CHOICES: StoreId[] = ['mercadolivre', 'amazon', 'shopee', 'shein', 'temu', 'aliexpress'];

const inputClass =
  'w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-surface text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

// "1.299,90" -> 1299.90 ; "89,90" -> 89.9 ; "89.90" -> 89.9
const parsePrice = parseDecimal;

/** Lets the owner add a product with a price THEY typed. Nothing is estimated or filled in for them. */
export const AddProductModal: React.FC<AddProductModalProps> = ({ isOpen, onClose, onAddProduct }) => {
  const dialogRef = useDialog<HTMLDivElement>(onClose, isOpen);
  const [productUrl, setProductUrl] = useState('');
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [image, setImage] = useState('');
  const [storeId, setStoreId] = useState<StoreId>('mercadolivre');
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleUrlChange = (url: string) => {
    setProductUrl(url);
    if (url.trim().startsWith('http')) {
      // Short links (amzn.to, meli.la...) are not recognised: then the store already chosen stays.
      const detected = detectStoreFromUrl(url);
      if (STORE_CHOICES.includes(detected)) setStoreId(detected);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanUrl = productUrl.trim();
    if (!/^https?:\/\//i.test(cleanUrl)) {
      setErrorMsg('Informe o link completo do produto (começando com https://).');
      return;
    }
    const numPrice = parsePrice(price);
    if (!(numPrice > 0)) {
      setErrorMsg('Informe o preço atual do produto, maior que zero.');
      return;
    }
    const numOriginal = originalPrice.trim() ? parsePrice(originalPrice) : 0;

    const storeInfo = STORES_METADATA[storeId];
    const monetizedLink = buildAffiliateUrl(storeId, cleanUrl);

    const offer: ProductOffer = {
      id: `offer-custom-${Date.now()}`,
      storeId,
      storeName: storeInfo?.name || 'Loja',
      price: numPrice,
      priceKnown: true,
      originalPrice: numOriginal > numPrice ? numOriginal : undefined,
      freteGratis: false,
      url: cleanUrl,
      affiliateUrl: monetizedLink,
      inStock: true
    };

    const product: Product = {
      id: `prod-custom-${Date.now()}`,
      title: title.trim() || 'Produto',
      image: image.trim() || PLACEHOLDER_IMAGE,
      rating: 0,
      reviewsCount: 0,
      affiliate_url: monetizedLink,
      affiliateUrl: monetizedLink,
      offers: [offer],
      lowestOffer: offer,
      checkedAt: Date.now(),
      priceHistory: []
    };

    onAddProduct(product);
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      setProductUrl('');
      setTitle('');
      setPrice('');
      setOriginalPrice('');
      setImage('');
      onClose();
    }, 1200);
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
        aria-labelledby="addprod-titulo"
        tabIndex={-1}
        className="w-full max-w-lg bg-surface rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto animate-sheet-up"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div>
            <h2 id="addprod-titulo" className="text-lg font-bold text-slate-900">
              Adicionar produto por link
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Fica salvo só neste aparelho. O preço é o que você digitar.</p>
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

        {isSuccess ? (
          <div className="px-5 py-10 text-center" role="status">
            <div className="w-12 h-12 rounded-full bg-save-soft text-save-dark flex items-center justify-center mx-auto mb-3">
              <Check className="w-6 h-6" aria-hidden="true" />
            </div>
            <p className="text-base font-bold text-slate-900">Produto adicionado</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4" noValidate>
            {errorMsg && (
              <p role="alert" className="text-xs font-semibold text-danger-ink bg-danger-soft border border-danger-line rounded-lg px-3 py-2">
                {errorMsg}
              </p>
            )}

            <div>
              <label htmlFor="ap-url" className="block text-xs font-bold text-slate-700 mb-1">
                Link do produto na loja *
              </label>
              <input
                id="ap-url"
                type="url"
                inputMode="url"
                placeholder="https://www.amazon.com.br/dp/..."
                value={productUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="ap-loja" className="block text-xs font-bold text-slate-700 mb-1">
                Loja
              </label>
              <select id="ap-loja" value={storeId} onChange={(e) => setStoreId(e.target.value as StoreId)} className={inputClass}>
                {STORE_CHOICES.map((id) => (
                  <option key={id} value={id}>
                    {STORES_METADATA[id].name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="ap-titulo" className="block text-xs font-bold text-slate-700 mb-1">
                Nome do produto
              </label>
              <input id="ap-titulo" type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="ap-preco" className="block text-xs font-bold text-slate-700 mb-1">
                  Preço atual (R$) *
                </label>
                <input
                  id="ap-preco"
                  type="text"
                  inputMode="decimal"
                  placeholder="89,90"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="ap-original" className="block text-xs font-bold text-slate-700 mb-1">
                  Preço antes (opcional)
                </label>
                <input
                  id="ap-original"
                  type="text"
                  inputMode="decimal"
                  placeholder="159,90"
                  value={originalPrice}
                  onChange={(e) => setOriginalPrice(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label htmlFor="ap-img" className="block text-xs font-bold text-slate-700 mb-1">
                Link da imagem (opcional)
              </label>
              <input
                id="ap-img"
                type="url"
                inputMode="url"
                placeholder="https://.../foto.jpg"
                value={image}
                onChange={(e) => setImage(e.target.value)}
                className={inputClass}
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-brand text-white text-sm font-bold hover:bg-brand-dark transition-colors"
            >
              Salvar produto
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
