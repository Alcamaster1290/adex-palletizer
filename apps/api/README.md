# Data Trade API

Backend comun inicial para Data Trade. Esta fase no conecta todavia SisLoPe ni ADEX Palletizer en produccion.

## Stack

- Fastify 5
- PostgreSQL
- Drizzle ORM para schema tipado
- Migraciones SQL versionadas en `src/db/migrations`
- Zod para validacion estricta de payloads
- Vitest para pruebas unitarias e integracion opcional con DB

## Windows PowerShell

Ejecutar desde `apps/api`.

```powershell
cd "C:\Users\Alvaro\Proyectos\Data Trade\apps\api"
npm install
```

Levantar PostgreSQL local:

```powershell
npm run docker:db:up
$env:DATABASE_URL = "postgres://postgres:postgres@localhost:55432/data_trade"
```

Ejecutar y verificar migraciones:

```powershell
npm run db:migrate
npm run db:verify
```

Actualizar agregados diarios de metricas:

```powershell
npm run metrics:aggregate
```

Rango especifico:

```powershell
$env:METRICS_FROM = "2026-05-01"
$env:METRICS_TO = "2026-05-05"
npm run metrics:aggregate
Remove-Item Env:\METRICS_FROM
Remove-Item Env:\METRICS_TO
```

Compilar y probar:

```powershell
npm run build
npm run test
```

Correr API:

```powershell
$env:DATABASE_URL = "postgres://postgres:postgres@localhost:55432/data_trade"
$env:IP_HASH_SECRET = "replace-with-32-byte-local-dev-secret"
$env:AUTH_ACCESS_TOKEN_SECRET = "replace-with-32-byte-local-auth-secret"
$env:AUTH_REFRESH_TOKEN_SECRET = "replace-with-32-byte-local-refresh-secret"
npm run dev
```

Seed admin inicial:

```powershell
$env:DATA_TRADE_ADMIN_EMAIL = "admin@datatrade.local"
$env:DATA_TRADE_ADMIN_PASSWORD = "ChangeMeOnlyLocal123"
$env:DATA_TRADE_ADMIN_NAME = "Data Trade Admin"
npm run db:seed:admin
Remove-Item Env:\DATA_TRADE_ADMIN_PASSWORD
```

Probar endpoints base:

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8788/health"
Invoke-RestMethod -Uri "http://127.0.0.1:8788/ready"
```

Registrar usuario, login y consultar sesion:

```powershell
$registerBody = @{
  email = "user@datatrade.local"
  password = "ChangeMeOnlyLocal123"
  displayName = "Data Trade User"
} | ConvertTo-Json

$register = Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:8788/auth/register" `
  -ContentType "application/json" `
  -Body $registerBody

$loginBody = @{
  email = "user@datatrade.local"
  password = "ChangeMeOnlyLocal123"
} | ConvertTo-Json

$login = Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:8788/auth/login" `
  -ContentType "application/json" `
  -Body $loginBody

$headers = @{ Authorization = "Bearer $($login.accessToken)" }
Invoke-RestMethod -Uri "http://127.0.0.1:8788/auth/me" -Headers $headers
Invoke-RestMethod -Uri "http://127.0.0.1:8788/auth/modules" -Headers $headers
```

Probar dashboard admin con seed admin:

```powershell
$adminLoginBody = @{
  email = "admin@datatrade.local"
  password = "ChangeMeOnlyLocal123"
} | ConvertTo-Json

$adminLogin = Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:8788/auth/login" `
  -ContentType "application/json" `
  -Body $adminLoginBody

$adminHeaders = @{ Authorization = "Bearer $($adminLogin.accessToken)" }
Invoke-RestMethod -Uri "http://127.0.0.1:8788/admin/metrics/overview" -Headers $adminHeaders
Invoke-RestMethod -Uri "http://127.0.0.1:8788/admin/users" -Headers $adminHeaders
Invoke-RestMethod -Uri "http://127.0.0.1:8788/admin/events" -Headers $adminHeaders
Invoke-RestMethod -Uri "http://127.0.0.1:8788/admin/modules/usage" -Headers $adminHeaders
Invoke-RestMethod -Uri "http://127.0.0.1:8788/admin/retention" -Headers $adminHeaders
Invoke-RestMethod -Uri "http://127.0.0.1:8788/admin/errors" -Headers $adminHeaders

$aggregateBody = @{
  from = "2026-05-01"
  to = "2026-05-05"
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:8788/admin/metrics/aggregate" `
  -Headers $adminHeaders `
  -ContentType "application/json" `
  -Body $aggregateBody
```

Trackear evento autenticado y anonimo:

```powershell
$authEventBody = @{
  module = "api"
  eventName = "module_opened"
  path = "/auth-smoke"
  metadata = @{ source = "powershell"; authenticated = $true }
} | ConvertTo-Json -Depth 5

Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:8788/events/track" `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $authEventBody

$body = @{
  anonymousId = "local-smoke-1"
  module = "api"
  eventName = "module_opened"
  path = "/smoke"
  metadata = @{ source = "powershell" }
} | ConvertTo-Json -Depth 5

Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:8788/events/track" `
  -ContentType "application/json" `
  -Body $body
```

Refresh y logout:

```powershell
$refreshBody = @{ refreshToken = $login.refreshToken } | ConvertTo-Json
$refresh = Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:8788/auth/refresh" `
  -ContentType "application/json" `
  -Body $refreshBody

$logoutBody = @{ refreshToken = $refresh.refreshToken } | ConvertTo-Json
$logoutHeaders = @{ Authorization = "Bearer $($refresh.accessToken)" }
Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:8788/auth/logout" `
  -Headers $logoutHeaders `
  -ContentType "application/json" `
  -Body $logoutBody
```

Probar integracion con DB real desde Vitest:

```powershell
$env:TEST_DATABASE_URL = "postgres://postgres:postgres@localhost:55432/data_trade"
npm run test
Remove-Item Env:\TEST_DATABASE_URL
```

Resetear solo el volumen local de esta compose:

```powershell
npm run docker:db:reset
```

## Endpoints iniciales

- `GET /health`: estado del proceso. No toca PostgreSQL.
- `GET /ready`: valida conectividad real con PostgreSQL.
- `POST /events/track`: tracking interno con IP hasheada.
- `POST /auth/register`: crea usuario central y sesion.
- `POST /auth/login`: emite access token corto y refresh token.
- `POST /auth/refresh`: rota refresh token y emite access token nuevo.
- `POST /auth/logout`: revoca sesion por refresh token o access token.
- `GET /auth/me`: devuelve usuario autenticado por Bearer token.
- `GET /auth/modules`: devuelve modulos habilitados para el usuario.
- `GET /auth/session`: devuelve sesion activa.
- `GET /admin/metrics/overview`: metricas globales read-only para rol admin.
- `GET /admin/users`: usuarios paginados sin hashes ni secretos.
- `GET /admin/users/:id/activity`: ultimos eventos y conteos de un usuario.
- `GET /admin/events`: eventos paginados con filtros validados.
- `GET /admin/modules/usage`: uso agregado por modulo.
- `GET /admin/retention`: retencion basica 7d/30d.
- `GET /admin/errors`: agrupacion de eventos `api_error`.
- `POST /admin/metrics/aggregate`: recalculo manual de agregados diarios para rango de hasta 31 dias.

## Seguridad actual de admin

- Bearer token obligatorio en todos los endpoints `/admin/*`.
- Rol `admin` obligatorio; usuario normal recibe `403`.
- Query params validados con Zod.
- `limit` maximo de 100 para listados.
- No se devuelven `password_hash`, refresh tokens, secretos, `ip_hash` ni IP plana.
- Errores uniformes con `requestId`.
- Las consultas usan parametros; no hay filtros por SQL dinamico concatenado.
- Agregacion manual limitada a 31 dias por request.

## Seguridad actual de tracking

- Limite global de body por `REQUEST_BODY_LIMIT_BYTES`.
- Validacion Zod estricta y rechazo de campos extra.
- Whitelist de `module` y `eventName`.
- Sanitizacion de `metadata` por profundidad, cantidad de claves, largo de strings y arrays.
- Limite final de `metadata` por `EVENT_METADATA_MAX_BYTES`.
- Rate limit basico in-memory por `anonymousId`, `userId` o hash de IP.
- No se guarda IP plana; solo `ip_hash` HMAC con `IP_HASH_SECRET`.
- Rechaza `metadata.user_id` y `metadata.userId` para evitar suplantacion por metadata.
- Errores uniformes con `code`, `message`, `requestId` y `timestamp`.
- `x-request-id` por request.
- Si llega Bearer token valido, `POST /events/track` asocia `user_id`.
- Si no hay auth, `POST /events/track` sigue aceptando `anonymousId`.
- Eventos productivos soportados incluyen `auth_panel_opened`, `admin_dashboard_opened`, `admin_metric_viewed`, `palletizer_calculation_exported` y `palletizer_input_changed`.

## Seguridad actual de auth

- PostgreSQL `data_trade` es la fuente central de identidad.
- Passwords con `bcryptjs` usando bcrypt cost 12; no se guardan passwords planos. En produccion se debe evaluar `argon2id` o `bcrypt` nativo si el runtime lo permite.
- Access token Bearer corto firmado con `AUTH_ACCESS_TOKEN_SECRET`.
- Refresh token aleatorio; solo se guarda HMAC-SHA-256 con `AUTH_REFRESH_TOKEN_SECRET` en `data_trade.auth_sessions`.
- Refresh rota el token y extiende expiracion.
- Un refresh token reutilizado despues de rotacion falla.
- Logout revoca la sesion.
- Refresh despues de logout falla.
- Rate limit in-memory para register, login y refresh.
- Validacion Zod estricta.
- Errores uniformes con `requestId`.
- No se loguean passwords, access tokens, refresh tokens ni secretos.
- CORS usa `FRONTEND_ORIGINS`.
- `APP_ENV=production` exige secretos fuertes y falla al iniciar si falta alguno.
- `FRONTEND_ORIGINS` no acepta `*` porque CORS tiene credenciales habilitadas.

## CORS y Frontends

Configurar origenes exactos separados por coma:

```text
https://sis-lo-pe.vercel.app
https://adex-palletizer.vercel.app
https://app.datatrade.pe
https://palletizer.datatrade.pe
```

`api.datatrade.pe` es el host del backend y no necesita aparecer como origen frontend salvo que sirva una UI. Vercel preview debe agregarse explicitamente; no se permite wildcard.

La estrategia inicial para frontends separados es `Authorization: Bearer`. Mantener access token idealmente en memoria, manejar refresh token de forma controlada y evitar `localStorage` para refresh token. Si se usa `localStorage` temporalmente, tratarlo como riesgo hasta migrar a cookies `HttpOnly` bajo `.datatrade.pe`.

## Frontend opt-in Fase 3

ADEX Palletizer y SisLoPe pueden conectarse sin reemplazar auth legacy mediante estos flags de Vite:

```text
VITE_DATA_TRADE_AUTH_ENABLED=false
VITE_DATA_TRADE_API_URL=
VITE_DATA_TRADE_TRACKING_ENABLED=false
VITE_DATA_TRADE_ADMIN_DASHBOARD_ENABLED=false
VITE_DATA_TRADE_MODULE_CODE=adex_palletizer
```

SisLoPe debe usar `VITE_DATA_TRADE_MODULE_CODE=sislope`.

Con flags apagados no hay llamadas a `apps/api`. Con flags activos, los frontends usan `Authorization: Bearer`, consultan `/auth/me` y `/auth/modules`, y envian `/events/track` autenticado o anonimo. Ver `docs/DATA_TRADE_FRONTEND_INTEGRATION_GUIDE.md`.

## Variables

Ver `.env.example`. En produccion `IP_HASH_SECRET`, `AUTH_ACCESS_TOKEN_SECRET` y `AUTH_REFRESH_TOKEN_SECRET` deben estar definidos, ser largos y no compartirse entre ambientes.

`FRONTEND_ORIGINS` debe listar origenes exactos separados por coma. No usar `*`.

## Migraciones y seeds

El schema Drizzle vive en `src/db/schema.ts`. La migracion inicial crea tablas core de usuarios, organizaciones, roles, sesiones, modulos, proyectos, runs, sesiones de mapa, uploads, eventos y auditoria dentro de `data_trade`.

Fase 5 agrega `0002_daily_metrics.sql` con:

- `data_trade.daily_module_metrics`
- `data_trade.daily_user_metrics`

`GET /admin/metrics/overview`, `GET /admin/modules/usage` y `GET /admin/retention` usan agregados diarios cuando existen y hacen fallback a `data_trade.events` cuando no hay agregados. Los eventos crudos no se eliminan.

La migracion inicial tambien siembra roles base y modulos:

- `sislope`
- `adex_palletizer`
- `data_trade_analytics`
- `alvin`
- `admin`
- `api`

Fase 2 agrega `npm run db:seed:admin` para crear o verificar el primer admin con `DATA_TRADE_ADMIN_EMAIL`, `DATA_TRADE_ADMIN_PASSWORD` y `DATA_TRADE_ADMIN_NAME`. El password solo se recibe por variable de entorno y se guarda hasheado.
