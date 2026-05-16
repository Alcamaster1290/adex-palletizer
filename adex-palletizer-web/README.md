# ADEX Palletizer Web

SPA React/Vite para calculo, visualizacion 3D y export de unitarizacion caja/pallet/contenedor. Dentro de Data Trade, ADEX Palletizer es el primer frontend conectado al backend comun `apps/api`.

## Posicion En Data Trade

Este SPA es uno de los frontends del ecosistema Data Trade. Convive con SisLoPe y ALVIN y consume el backend comun `apps/api`.

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

- **Identidad**: llama a `apps/api` (`POST /auth/login`, `GET /auth/me`, `GET /auth/modules`, `POST /auth/logout`) con `VITE_DATA_TRADE_API_URL`.
- **Tracking**: envia eventos a `POST /events/track` cuando `VITE_DATA_TRADE_TRACKING_ENABLED=true`.
- **Handoff a SisLoPe**: `POST /auth/handoff/create` genera un codigo de un solo uso, sin tokens en URL.
- **Export a ALVIN**: produce `trade-case.v1` (`contracts/trade-case.v1.schema.json`).

## Estado Actual

- Frontend: React 19, Vite 7, TypeScript, Three/Fiber, Drei y Lucide.
- Backend comun activo: `apps/api` por `VITE_DATA_TRADE_API_URL`.
- Login visible: solo el login normal de ADEX.
- Auth por debajo: `POST /auth/login`, `GET /auth/me`, `GET /auth/modules`, `POST /auth/logout` en Data Trade API.
- Tracking opt-in: `POST /events/track` con Bearer si hay sesion, o `anonymousId` si no la hay.
- Admin Dashboard: disponible solo para usuarios `admin`, desde el menu del icono de perfil. No se renderiza en la pantalla principal.
- Persistencia local aun vigente: escenarios y labels por SKU usan `localStorage`.
- Auth legacy `/api/auth/*`: queda deprecated y solo debe usarse con `VITE_ADEX_LEGACY_AUTH_FALLBACK=true`.

## Desarrollo Local

Requisitos:

- Node.js `>=20.19.0`
- npm `>=10`
- Data Trade API local si se quiere login real

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

Si `VITE_DATA_TRADE_API_URL` no existe y el fallback legacy esta apagado, el login muestra un error claro de configuracion.

## Scripts

```powershell
npm run dev
npm run build
npm run test
npm run lint
npm run preview
```

Scripts legacy conservados temporalmente:

```powershell
npm run server:start
npm run server:dev
npm run server:build
npm run server:migrate
npm run docker:backend:up
npm run docker:backend:down
```

Estos scripts corresponden al backend ADEX anterior en `server/` y `api/`. No son el flujo principal de Data Trade.

## Flujo De Auth Actual

```text
AuthScreen normal ADEX
  -> authApi.ts
  -> http://localhost:8788/auth/login
  -> access token en memoria
  -> /auth/me y /auth/modules
```

Reglas:

- No mostrar un segundo login Data Trade.
- No mostrar "Cuenta comun opcional".
- No mostrar "Crear cuenta Data Trade".
- No guardar refresh token en `localStorage`.
- Usar fallback legacy solo para rollback local controlado.

## Dashboard Admin

Con `VITE_DATA_TRADE_ADMIN_DASHBOARD_ENABLED=true`:

1. Iniciar sesion con el login normal de ADEX.
2. Abrir el menu del icono de perfil.
3. Si el usuario tiene rol `admin`, aparece `Dashboard admin`.
4. El panel usa la sesion normal y consulta `/admin/*` en `apps/api`.

Usuarios normales no ven esa opcion.

## Tracking Data Trade

Eventos instrumentados:

- `module_opened`
- `palletizer_calculation_created`
- `export_generated`
- `api_error`

El cliente sanitiza metadata y no envia tokens, passwords, refresh tokens ni `user_id` manual.

## Funcionalidad De Palletizacion

Modos principales:

- `Caja unica`: calcula orientacion, capas, total de cajas, area, volumen y peso.
- `Multiples cajas`: genera preview determinista y heuristica por SKU.
- `Contenedores`: calcula pallets dentro de contenedores `20 GP`, `40 GP`, `40 HC` o custom.

Funciones relevantes:

- Presets de pallet y caja maestra.
- Skin 3D `Caja tecnica` o `Saco warehouse`.
- Label Designer por SKU con persistencia local.
- Escenarios guardados en `localStorage`.
- Share link con query params para reproducir casos.
- Export JSON/PNG y export de `trade-case.v1`.

## Integraciones

- SisLoPe: boton de cabecera configurable por `VITE_SISLOPE_URL`. Si hay sesion Data Trade activa, ADEX pide `POST /auth/handoff/create` con `targetModule=sislope` y abre `VITE_SISLOPE_URL?handoff=<code>`. El codigo es temporal y no contiene email, password ni tokens.
- ALVIN/import calculator: boton configurable por `VITE_IMPORT_CALC_URL`.
- Contratos: `../contracts/trade-case.v1.schema.json`.

## Validacion

```powershell
npm run build
npm run test
```

Smoke esperado con API local:

- Solo se ve el login normal ADEX.
- Login llama a `http://localhost:8788/auth/login`.
- No hay request a `/api/auth/login` cuando `VITE_ADEX_LEGACY_AUTH_FALLBACK=false`.
- El boton SisLoPe llama a `http://localhost:8788/auth/handoff/create` y la URL abierta solo contiene `handoff`.
- El Dashboard admin aparece solo desde el menu de perfil para el admin.

## Deploy Vercel

La app se despliega como SPA Vite. Si se usa el repo completo, respetar el `vercel.json` de raiz; si se configura desde dashboard, usar `adex-palletizer-web` como Root Directory y `dist` como Output Directory.

Variables minimas (produccion actual):

```text
VITE_DATA_TRADE_API_URL=https://data-trade-api-production.up.railway.app
VITE_DATA_TRADE_TRACKING_ENABLED=true
VITE_DATA_TRADE_MODULE_CODE=adex_palletizer
VITE_DATA_TRADE_ADMIN_DASHBOARD_ENABLED=true
VITE_ADEX_LEGACY_AUTH_FALLBACK=false
VITE_SISLOPE_URL=https://sis-lo-pe.vercel.app
```

`VITE_DATA_TRADE_API_URL` debe apuntar al backend desplegado (Railway hoy). Si se migra a un dominio propio (por ejemplo `api.datatrade.pe`), actualizar la variable y el CORS en `apps/api`.

## Modelos 3D

La app carga:

- `public/models/pallet.glb`
- modelo de saco warehouse para el skin `Saco warehouse`

Si un modelo no carga, se usa representacion geometrica de respaldo.
