# Data Trade Frontend Integration Guide

Data Trade no debe aparecer como un login separado. En ADEX Palletizer, el
login visual normal usa Data Trade Auth por debajo cuando
`VITE_DATA_TRADE_API_URL` esta configurado.

## Backend Requerido

```powershell
cd "C:\Users\Alvaro\Proyectos\Data Trade\apps\api"
npm run docker:db:up
$env:DATABASE_URL = "postgres://postgres:postgres@localhost:55432/data_trade"
$env:IP_HASH_SECRET = "replace-with-32-byte-local-dev-secret"
$env:AUTH_ACCESS_TOKEN_SECRET = "replace-with-32-byte-local-auth-secret"
$env:AUTH_REFRESH_TOKEN_SECRET = "replace-with-32-byte-local-refresh-secret"
npm run db:migrate
npm run db:seed:admin
npm run dev
```

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8788/health"
Invoke-RestMethod -Uri "http://127.0.0.1:8788/ready"
```

## ADEX Local

```powershell
cd "C:\Users\Alvaro\Proyectos\Data Trade\adex-palletizer-web"
$env:VITE_DATA_TRADE_API_URL = "http://127.0.0.1:8788"
$env:VITE_DATA_TRADE_TRACKING_ENABLED = "true"
$env:VITE_DATA_TRADE_ADMIN_DASHBOARD_ENABLED = "true"
$env:VITE_DATA_TRADE_MODULE_CODE = "adex_palletizer"
$env:VITE_ADEX_LEGACY_AUTH_FALLBACK = "false"
npm run dev
```

Flujo esperado:

1. El usuario ve solo el login normal de ADEX.
2. El submit del login llama `POST /auth/login` en Data Trade.
3. No se llama `/api/auth/login` salvo rollback legacy explicito.
4. El tracking usa Bearer si hay sesion; si no, usa `anonymousId`.
5. El admin dashboard solo aparece dentro de la app para usuarios admin.

## Rollback Legacy Temporal

El fallback legacy queda deprecated y solo debe usarse para una emergencia local
o una ventana corta de rollback:

```powershell
$env:VITE_ADEX_LEGACY_AUTH_FALLBACK = "true"
```

Con ese flag, `authApi.ts` vuelve a usar `/api/auth/*`. No usar este modo como
flujo principal.

## Vercel

Variables para ADEX:

```text
VITE_DATA_TRADE_API_URL=https://api.datatrade.pe
VITE_DATA_TRADE_TRACKING_ENABLED=true
VITE_DATA_TRADE_ADMIN_DASHBOARD_ENABLED=true
VITE_DATA_TRADE_MODULE_CODE=adex_palletizer
VITE_ADEX_LEGACY_AUTH_FALLBACK=false
```

Variables para `apps/api`:

```text
FRONTEND_ORIGINS=https://adex-palletizer.vercel.app,https://sis-lo-pe.vercel.app,https://app.datatrade.pe,https://palletizer.datatrade.pe
```

Preview deployments solo deben agregarse si se listan explicitamente en
`FRONTEND_ORIGINS`.

## Contrato Del Cliente

El login normal de ADEX usa estos endpoints:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/refresh`
- `GET /auth/me`
- `GET /auth/modules`
- `POST /events/track`
- `GET /admin/metrics/overview`
- `GET /admin/users`
- `GET /admin/events`
- `GET /admin/modules/usage`

No guardar refresh token en `localStorage`. La sesion queda en memoria hasta que
se implemente cookie `HttpOnly` bajo un dominio comun.
