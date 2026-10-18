-- PreçoCerto Brasil: tablas opcionales de Supabase.
-- Pégalo en Supabase > SQL Editor > Run. Todo es opcional: la app funciona sin base de datos
-- (el historial de precios queda en la memoria del servidor y se pierde al reiniciar).
--
-- SEGURIDAD: solo el SERVIDOR habla con Supabase, usando SUPABASE_SERVICE_KEY (nunca va al navegador).
-- Por eso activamos RLS en todas las tablas SIN políticas: la clave pública (anon) no puede leer ni
-- escribir nada. Si en algún momento añades políticas, no abras alertas_usuario: contiene teléfonos.

-- 1) Historial real de precios (lo escribe el servidor en cada búsqueda con precio real).
create table if not exists public.historico_precios (
  id           bigint generated always as identity primary key,
  product_id   text        not null,
  product_title text,
  store_id     text,
  price        numeric(12,2) not null check (price > 0),
  captured_at  timestamptz not null default now()
);
create index if not exists historico_precios_product_idx
  on public.historico_precios (product_id, captured_at);
alter table public.historico_precios enable row level security;

-- 2) Alertas por WhatsApp (solo se usa si WHATSAPP_ALERTS_ENABLED=true y algo envía los avisos).
--    Guarda el consentimiento (LGPD). Define quién las borra a petición del usuario antes de activarlas.
create table if not exists public.alertas_usuario (
  id            bigint generated always as identity primary key,
  product_id    text          not null,
  product_title text,
  target_price  numeric(12,2) not null check (target_price > 0),
  current_price numeric(12,2),
  whatsapp      text          not null check (whatsapp ~ '^[0-9]{10,11}$'),
  consent_at    timestamptz   not null,
  created_at    timestamptz   not null default now()
);
alter table public.alertas_usuario enable row level security;

-- 3) Cupones reales (alternativa a data/coupons.json). Solo se muestran con vencimiento Y fecha de prueba.
create table if not exists public.cupons (
  id               bigint generated always as identity primary key,
  store_id         text        not null,   -- amazon, mercadolivre, shopee, shein, temu, aliexpress, magalu
  code             text        not null,
  discount_text    text        not null,   -- ej.: 'R$ 10 OFF'
  min_spend_text   text,
  description      text,
  is_exclusive_app boolean     not null default false,
  url              text,
  expires_at       timestamptz not null,
  verified_at      timestamptz not null    -- cuándo probaste el cupón por última vez
);
alter table public.cupons enable row level security;

-- 4) Ofertas propias (opcional): el servidor las usa como complemento si una búsqueda trae pocos resultados.
--    El precio lo escribes TÚ: la app lo muestra con la fecha en que lo guardaste (no como "verificado ahora").
--    url_afiliado se abre tal cual: pon aquí el enlace final, ya con tu ID de afiliado.
create table if not exists public.ofertas_locales (
  id            bigint generated always as identity primary key,
  titulo        text          not null,
  preco         numeric(12,2) not null check (preco > 0),
  loja          text,                 -- 'Amazon', 'Mercado Livre', 'Shopee'...
  url_afiliado  text,
  imagem_url    text,
  created_at    timestamptz   not null default now(),
  updated_at    timestamptz   not null default now()
);
alter table public.ofertas_locales enable row level security;
