# Data Trade Frontend Integration Guide

## Backend requerido

Levantar `apps/api`:

```powershell
cd "C:\Users\Alvaro\Proyectos\Data Trade\apps\api"
npm run docker:db:up
$env:DATABASE_URL = "postgres://postgres:postgres@localhost:55432/data_trade"
$env:IP_HASH_SECRET = "replace-with-32-byte-local-dev-secret"
$env:AUTH_ACCESS_TOKEN_SECRET = "replace-with-32-byte-local-auth-secret"
$env:AUTH_REFRESH_TOKEN_SECRET = "replace-with-32-byte-local-refresh-secret"
npm run db:migrate
npm run dev
```

Probar backend:

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8788/health"
Invoke-RestMethod -Uri "http://127.0.0.1:8788/ready"
```

## ADEX local con flags apagados

```powershell
cd "C:\Users\Alvaro\Proyectos\Data Trade\adex-palletizer-web"
$env:VITE_DATA_TRADE_AUTH_ENABLED = "false"
$env:VITE_DATA_TRADE_TRACKING_ENABLED = "false"
npm run dev
```

Resultado esperado: la app funciona como antes y no llama a `apps/api`.

## ADEX local con Data Trade activo

```powershell
cd "C:\Users\Alvaro\Proyectos\Data Trade\adex-palletizer-web"
$env:VITE_DATA_TRADE_AUTH_ENABLED = "true"
$env:VITE_DATA_TRADE_TRACKING_ENABLED = "true"
$env:VITE_DATA_TRADE_API_URL = "http://127.0.0.1:8788"
$env:VITE_DATA_TRADE_MODULE_CODE = "adex_palletizer"
npm run dev
```

Flujo:

1. Entrar con auth legacy ADEX.
2. Usar el panel Data Trade para registrar o iniciar sesion.
3. Confirmar que `GET /auth/me` responde desde el panel.
4. Ejecutar un calculo de palletizacion.
5. Verificar evento:

```powershell
cd "C:\Users\Alvaro\Proyectos\Data Trade\apps\api"
$env:DATABASE_URL = "postgres://postgres:postgres@localhost:55432/data_trade"
npm run db:verify
```

## SisLoPe local con Data Trade activo

Como SisLoPe es repo Git anidado:

```powershell
cd "C:\Users\Alvaro\Proyectos\Data Trade\SistemaLogisticoPeruano\SisLoPe"
$env:VITE_DATA_TRADE_AUTH_ENABLED = "true"
$env:VITE_DATA_TRADE_TRACKING_ENABLED = "true"
$env:VITE_DATA_TRADE_API_URL = "http://127.0.0.1:8788"
$env:VITE_DATA_TRADE_MODULE_CODE = "sislope"
npm run dev
```

Flujo:

1. Entrar con auth legacy SisLoPe.
2. Usar el panel Data Trade.
3. Alternar labels, flows, corridors o fleet heatmap.
4. Confirmar eventos `module_opened`, `session_started` y `map_layer_toggled`.

## Vercel

Variables para ADEX:

```text
VITE_DATA_TRADE_AUTH_ENABLED=false
VITE_DATA_TRADE_API_URL=https://api.datatrade.pe
VITE_DATA_TRADE_TRACKING_ENABLED=false
VITE_DATA_TRADE_MODULE_CODE=adex_palletizer
```

Variables para SisLoPe:

```text
VITE_DATA_TRADE_AUTH_ENABLED=false
VITE_DATA_TRADE_API_URL=https://api.datatrade.pe
VITE_DATA_TRADE_TRACKING_ENABLED=false
VITE_DATA_TRADE_MODULE_CODE=sislope
```

Variables para `apps/api`:

```text
FRONTEND_ORIGINS=https://adex-palletizer.vercel.app,https://sis-lo-pe.vercel.app,https://app.datatrade.pe,https://palletizer.datatrade.pe
```

Preview deployments solo deben agregarse si se listan explicitamente en `FRONTEND_ORIGINS`.

## Contrato del cliente

El cliente implementa:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/refresh`
- `GET /auth/me`
- `GET /auth/modules`
- `POST /events/track`

Tracking autenticado agrega `Authorization: Bearer` si hay access token en memoria. Tracking anonimo manda `anonymousId`. El cliente elimina claves sensibles de metadata como `token`, `password`, `accessToken`, `refreshToken`, `userId` y `user_id`.

## Criterios de rollback

Para desactivar completamente:

```text
VITE_DATA_TRADE_AUTH_ENABLED=false
VITE_DATA_TRADE_TRACKING_ENABLED=false
```

No requiere revertir codigo ni modificar auth legacy.
