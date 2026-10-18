# PreçoCerto Brasil

Comparador de precios para el público de Brasil (interfaz en portugués). Busca un producto en Google Shopping (vía SerpApi), muestra el precio más bajo que encontró entre Amazon, Mercado Livre, Shopee, Shein, Temu y AliExpress, y lleva al visitante a la tienda con tu enlace de afiliado.

**Regla de oro del proyecto: la app nunca muestra un dato que no sea real.** No hay precios, reseñas, ventas, cupones ni "tiempo real" inventados. Si no hay un precio real de una tienda, solo se muestra el enlace de búsqueda a esa tienda, sin precio.

---

## Arrancar

Requisitos: Node.js 20 o superior.

```bash
npm install
# Este zip ya trae tu .env. Solo en un clon nuevo (sin .env): cp .env.example .env y rellena SERPAPI_API_KEY
npm run dev               # http://localhost:3000  (servidor Express + Vite)
```

Producción:

```bash
npm run build                          # genera dist/
NODE_ENV=production npm start          # sirve dist/ con las etiquetas SEO de cada página
```

En Windows (PowerShell): `$env:NODE_ENV='production'; npm start`.

`npm run lint` comprueba los tipos de TypeScript. No hace falta para publicar: `npm run build` no lo ejecuta, así un detalle de tipos nunca bloquea un despliegue.

---

## Variables (`.env`)

El archivo `.env` es **solo del servidor** y ya está en `.gitignore`. No lo subas a un repositorio público. Ninguna clave llega al navegador.

| Variable | Para qué sirve | Por defecto |
|---|---|---|
| `SERPAPI_API_KEY` | Búsqueda en vivo. Sin ella la app arranca, pero avisa que la búsqueda no está disponible. | vacío |
| `SERPAPI_API_KEY_2` | Segunda clave de SerpApi, opcional y de reserva (ver "Dos claves de SerpApi"). | vacío |
| `SERPAPI_DAILY_BUDGET` | Créditos de SerpApi que el servidor puede gastar por día, sumando todas las claves. Regla: créditos del mes ÷ 30. | `30` |
| `SERPAPI_IMMERSIVE_LOOKUPS` | Consultas extra por búsqueda para traer más tiendas de un producto (1 crédito cada una, máx. 8). `0` las desactiva. | `3` |
| `SEARCH_CACHE_MINUTES` | Minutos que se guarda cada búsqueda. | `60` |
| `LIVE_DEALS_TTL_MINUTES` | Minutos que se guardan los destacados de la portada (cada actualización gasta 4 créditos). | `1440` |
| `PUBLIC_URL` | Dirección pública del sitio, sin barra final (canonical, sitemap, robots). | la del visitante |
| `CONTACT_EMAIL` | Correo del pie para correcciones y borrado de datos (LGPD). Vacío = no se muestra. | vacío |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | Base de datos opcional (ver "Supabase"). `SUPABASE_ANON_KEY` solo como alternativa. | vacío |
| `WHATSAPP_ALERTS_ENABLED` | Pon `true` solo si algo envía de verdad los avisos. Con `false` la app no pide el WhatsApp. | `false` |
| `NODE_ENV` | `production` en el servidor público (sirve `dist/`). Sin él arranca en modo desarrollo, que necesita Vite. | vacío |
| `PORT` | Puerto del servidor. Los hosting lo fijan solos. | `3000` |
| `TRUST_PROXY_HOPS` | Cuántos proxies hay entre el visitante y el servidor (ver "Publicar en Internet"). | `1` |
| `AFFILIATE_*` | IDs de afiliado (ver "Afiliados"). | tus IDs |
| `AMAZON_SHOW_PRICES` | Por defecto se muestran los precios de Amazon que vienen de Google Shopping. Con `false` Amazon sale como tienda, con tu enlace de afiliado y sin precio (ver "Amazon: precios visibles y riesgo"). | visibles |

### Cuota de SerpApi

Cada búsqueda nueva cuesta 1 crédito más hasta `SERPAPI_IMMERSIVE_LOOKUPS`. Para cuidar el plan:

- El servidor guarda cada búsqueda 60 minutos, no deja forzar una actualización antes de 10 minutos y, cuando se agota `SERPAPI_DAILY_BUDGET`, deja de llamar a SerpApi y lo dice con claridad.
- La portada se actualiza una vez al día y solo cuando alguien la abre. Quien entra directo a `/busca/...` o `/categoria/...` no gasta créditos de la portada.
- Si SerpApi responde que el plan se agotó (429 "run out of searches"), no se reintenta. Otros 429 (límite por hora) se reintentan una vez tras 5 segundos.
- Si usas un plan de 1.000 búsquedas al mes, `SERPAPI_DAILY_BUDGET=30` es un buen punto de partida.
- **Plan gratis de SerpApi (250 búsquedas al mes)**: `SERPAPI_DAILY_BUDGET=8`, `SERPAPI_IMMERSIVE_LOOKUPS=0`, `SEARCH_CACHE_MINUTES=1440` y `LIVE_DEALS_TTL_MINUTES=4320`. Así gastas como máximo unas 240 al mes: una búsqueda nueva cuesta 1 crédito y las repetidas salen de la caché. Comprueba tu plan en el panel de SerpApi (el cupo del plan gratis puede cambiar).
- El contador diario vive en la memoria del servidor: si el hosting apaga y reinicia el servidor, se pone a cero (ver "Publicar en Internet").

### Dos claves de SerpApi

Pon la segunda en `SERPAPI_API_KEY_2` (en `.env` o en los Secrets del hosting; nunca en el código ni en el chat).

- La app usa siempre la primera. Pasa a la segunda solo cuando SerpApi dice que la primera no puede: **sin búsquedas** (429 "run out of searches"), **límite por hora** (429) o **clave rechazada** (401/403). Los errores de SerpApi (500, 503) y los cortes de red no cambian de clave.
- Una clave que falla se aparta un tiempo (sin búsquedas: 1 hora; límite por hora: 10 minutos; rechazada: 24 horas) y luego se prueba otra vez. **Solo se aparta si la otra puede sustituirla**: la última clave que queda se intenta siempre en la petición siguiente, así que nunca hay un callejón sin salida.
- `SERPAPI_DAILY_BUDGET` es el total de las dos claves juntas y cuenta cada búsqueda que la app intenta; pasar a la segunda clave no cuenta doble. Si tienes dos planes de 250 búsquedas al mes, usa `SERPAPI_DAILY_BUDGET=16` (500 ÷ 30).
- Si las dos claves son de la misma cuenta, comparten el cupo: la segunda sirve de recambio al rotar la clave, no da búsquedas extra.
- La misma clave escrita dos veces cuenta como una. Los registros del servidor solo dicen "clave 1" o "clave 2", nunca el valor.
- Las condiciones de SerpApi no hablan de forma expresa de usar varias cuentas, pero se reservan el derecho de cerrar cuentas. Si las dos claves son de cuentas gratuitas distintas, revisa las condiciones antes de depender de ello.

---

## Afiliados

Los enlaces se arman en `server.ts` (productos de la búsqueda) y en `src/utils/affiliate.ts` (productos que el visitante agrega por link). Los IDs actuales:

| Tienda | Parámetro | ID |
|---|---|---|
| Amazon | `tag` | `jorgeahf-20` |
| Mercado Livre | `matt_word` (+ `matt_tool=37172851`) | `jh20260503160333` |
| Shopee | `mmp_pid` | `an_18399541262` |
| Shein | `koc_id` | `6310987385` |
| Temu | `_x_cid` (+ parámetros de campaña) | `2127307378kol_affiliate` |
| AliExpress | Tracking ID | `JorgeAHF` |

Para cambiarlos en el servidor, usa las variables `AFFILIATE_*` del `.env`. Cada tienda abre en una pestaña nueva con `rel="sponsored noopener noreferrer"`, y el pie de página y las pantallas de resultados avisan que puedes recibir comisión (exigencia de las tiendas y del CONAR).

**Cada botón de tienda abre una página de esa tienda con tu ID**, porque solo así cuenta la comisión. Cuando Google solo da su propia ficha del producto (que no paga nada), la oferta usa el enlace directo de la tienda que Google también haya listado para ese producto o, si no hay, la búsqueda de esa tienda con el nombre del producto. El precio mostrado no cambia. Las ofertas de tiendas sin programa de afiliados (por ejemplo una tienda pequeña) se dejan como las dio Google. La función está en `server.ts` (`landOffersOnTheirStore`) y las direcciones que se aceptan como "de la tienda" están en `STORE_HOSTS`.

### Amazon: precios visibles y riesgo

**Decisión del dueño (17/10/2026): los precios de Amazon se muestran**, igual que los de las demás tiendas y con su fecha de consulta. El botón de Amazon siempre abre una página de Amazon con tu `tag`: si Google solo da su propia ficha del producto (que no paga comisión), se usa el enlace directo de Amazon que Google también haya listado o, si no hay, la búsqueda de Amazon de ese producto.

**El riesgo, para tenerlo presente:** las Políticas del Programa de Asociados de Amazon Brasil (Requisitos de participación, cláusula 2(b)) dicen que tu sitio solo puede divulgar precios y disponibilidad si (a) Amazon sirve el enlace donde se muestran, o (b) obtuviste esos datos de su API de Divulgação de Produtos. Los precios de esta app vienen de Google Shopping (SerpApi), que no cumple ninguna de las dos condiciones. La política no dice qué sanción aplican ni con qué frecuencia la hacen cumplir; lo peor que podría pasar es que cierren tu cuenta de Asociados (y con ella la comisión de Amazon).

- Para ocultar los precios de Amazon pon `AMAZON_SHOW_PRICES=false` en el `.env` o en los Secrets del hosting. Amazon sigue como tienda con tu enlace de afiliado pero sin precio (bloque "Sem preço confirmado nestas lojas"), no entra en el cálculo de "Melhor preço" y un producto cuyo único precio fuera el de Amazon no se lista. Las demás tiendas no cambian.
- El camino sin riesgo es la API oficial de Amazon (Product Advertising API); consulta en tu panel de Asociados los requisitos para obtener acceso.
- El pie de página incluye la frase que Amazon exige a sus asociados (cláusula 5 del contrato: «Como participante do Programa de Associados da Amazon, sou remunerado pelas compras qualificadas efetuadas»). Si Amazon cambia el texto, edítalo en `src/components/AffiliateNotice.tsx`.
- Comprueba las políticas vigentes en tu panel de Asociados: Amazon las actualiza y esta app no puede saberlo.

---

## Datos honestos: cómo funciona

- **Precios**: solo los que devuelve una tienda. Cada tarjeta dice cuándo se consultó ("Preço consultado há 12 min"). Si una tienda no tiene precio real, se muestra un enlace de búsqueda sin precio.
- **"Melhor preço"**: solo cuando hay al menos dos precios reales para comparar.
- **Descuento tachado**: solo si la fuente informó el precio anterior.
- **Historial**: el servidor guarda los precios que observa (en memoria y, si activas Supabase, en `historico_precios`). "Menor preço registrado" exige al menos 3 observaciones en 7 días o más.
- **Bajadas de precio**: solo cuando la misma tienda baja su propio precio entre dos consultas.
- **Alertas de precio**: se guardan en el aparato del visitante y se comprueban cuando abre la app (no hay avisos en segundo plano). El WhatsApp solo se ofrece si `WHATSAPP_ALERTS_ENABLED=true`, con consentimiento explícito.
- **Cupones**: nunca se generan. Ver siguiente sección.
- **Sin reseñas ni ventas inventadas**: si la fuente no da la nota, no se muestra.

---

## Cupones (`data/coupons.json`)

Copia `data/coupons.example.json` como modelo. Cada cupón necesita:

- `expiresAt`: pasada esa fecha desaparece solo.
- `verifiedAt`: cuándo lo probaste. El sello "Testado" solo aparece si la prueba fue en las últimas 48 horas.

Con `coupons.json` vacío (`[]`), la sección de cupones muestra enlaces a las tiendas y no inventa nada. También puedes usar la tabla `cupons` de Supabase.

---

## Supabase (opcional)

Sin Supabase todo funciona; solo se pierde el historial de precios al reiniciar el servidor.

1. Crea un proyecto en supabase.com y pega `supabase/schema.sql` en el **SQL Editor**.
2. Pon `SUPABASE_URL` y `SUPABASE_SERVICE_KEY` en el `.env`.

El SQL activa **RLS en todas las tablas sin ninguna política**: la clave pública (anon) no puede leer ni escribir nada. Solo el servidor, con la service key, habla con la base. No abras `alertas_usuario`: contiene teléfonos.

La tabla `ofertas_locales` permite cargar a mano ofertas con precio que tú escribes; se muestran con el tiempo que pasó desde que las cargaste ("Preço cadastrado há 3 d"), nunca como "consultado ahora".

---

## Área del dueño

Abre `/?admin` y, en el menú, "Área do dono". Muestra qué está configurado en el servidor (solo sí/no, nunca valores) y permite probar cómo se arman los enlaces de afiliado. No tiene PIN porque no maneja secretos ni permite cambiar nada del servidor.

---

## Calculadora de impuestos (Remessa Conforme)

Las reglas están en `src/utils/remessa.ts` (comprobadas en octubre de 2026): hasta US$ 50 el impuesto de importación es 0% (desde el 12/05/2026; antes era 20%); de US$ 50,01 a US$ 3.000 es 60% menos US$ 30 de deducción; el ICMS (17% a 20% según el estado) se calcula "por dentro". Fuera del Remessa Conforme es 60% sin deducción. Es una estimación y la pantalla lo dice.

**Pendiente de vigilar:** la Ley 15.502/2026 (sancionada el 10/09/2026) permite al Ministerio de Hacienda bajar la franja de más de US$ 50 a 30% mediante un acto propio. Cuando lo publique, ajusta `importRate` y `deductionUSD` en `src/utils/remessa.ts` según lo que diga ese acto, y el texto de `RemessaConformeModal.tsx`. **Revisa ese archivo cada vez que Hacienda o la Receita Federal cambien las reglas.**

---

## Publicar en Internet

La app necesita un servidor Node que guarde la clave en secreto. Por eso no sirve un hosting de solo páginas estáticas (Netlify, GitHub Pages...) ni Lovable, que solo publica su propio tipo de proyecto (página + Supabase). Hay dos caminos. En los dos, el primer paso es subir el código a GitHub **sin el archivo `.env`** (este paquete no lo trae; si copias el tuyo para correr la app en tu PC, ya está en `.gitignore`).

### Gratis: Google AI Studio (se publica en Cloud Run)

**No le des el `.zip` a AI Studio.** Su documentación solo describe la importación desde GitHub (el zip aparece únicamente como forma de exportar un proyecto). Si le das el zip y le pides "crea esta app", su agente no puede leer tu código y se inventa otra app desde cero, sin tus enlaces de afiliado ni la lógica de datos reales.

1. Descomprime el zip y sube su **contenido** (no el `.zip`) a un repositorio de GitHub, sin `.env`: en github.com, **Add file > Upload files** y arrastra todo lo que hay dentro de la carpeta `precocerto-brasil` (GitHub acepta hasta 100 archivos por vez; este paquete trae menos). Primero privado; si AI Studio no lo ve o no lo acepta, hazlo público: el código no contiene ninguna clave.
2. En AI Studio, modo Build: **Add files (+) > Import from GitHub** y elige el repositorio. Pídele solo que lo importe tal cual, sin "crear" ni "mejorar" nada.
3. En **Settings > Secrets** añade `SERPAPI_API_KEY` (y `SERPAPI_API_KEY_2` si usas una segunda clave). Con el plan gratis de SerpApi añade también `SERPAPI_DAILY_BUDGET=8`, `SERPAPI_IMMERSIVE_LOOKUPS=0`, `SEARCH_CACHE_MINUTES=1440` y `LIVE_DEALS_TTL_MINUTES=4320` (ver "Cuota de SerpApi"). **No añadas `NODE_ENV`**: AI Studio decide cómo arrancar la app, y con `NODE_ENV=production` el servidor busca la carpeta `dist/`; si AI Studio no construyó el proyecto, la página queda vacía y el registro dice "A pasta dist/ não existe".
4. Prueba la vista previa: busca un producto, abre `/?admin` (debe decir que SerpApi está configurado) y comprueba que los botones de tienda llevan tus IDs de afiliado.
5. Publica como ya lo hacías (Publish > Get Started > Publish App).
6. Cuando funcione, crea una clave nueva en SerpApi y cámbiala en Secrets: la clave vieja estuvo visible en la versión pública anterior. Después despublica la app antigua.

Cloud Run tiene una capa gratuita mensual (2 millones de peticiones, 180.000 vCPU-segundos y 360.000 GiB-segundos); un sitio pequeño suele quedar dentro, pero Google puede cobrar si te pasas. **Límite importante**: Cloud Run apaga el servidor cuando no hay visitas, y al reiniciarlo se vacían las cachés y el contador diario de SerpApi. Con pocas visitas eso puede gastar créditos de más. Si lo notas, usa Render (abajo) o guarda el contador en Supabase.

### Siempre encendido: Render (US$ 7 al mes)

Instancia de pago de 0,5 CPU y 512 MB, siempre encendida. Precios comprobados el 15/10/2026; revísalos en render.com/pricing.

1. Crea un repositorio **privado** en GitHub y sube el contenido de esta carpeta (sin `.env`).
2. En render.com elige **New > Blueprint** y selecciona el repositorio. Render lee `render.yaml`, te pide `SERPAPI_API_KEY` (pega tu clave) y crea el servicio.
3. Espera el primer despliegue (unos minutos). La dirección será parecida a `https://precocerto-brasil.onrender.com`.
4. Comprueba: abre la dirección, busca un producto y abre `/?admin`; debe decir que SerpApi está configurado.
5. Dominio propio (recomendable para Google): Render > Settings > Custom Domains. Cuando funcione, añade `PUBLIC_URL=https://tudominio.com.br` en Environment.
6. Cuando todo funcione, crea una clave nueva en SerpApi, cámbiala en Render (Environment) y despublica la app antigua de AI Studio: su versión pública mostraba la clave vieja.

Notas:

- **No uses el plan gratuito en producción.** Se duerme tras 15 minutos sin visitas y tarda cerca de 1 minuto en despertar. Render tampoco lo recomienda para producción. Además cada reinicio vacía las cachés y el contador diario de SerpApi, y con pocas visitas eso gasta créditos de más.
- Cada despliegue también reinicia el servidor. Evita desplegar muchas veces al día.
- Render no tiene región en Brasil; `render.yaml` usa Virginia, la más cercana de las disponibles.
- **Otras opciones**: Railway (plan Hobby, US$ 5 al mes con US$ 5 de uso incluido) funciona igual con `npm install --include=dev && npm run build` y `npm start`. Google Cloud Run (también lo que usa AI Studio al publicar) apaga el servidor cuando no hay visitas y pierde las cachés, a menos que fijes al menos una instancia (cuesta aparte).
- **IP de los visitantes**: los límites de peticiones usan la IP que el servidor ve. Por defecto cuenta 1 proxy (`TRUST_PROXY_HOPS=1`). Si tu hosting pone dos (por ejemplo Cloudflare y un balanceador), todos los visitantes parecerán tener la misma IP y compartirían el límite: prueba con `TRUST_PROXY_HOPS=2`. No pongas más de los reales, porque alguien podría falsear su IP.

---

## SEO (aparecer en Google)

**Lo que ya hace la app**

- Cada pantalla pública tiene su título, descripción, canonical y etiquetas para compartir. El servidor las escribe en el HTML de la primera carga y la app las mantiene al navegar.
- `robots.txt` y `sitemap.xml` se generan con la dirección real del sitio: portada, `/cupons` y las 9 categorías.
- Las búsquedas (`/busca/...`) llevan `noindex, follow`: son infinitas, tienen poco contenido propio y cada una cuesta un crédito de SerpApi. Se indexan la portada, `/cupons`, `/categorias` y `/categoria/<id>`.
- Una dirección que no existe responde **404** (la app se abre igual para la persona) y lleva `noindex`. Lo que alguien escriba en la dirección nunca llega a un título.
- Datos estructurados (JSON-LD): `Organization` y `WebSite`.
- `/api/` está bloqueado en `robots.txt`: los buscadores no pueden gastar tus créditos de SerpApi al rastrear.

**Lo que tienes que hacer tú** (necesita tus cuentas)

1. Publica en una dirección estable y pon `PUBLIC_URL`. Un dominio propio (`.com.br`, en registro.br, de pago) ayuda más a largo plazo que una dirección compartida del hosting.
2. En Google Search Console añade el sitio ("Prefijo de la URL"), verifícalo y envía `/sitemap.xml`. En Bing Webmaster Tools puedes importar el sitio desde Search Console.
3. Cada semana mira en Search Console **Páginas** (qué se indexó y por qué no) y **Rendimiento** (consultas, clics, posición). Con esos datos se decide qué página crear o mejorar.
4. Cuando esté publicada, prueba la portada y una categoría en PageSpeed Insights (velocidad en móvil).

---

## Seguridad y despliegue

- Cabeceras `nosniff` y `Referrer-Policy`, límite de 20 KB en el cuerpo JSON y límites de peticiones por IP (`/api` general, búsqueda y alertas con límites propios).
- Los textos que vienen de la URL se escapan antes de entrar en el HTML (canonical, JSON-LD, contenido para buscadores).
- El service worker (`public/sw.js`) solo se registra en producción. No guarda páginas ni precios: solo archivos con hash de `dist/assets` y una página sin conexión (`offline.html`).
- Detrás de un proxy (Cloud Run, etc.) ya está activado `trust proxy` (1 salto por defecto, configurable con `TRUST_PROXY_HOPS`), para que los límites usen la IP real del visitante.
- Vite solo se carga en desarrollo: en producción el servidor arranca más rápido y gasta menos memoria.
- Si alguna vez una clave se publicó en un repositorio o en un build, **rótala** en el panel del proveedor.

---

## Estructura

```
server.ts                 API (/api/search, /api/live-deals, /api/live-coupons, /api/price-history, /api/alerts, ...) y SEO
src/App.tsx               pantalla principal y navegación (/, /busca/<termo>, /categoria/<id>, /categorias, /cupons)
src/components/           tarjetas, filtros, modales, barra inferior, etc.
src/hooks/                tema claro/oscuro, accesibilidad de diálogos, instalación PWA, configuración pública
src/utils/                afiliados, ofertas, filtros, alertas, rutas, SEO, calculadora de impuestos
src/index.css             colores y tema oscuro (variables CSS)
public/                   iconos, manifest, imagen para compartir, service worker, offline.html
data/                     coupons.json (tus cupones reales)
supabase/schema.sql       tablas opcionales con RLS
```
