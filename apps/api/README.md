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

## Seguridad actual de tracking

- Limite global de body por `REQUEST_BODY_LIMIT_BYTES`.
- Validacion Zod estricta y rechazo de campos extra.
- Whitelist de `module` y `eventName`.
- Sanitizacion de `metadata` por profundidad, cantidad de claves, largo de strings y arrays.
- Limite final de `metadata` por `EVENT_METADATA_MAX_BYTES`.
- Rate limit basico in-memory por `anonymousId`, `userId` o hash de IP.
- No se guarda IP plana; solo `ip_hash` HMAC con `IP_HASH_SECRET`.
- Errores uniformes con `code`, `message`, `requestId` y `timestamp`.
- `x-request-id` por request.
- Si llega Bearer token valido, `POST /events/track` asocia `user_id`.
- Si no hay auth, `POST /events/track` sigue aceptando `anonymousId`.

## Seguridad actual de auth

- PostgreSQL `data_trade` es la fuente central de identidad.
- Passwords con bcrypt; no se guardan passwords planos.
- Access token Bearer corto firmado con `AUTH_ACCESS_TOKEN_SECRET`.
- Refresh token aleatorio; solo se guarda hash SHA-256 en `data_trade.auth_sessions`.
- Refresh rota el token y extiende expiracion.
- Logout revoca la sesion.
- Rate limit in-memory para register, login y refresh.
- Validacion Zod estricta.
- Errores uniformes con `requestId`.
- No se loguean passwords, access tokens, refresh tokens ni secretos.
- CORS usa `FRONTEND_ORIGINS`.

## Variables

Ver `.env.example`. En produccion `IP_HASH_SECRET` y `AUTH_ACCESS_TOKEN_SECRET` deben estar definidos, ser largos y no compartirse entre ambientes.

`FRONTEND_ORIGINS` debe listar origenes exactos separados por coma. Evitar `*` en produccion.

## Migraciones y seeds

El schema Drizzle vive en `src/db/schema.ts`. La migracion inicial crea tablas core de usuarios, organizaciones, roles, sesiones, modulos, proyectos, runs, sesiones de mapa, uploads, eventos y auditoria dentro de `data_trade`.

La migracion inicial tambien siembra roles base y modulos:

- `sislope`
- `adex_palletizer`
- `data_trade_analytics`
- `alvin`
- `admin`
- `api`

Fase 2 agrega `npm run db:seed:admin` para crear o verificar el primer admin con `DATA_TRADE_ADMIN_EMAIL`, `DATA_TRADE_ADMIN_PASSWORD` y `DATA_TRADE_ADMIN_NAME`. El password solo se recibe por variable de entorno y se guarda hasheado.
