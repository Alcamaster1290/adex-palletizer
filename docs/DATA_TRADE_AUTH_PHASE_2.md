# Data Trade Auth Phase 2

Fecha: 2026-05-04

## Alcance

Fase 2 crea autenticacion comun en `apps/api` sin conectar todavia los frontends productivos. PR #14 queda aislado en `data-trade-phase-1`; esta fase vive en `data-trade-phase-2-auth`.

No se modifica `alvin`.

## Auditoria previa

### `apps/api`

- Backend Fastify + Drizzle + PostgreSQL en schema `data_trade`.
- Ya existian tablas `users`, `auth_accounts`, `auth_sessions`, `roles`, `memberships`, `modules`, `user_module_access`, `audit_logs` y tracking.
- No existian endpoints de auth reales.
- Tracking anonimo estaba endurecido en Fase 1.5.

### ADEX Palletizer

- App React/Vite en `adex-palletizer-web`.
- Auth real duplicada en `adex-palletizer-web/server/src/auth.ts` y Vercel Functions `api/auth/*`.
- Usa PostgreSQL legacy en `public.usuarios`, `public.auth_sessions`, `public.auth_audit_log`.
- Usa cookies `HttpOnly` para refresh token.
- Frontend `src/auth/authApi.ts` llama `/api/auth/login`, `/api/auth/register`, `/api/auth/me`, `/api/auth/logout`.
- Persistencia local pendiente: escenarios y labels usan `localStorage`.

### SisLoPe

- App React/Vite en `SistemaLogisticoPeruano/SisLoPe`.
- Auth duplicada en `api/lib/auth.ts` y `api/auth/*`, marcada como copia de ADEX.
- Usa cookies por host (`sislope_refresh_token`) y PostgreSQL legacy `public.usuarios`.
- Frontend `src/auth/authApi.ts` llama endpoints propios `/api/auth/*`.
- No hay Supabase, Clerk ni NextAuth.

## Decision

Usar identidad central en PostgreSQL `data_trade`.

No se usa Supabase ni Clerk por ahora. La auth propia queda conservadora:

- Passwords con bcrypt.
- Access token Bearer corto firmado con HMAC SHA-256.
- Refresh token opaco; se guarda solo hash SHA-256 en DB.
- Sesiones en `data_trade.auth_sessions`.
- Access control inicial por `data_trade.user_module_access`.
- Audit trail en `data_trade.audit_logs`.

La estrategia inicial usa `Authorization: Bearer` porque SisLoPe y ADEX siguen en dominios Vercel separados. Cuando existan subdominios comunes (`app.datatrade.pe`, `palletizer.datatrade.pe`, `api.datatrade.pe`) se puede agregar cookie compartida `Domain=.datatrade.pe` sin cambiar la identidad central.

## Endpoints

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/refresh`
- `GET /auth/me`
- `GET /auth/modules`
- `GET /auth/session`

## Seguridad

- Zod estricto y rechazo de campos extra.
- `request_id` por request.
- Errores uniformes `{ code, message, requestId, timestamp }`.
- Rate limit in-memory en register, login y refresh.
- No se loguean tokens, passwords ni secretos.
- `FRONTEND_ORIGINS` controla CORS.
- `AUTH_ACCESS_TOKEN_SECRET` requerido en produccion.
- `IP_HASH_SECRET` requerido en produccion.

## Migracion

`0001_auth_phase_2.sql` agrega indices incrementales:

- email unico por `lower(email)` para usuarios activos.
- indices de sesiones por estado/expiracion y actividad.
- indice de cuentas auth por usuario/proveedor.
- indice de accesso de modulos activo por usuario.

No se edita destructivamente `0000_initial_data_trade.sql`.

## Admin Bootstrap

Script:

```powershell
cd "C:\Users\Alvaro\Proyectos\Data Trade\apps\api"
$env:DATABASE_URL = "postgres://postgres:postgres@localhost:55432/data_trade"
$env:IP_HASH_SECRET = "replace-with-32-byte-local-dev-secret"
$env:AUTH_ACCESS_TOKEN_SECRET = "replace-with-32-byte-local-auth-secret"
$env:DATA_TRADE_ADMIN_EMAIL = "admin@datatrade.local"
$env:DATA_TRADE_ADMIN_PASSWORD = "ChangeMeOnlyLocal123"
$env:DATA_TRADE_ADMIN_NAME = "Data Trade Admin"
npm run db:seed:admin
Remove-Item Env:\DATA_TRADE_ADMIN_PASSWORD
```

El script es idempotente: si el usuario existe, verifica acceso admin; si no existe, lo crea. El password se recibe por env, se hashea y no se imprime.

## PowerShell Smoke

```powershell
npm run docker:db:up
$env:DATABASE_URL = "postgres://postgres:postgres@localhost:55432/data_trade"
npm run db:migrate
npm run db:verify

$env:IP_HASH_SECRET = "replace-with-32-byte-local-dev-secret"
$env:AUTH_ACCESS_TOKEN_SECRET = "replace-with-32-byte-local-auth-secret"
npm run dev
```

Registrar y autenticar:

```powershell
$registerBody = @{
  email = "user@datatrade.local"
  password = "ChangeMeOnlyLocal123"
  displayName = "Data Trade User"
} | ConvertTo-Json

$register = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8788/auth/register" -ContentType "application/json" -Body $registerBody

$loginBody = @{
  email = "user@datatrade.local"
  password = "ChangeMeOnlyLocal123"
} | ConvertTo-Json

$login = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8788/auth/login" -ContentType "application/json" -Body $loginBody
$headers = @{ Authorization = "Bearer $($login.accessToken)" }
Invoke-RestMethod -Uri "http://127.0.0.1:8788/auth/me" -Headers $headers
```

Tracking autenticado:

```powershell
$eventBody = @{
  module = "api"
  eventName = "module_opened"
  metadata = @{ authenticated = $true }
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8788/events/track" -Headers $headers -ContentType "application/json" -Body $eventBody
```

Logout:

```powershell
$logoutBody = @{ refreshToken = $login.refreshToken } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8788/auth/logout" -Headers $headers -ContentType "application/json" -Body $logoutBody
```

Tracking anonimo:

```powershell
$anonBody = @{
  anonymousId = "anon-local"
  module = "api"
  eventName = "module_opened"
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8788/events/track" -ContentType "application/json" -Body $anonBody
```

## Criterios de aceptacion

- `npm run build` pasa.
- `npm run test` pasa.
- `npm run db:migrate` aplica migracion incremental.
- `npm run db:verify` pasa.
- Smoke HTTP real cubre health, ready, register, login, me, tracking autenticado, logout y tracking anonimo.
- `events/track` sigue aceptando anonimo y asocia `user_id` si llega Bearer valido.

## Riesgos pendientes

- Rate limit in-memory no es suficiente para produccion multi-instancia; mover a Redis, Postgres o WAF antes de exposicion publica.
- Access tokens en frontends separados requieren manejo cuidadoso en memoria o almacenamiento seguro; evitar persistirlos en logs.
- Migracion de usuarios legacy `public.usuarios` todavia no esta implementada.
- Cookies compartidas requieren dominio comun real.
