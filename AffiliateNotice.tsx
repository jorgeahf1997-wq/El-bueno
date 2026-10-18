import React from 'react';
import { useSiteConfig } from '../hooks/useSiteConfig';

interface AffiliateNoticeProps {
  variant?: 'inline' | 'footer';
}

/** Disclosure that the site earns a commission (required for affiliate links in Brazil: CONAR / store programs). */
export const AffiliateNotice: React.FC<AffiliateNoticeProps> = ({ variant = 'inline' }) => {
  const { contactEmail } = useSiteConfig();

  if (variant === 'footer') {
    return (
      <footer className="mt-10 border-t border-slate-200 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-xs leading-relaxed text-slate-500 space-y-2">
          <p>
            <strong className="text-slate-700">Transparência:</strong> o PreçoCerto Brasil participa de programas de
            afiliados (Amazon, Mercado Livre, Shopee, Shein, Temu e AliExpress). Quando você compra por um dos nossos
            links, podemos receber uma comissão, sem nenhum custo extra para você. A comissão não muda os preços
            mostrados nem a ordem de comparação.
          </p>
          {/* Statement required by clause 5 of the Amazon Associates agreement (Brazil): clear and prominent. */}
          <p className="font-medium text-slate-700">
            Como participante do Programa de Associados da Amazon, sou remunerado pelas compras qualificadas efetuadas.
          </p>
          <p>
            Os preços vêm do Google Shopping e das lojas e podem mudar a qualquer momento. Sempre confirme o valor final,
            o frete e o estoque na página da loja antes de comprar. Quando não encontramos o preço de um produto em uma
            loja, mostramos apenas o link de busca, sem inventar valores.
          </p>
          <p>
            Não pedimos conta nem senha. Dados pessoais (como o WhatsApp de um alerta) só são usados com o seu
            consentimento, conforme a LGPD.
            {contactEmail ? (
              <>
                {' '}
                Dúvidas, correções ou pedido de exclusão de dados:{' '}
                <a href={`mailto:${contactEmail}`} className="font-semibold text-brand-fg hover:underline">
                  {contactEmail}
                </a>
                .
              </>
            ) : null}
          </p>
        </div>
      </footer>
    );
  }

  return (
    <p className="text-[11px] leading-snug text-slate-500">
      Podemos receber comissão pelas compras feitas nos links, sem custo extra para você. Preços podem mudar: confirme na
      loja.
    </p>
  );
};
