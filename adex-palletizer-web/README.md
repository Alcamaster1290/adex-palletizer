# ADEX Palletizer Web

SPA React/Vite para calculo, visualizacion 3D y export de unitarizacion caja/pallet/contenedor. Dentro del ecosistema Data Trade, es el primer frontend integrado al backend comun `apps/api`.

Produccion: https://adex-palletizer.vercel.app

## Posicion En Data Trade

```text
data-trade/
|-- apps/api/                  Backend comun (Fastify + PostgreSQL "data_trade")
|                              Deploy: data-trade-api-production.up.railway.app
|-- adex-palletizer-web/       <- ESTE PROYECTO (React 19, Vite 7, Three/Fiber)
|                              Deploy: adex-palletizer.vercel.app
|-- SistemaLogisticoPeruano/
|   `-- SisLoPe/               Repo anidado (Vercel: sis-lo-pe.vercel.app)
|-- alvin/                     Repo anidado (Streamlit: alvin-comex.streamlit.app)
|-- contracts/                 Contratos JSON versionados (trade-case.v1, trade-costs.v1)
`-- docs/                      Arquitectura, runbook y planes
```

Como conversa este frontend con el resto del sistema:

- **Identidad**: `apps/api` con `VITE_DATA_TRADE_API_URL` para `POST /auth/login`, `GET /auth/me`, `GET /auth/modules`, `POST /auth/logout`.
- **Tracking**: `POST /events/track` cuando `VITE_DATA_TRADE_TRACKING_ENABLED=true`. El access token viaja como Bearer si hay sesion; si no, va `anonymousId`.
- **Handoff a SisLoPe**: `POST /auth/handoff/create` produce un codigo de un solo uso, valido 60s, que el boton SisLoPe envia como `?handoff=<codigo>`. No hay tokens en URL.
- **Export a ALVIN**: produce `trade-case.v1` (`contracts/trade-case.v1.schema.json`) para que ALVIN lo consuma.

## Estado Actual

- Frontend: React 19, Vite 7, TypeScript, Three Fiber, Drei y Lucide.
- Backend comun activo: `apps/api` (en Railway en produccion, Docker local en dev).
- Login visible: solo el login normal de ADEX. Auth real corre por debajo contra Data Trade Auth.
- Tracking opt-in con sanitizacion de metadata (no envia tokens, passwords, refresh tokens ni `user_id` manual).
- Dashboard admin disponible desde el menu de perfil cuando el usuario tiene acceso al modulo `admin` (role admin o `accessLevel="admin"` en `/auth/modules`).
- Persistencia local en `localStorage`: escenarios guardados y label config por SKU. Sesiones y refresh tokens viven en memoria de modulo, nunca en `localStorage`.
- Fallback legacy `/api/auth/*` deprecated; solo se activa con `VITE_ADEX_LEGACY_AUTH_FALLBACK=true` para rollback controlado.

## Desarrollo Local

Requisitos:

- Node.js `>=20.19.0`
- npm `>=10`
- Data Trade API local (`apps/api`) si se quiere login real

```powershell
cd adex-palletizer-web
npm install
npm run dev -- --force
```

Variables recomendadas en `.env.local`:

```text
VITE_DATA_TRADE_API_URL=http://localhost:8788
VITE_DATA_TRADE_TRACKING_ENABLED=true
VITE_DATA_TRADE_MODULE_CODE=adex_palletizer
VITE_DATA_TRADE_ADMIN_DASHBOARD_ENABLED=true
VITE_ADEX_LEGACY_AUTH_FALLBACK=false
VITE_SISLOPE_URL=https://sis-lo-pe.vercel.app
VITE_IMPORT_CALC_URL=https://alvin-comex.streamlit.app
```

Si `VITE_DATA_TRADE_API_URL` esta vacio y el fallback legacy esta apagado, el login muestra un error de configuracion explicito en pantalla.

Las flags booleanas (`VITE_*_ENABLED`, `VITE_*_FALLBACK`) toleran whitespace alrededor: `parseBooleanFlag` aplica `.trim().toLowerCase()` antes de comparar, asi que `"true\n"`, `" TRUE "`, `"1"` y `"True"` valen lo mismo.

## Scripts

Flujo principal Data Trade:

```powershell
npm run dev      # vite dev server
npm run build    # tsc + vite build (produce dist/)
npm run test     # vitest run
npm run lint     # eslint .
npm run preview  # vite preview del bundle de produccion
```

Scripts legacy del backend ADEX anterior (en `server/` y `api/`). **No** forman parte del flujo Data Trade actual y se conservan solo durante la transicion:

```powershell
npm run server:start         # legacy
npm run server:dev           # legacy
npm run server:build         # legacy
npm run server:migrate       # legacy
npm run docker:backend:up    # legacy
npm run docker:backend:down  # legacy
```

## Flujo De Auth

```text
AuthScreen normal ADEX
  -> authApi.loginWithPassword(email, password)
  -> POST https://data-trade-api-production.up.railway.app/auth/login
  -> applyDataTradeAuthResponse: accessToken y refreshToken en memoria
  -> loadDataTradeModules: GET /auth/modules con Bearer
  -> applyAuthSession: setAuthUser, setAuthModules, setAuthStatus
```

Reglas:

- Un solo login visible (el de ADEX). No mostrar "Cuenta comun Data Trade" ni "Crear cuenta Data Trade" como pantallas separadas.
- Access token vive solo en memoria del modulo `authApi.ts`. Un hard refresh pierde la sesion y el usuario tiene que volver a loguearse (no se persiste en `localStorage`).
- `loginWithPassword` y `fetchCurrentSession` mapean el response del backend con `mapDataTradeUser`, que produce `role: 'admin'` cuando el array `roles` incluye `admin`.
- Fallback legacy solo para rollback local.

## Dashboard Admin

Con `VITE_DATA_TRADE_ADMIN_DASHBOARD_ENABLED=true`:

1. Iniciar sesion con el login normal de ADEX.
2. Abrir el menu del icono de perfil (esquina superior derecha del header).
3. Si el usuario tiene acceso al modulo `admin` (role admin o `accessLevel="admin"` en `/auth/modules`), aparece la opcion **"Dashboard admin"**.
4. Click abre un modal con metricas, tabla de usuarios (con su rol, eventos y ultimo acceso), eventos recientes, uso por modulo y errores. Consume `/admin/metrics/overview`, `/admin/users`, `/admin/events`, `/admin/modules/usage`, `/admin/retention`, `/admin/errors`.

Usuarios sin rol admin no ven el item en el menu. El feature flag se evalua en cada render con el valor inyectado en build time.

## Tracking Data Trade

Eventos instrumentados (whitelist en backend y frontend):

- `module_opened`
- `palletizer_calculation_created`
- `export_generated`
- `api_error`

El cliente sanitiza metadata: nunca envia tokens, passwords, refresh tokens, IPs planas, ni `user_id`/`userId` manual.

## Funcionalidad De Palletizacion

Modos principales:

- **Caja unica**: calcula orientacion, capas, total de cajas, area, volumen y peso.
- **Multiples cajas**: preview determinista y heuristica por SKU para mezclar diferentes cajas en un pallet.
- **Contenedores**: calcula pallets dentro de contenedores `20 GP`, `40 GP`, `40 HC` o dimension custom.

Funciones de soporte:

- Presets de pallet y caja maestra.
- Skin 3D: `Caja tecnica` o `Saco warehouse`.
- Label Designer por SKU con persistencia local.
- Escenarios guardados en `localStorage`.
- Share link con query params reproducible.
- Export JSON, PNG, y `trade-case.v1` para alimentar ALVIN.

## Integraciones

- **SisLoPe**: boton en el header configurable por `VITE_SISLOPE_URL`. Si hay sesion Data Trade activa, ADEX pide `POST /auth/handoff/create` con `targetModule=sislope` y abre `VITE_SISLOPE_URL?handoff=<codigo>`. El codigo es de un solo uso y se invalida tras 60s o tras `POST /auth/handoff/exchange`.
- **ALVIN / import calculator**: boton configurable por `VITE_IMPORT_CALC_URL`. Sin handoff por ahora; el flujo es exportar `trade-case.v1` y subirlo en ALVIN.
- **Contratos**: schemas en `../contracts/`. El export sigue `trade-case.v1.schema.json`.

## Validacion

```powershell
npm run build
npm run test
```

Smoke esperado con API local funcionando:

- Solo se ve el login normal ADEX (sin paneles paralelos Data Trade).
- Login dispara `POST http://localhost:8788/auth/login`.
- No hay request a `/api/auth/login` cuando `VITE_ADEX_LEGACY_AUTH_FALLBACK=false`.
- Boton SisLoPe dispara `POST http://localhost:8788/auth/handoff/create` y abre la URL externa solo con `?handoff=<codigo>`.
- Dashboard admin aparece solo desde el menu de perfil para users con acceso al modulo `admin`.

## Deploy Vercel

La app se despliega como SPA Vite. Root Directory `adex-palletizer-web/`, Output Directory `dist`. El proyecto Vercel queda en `alcamaster1290s-projects/adex-palletizer`. Auto-deploy desde branch `main`.

Variables requeridas (Environment: Production):

```text
VITE_DATA_TRADE_API_URL=https://data-trade-api-production.up.railway.app
VITE_DATA_TRADE_TRACKING_ENABLED=true
VITE_DATA_TRADE_MODULE_CODE=adex_palletizer
VITE_DATA_TRADE_ADMIN_DASHBOARD_ENABLED=true
VITE_ADEX_LEGACY_AUTH_FALLBACK=false
VITE_SISLOPE_URL=https://sis-lo-pe.vercel.app
```

Si se agregan via Vercel CLI usar `printf "valor"` y no `echo "valor"` (este ultimo mete `\n`). El frontend ya tolera whitespace en booleanos, pero limpiar el valor desde el origen es mejor.

Si se cambia el backend a un dominio propio (ej. `api.datatrade.pe`), actualizar `VITE_DATA_TRADE_API_URL` y el `FRONTEND_ORIGINS` del API en Railway.

## Modelos 3D

La app carga:

- `public/models/pallet.glb`
- Modelo de saco warehouse para el skin `Saco warehouse`.

Si un modelo no carga (404 o error de WebGL), la escena 3D usa representacion geometrica de respaldo con dimensiones declaradas.
