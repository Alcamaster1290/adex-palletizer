# Data Trade Admin Dashboard - Fase 4

## Objetivo

Fase 4 agrega la primera version read-only del panel administrador de Data Trade. El backend expone metricas protegidas por rol `admin` y ADEX muestra una UI minima solo cuando el flag opt-in esta activo.

No reemplaza auth legacy, no conecta SisLoPe y no hace obligatorio Data Trade Auth.

## Backend

Todos los endpoints requieren `Authorization: Bearer <accessToken>`:

- `GET /admin/metrics/overview`
- `GET /admin/users`
- `GET /admin/users/:id/activity`
- `GET /admin/events`
- `GET /admin/modules/usage`
- `GET /admin/retention`
- `GET /admin/errors`
- `POST /admin/metrics/aggregate` desde Fase 5, solo para admin y rango maximo de 31 dias.

Respuestas de seguridad:

- `401 UNAUTHENTICATED` si no hay Bearer token valido.
- `403 FORBIDDEN` si el usuario no tiene rol `admin`.
- `400 VALIDATION_ERROR` si filtros, fechas, `limit` u `offset` son invalidos.

Los endpoints no devuelven `password_hash`, refresh tokens, secretos, `ip_hash` ni IP plana.

## Queries soportadas

`GET /admin/users`:

```text
limit=1..100
offset>=0
```

`GET /admin/events`:

```text
module=sislope|adex_palletizer|data_trade_analytics|alvin|admin|api|unknown
event_name=user_signed_up|user_logged_in|module_opened|auth_panel_opened|admin_dashboard_opened|admin_metric_viewed|palletizer_calculation_created|palletizer_calculation_exported|palletizer_input_changed|map_layer_toggled|search_performed|file_uploaded|export_generated|admin_view_opened|api_error|session_started|session_ended
user_id=<uuid>
anonymous_id=<string>
from=<ISO datetime>
to=<ISO datetime>
limit=1..100
offset>=0
```

No hay SQL dinamico construido por concatenacion de strings; los filtros usan parametros.

## Fase 5: agregados diarios

Desde Fase 5, `GET /admin/metrics/overview`, `GET /admin/modules/usage` y `GET /admin/retention` usan `data_trade.daily_module_metrics` y `data_trade.daily_user_metrics` cuando existen. Si aun no hay agregados, hacen fallback seguro a `data_trade.events`.

El comando `npm run metrics:aggregate` recalcula agregados diarios sin borrar eventos crudos.

## UI ADEX opt-in

Flag nuevo:

```text
VITE_DATA_TRADE_ADMIN_DASHBOARD_ENABLED=false
```

Con el flag apagado no se muestra nada y la app funciona como antes. Con el flag activo:

- Usuario sin sesion Data Trade: mensaje para iniciar sesion.
- Usuario autenticado no admin: mensaje de acceso no autorizado.
- Usuario admin: cards de overview, tabla de usuarios, eventos recientes y uso por modulo.
- Error de API: mensaje controlado sin romper la app.

## PowerShell local

Levantar backend:

```powershell
cd "C:\Users\Alvaro\Proyectos\Data Trade\apps\api"
npm run docker:db:up
$env:DATABASE_URL = "postgres://postgres:postgres@localhost:55432/data_trade"
$env:IP_HASH_SECRET = "replace-with-at-least-32-random-bytes"
$env:AUTH_ACCESS_TOKEN_SECRET = "replace-with-at-least-32-random-bytes"
$env:AUTH_REFRESH_TOKEN_SECRET = "replace-with-at-least-32-random-bytes"
npm run db:migrate
```

Seed admin:

```powershell
$env:DATA_TRADE_ADMIN_EMAIL = "admin@datatrade.local"
$env:DATA_TRADE_ADMIN_PASSWORD = "ChangeMeOnlyLocal123"
$env:DATA_TRADE_ADMIN_NAME = "Data Trade Admin"
npm run db:seed:admin
Remove-Item Env:\DATA_TRADE_ADMIN_PASSWORD
```

Correr API:

```powershell
npm run dev
```

Login admin y smoke admin:

```powershell
$loginBody = @{
  email = "admin@datatrade.local"
  password = "ChangeMeOnlyLocal123"
} | ConvertTo-Json

$login = Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:8788/auth/login" `
  -ContentType "application/json" `
  -Body $loginBody

$headers = @{ Authorization = "Bearer $($login.accessToken)" }
Invoke-RestMethod -Uri "http://127.0.0.1:8788/admin/metrics/overview" -Headers $headers
Invoke-RestMethod -Uri "http://127.0.0.1:8788/admin/users" -Headers $headers
Invoke-RestMethod -Uri "http://127.0.0.1:8788/admin/events" -Headers $headers
```

Probar 401:

```powershell
try {
  Invoke-RestMethod -Uri "http://127.0.0.1:8788/admin/metrics/overview"
} catch {
  $_.Exception.Response.StatusCode.value__
}
```

Probar ADEX con panel apagado:

```powershell
cd "C:\Users\Alvaro\Proyectos\Data Trade\adex-palletizer-web"
$env:VITE_DATA_TRADE_AUTH_ENABLED = "false"
$env:VITE_DATA_TRADE_ADMIN_DASHBOARD_ENABLED = "false"
npm run dev
```

Probar ADEX con panel activo:

```powershell
cd "C:\Users\Alvaro\Proyectos\Data Trade\adex-palletizer-web"
$env:VITE_DATA_TRADE_AUTH_ENABLED = "true"
$env:VITE_DATA_TRADE_TRACKING_ENABLED = "true"
$env:VITE_DATA_TRADE_ADMIN_DASHBOARD_ENABLED = "true"
$env:VITE_DATA_TRADE_API_URL = "http://127.0.0.1:8788"
$env:VITE_DATA_TRADE_MODULE_CODE = "adex_palletizer"
npm run dev
```

## Vercel

ADEX:

```text
VITE_DATA_TRADE_AUTH_ENABLED=false
VITE_DATA_TRADE_API_URL=https://api.datatrade.pe
VITE_DATA_TRADE_TRACKING_ENABLED=false
VITE_DATA_TRADE_ADMIN_DASHBOARD_ENABLED=false
VITE_DATA_TRADE_MODULE_CODE=adex_palletizer
```

Mantener `VITE_DATA_TRADE_ADMIN_DASHBOARD_ENABLED=false` hasta que `apps/api` tenga dominio estable, CORS configurado y usuarios admin validados.

API:

```text
FRONTEND_ORIGINS=https://adex-palletizer.vercel.app,https://sis-lo-pe.vercel.app,https://app.datatrade.pe,https://palletizer.datatrade.pe
```

No usar wildcard. Vercel preview debe agregarse explicitamente si se prueba desde preview.

## Riesgos pendientes

- El rate limit sigue siendo in-memory; en produccion multi-instancia conviene Redis, Postgres advisory counters o WAF.
- Las metricas principales ya pueden usar agregados diarios, pero falta scheduler/cron productivo.
- El panel ADEX es una UI operativa minima, no un shell Data Trade final.
- Access token sigue en memoria; la migracion ideal posterior es cookie `HttpOnly` bajo `.datatrade.pe`.
