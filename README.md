# Cupons

O app **nunca inventa cupons**. Só mostra os que você coloca aqui (`coupons.json`) ou na tabela `cupons` do Supabase.

Cada cupom precisa de:
- `expiresAt`: depois dessa data ele some sozinho.
- `verifiedAt`: quando você testou o código. O selo "Testado" só aparece se o teste foi nas últimas 48 h.

Copie `coupons.example.json` como modelo. Se `coupons.json` estiver vazio (`[]`), a seção mostra links para as lojas.
