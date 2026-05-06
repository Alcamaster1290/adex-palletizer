# Data Trade API

Backend comun para identidad, sesiones, modulos, eventos, metricas y dashboard admin del ecosistema Data Trade.

## Estado Actual

- Runtime: Fastify 5 sobre Node.js.
- Base de datos: PostgreSQL con schema `data_trade`.
- ORM/schema: Drizzle ORM.
- Migraciones: SQL versionado en `src/db/migrations`.
- Auth: email/password, access token Bearer corto y refresh token hasheado en DB.
- Handoff SSO: codigos temporales de un solo uso para navegar entre modulos sin tokens en URL.
- Tracking: `POST /events/track` con metadata sanitizada e IP hasheada.
- Admin: endpoints read-only protegidos por rol `admin`.
- Limpieza local: script dev-only para usuarios/eventos smoke.

## Desarrollo Local En Windows

```powershell
cd apps/api
npm install
npm run docker:db:up
$env:DATABASE_URL='postgres://postgres:postgres@localhost:55432/data_trade'
npm run db:migrate
npm run db:verify
```

Variables recomendadas:

```powershell
$env:DATABASE_URL='postgres://postgres:postgres@localhost:55432/data_trade'
$env:IP_HASH_SECRET='clave-local-larga'
$env:AUTH_ACCESS_TOKEN_SECRET='clave-local-larga'
$env:AUTH_REFRESH_TOKEN_SECRET='clave-local-larga'
$env:DATA_TRADE_ADMIN_EMAIL='admin@datatrade.local'
$env:DATA_TRADE_ADMIN_PASSWORD='ADEXPERU2026'
$env:DATA_TRADE_ADMIN_NAME='Data Trade Admin'
$env:FRONTEND_ORIGINS='http://localhost:5173,http://localhost:5174'
```

Seed admin:

```powershell
npm run db:seed:admin
```

Correr API:

```powershell
npm run dev
```

Endpoints base:

```powershell
Invoke-RestMethod http://localhost:8788/health
Invoke-RestMethod http://localhost:8788/ready
```

## Scripts

```powershell
npm run dev
npm run build
npm run test
npm run start
npm run db:generate
npm run db:migrate
npm run db:verify
npm run db:seed:admin
npm run db:cleanup:smoke
npm run docker:db:up
npm run docker:db:down
npm run docker:db:reset
```

## Auth

Endpoints:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/refresh`
- `GET /auth/me`
- `GET /auth/modules`
- `GET /auth/session`
- `POST /auth/handoff/create`
- `POST /auth/handoff/exchange`

Propiedades de seguridad:

- Passwords hasheados con `bcryptjs` cost 12.
- Access token firmado con `AUTH_ACCESS_TOKEN_SECRET`.
- Refresh token aleatorio; solo se guarda HMAC-SHA-256 con `AUTH_REFRESH_TOKEN_SECRET`.
- Refresh token rota en `/auth/refresh`.
- Logout revoca la sesion.
- Rate limit in-memory para register/login/refresh.
- En produccion faltas de secretos fuertes hacen fallar el arranque.

Nota de produccion: evaluar `argon2id` o `bcrypt` nativo si el runtime lo permite.

### Handoff Entre Modulos

`POST /auth/handoff/create` requiere `Authorization: Bearer <accessToken>` y body:

```json
{ "targetModule": "sislope" }
```

Devuelve un `handoffCode` valido por 60 segundos. El codigo se devuelve solo al cliente y en PostgreSQL se guarda un HMAC, nunca el valor plano.

`POST /auth/handoff/exchange` recibe:

```json
{ "code": "codigo-temporal", "targetModule": "sislope" }
```

Valida expiracion, uso unico, modulo destino y acceso del usuario. Si todo pasa, marca el codigo como usado y crea una sesion normal Data Trade con `accessToken`, `refreshToken`, `user`, `session` y `modules`.

## Tracking

Endpoint:

- `POST /events/track`

Eventos base:

- `user_signed_up`
- `user_logged_in`
- `module_opened`
- `palletizer_calculation_created`
- `map_layer_toggled`
- `search_performed`
- `file_uploaded`
- `export_generated`
- `admin_view_opened`
- `api_error`
- `session_started`
- `session_ended`

Reglas:

- Si llega Bearer valido, se asocia `user_id`.
- Si no hay sesion, debe llegar `anonymousId`.
- No se acepta `metadata.user_id` ni `metadata.userId`.
- No se guarda IP plana; solo `ip_hash`.
- Metadata limitada por tamano, profundidad, arrays y largo de strings.

## Admin

Endpoints protegidos por Bearer + rol `admin`:

- `GET /admin/metrics/overview`
- `GET /admin/users`
- `GET /admin/users/:id/activity`
- `GET /admin/events`
- `GET /admin/modules/usage`
- `GET /admin/retention`
- `GET /admin/errors`

No devuelven `password_hash`, refresh tokens, secretos ni IP plana.

## Limpieza De Smoke Local

El script `db:cleanup:smoke` elimina solo datos de prueba conocidos y falla si `APP_ENV=production` o `NODE_ENV=production`.

```powershell
cd apps/api
$env:DATABASE_URL='postgres://postgres:postgres@localhost:55432/data_trade'
npm run db:cleanup:smoke
```

Protege siempre:

```text
admin@datatrade.local
```

Patrones de usuarios smoke:

```text
agent-browser-smoke-%@datatrade.local
admin-smoke-%@datatrade.local
normal-phase%@datatrade.local
admin-phase%@datatrade.local
smoke-phase%@datatrade.local
phase2-%@datatrade.local
phase3-%@datatrade.local
admin-[numeros]@datatrade.local
```

## Schema

Tablas principales en `data_trade`:

- `users`
- `organizations`
- `memberships`
- `roles`
- `auth_sessions`
- `auth_accounts`
- `modules`
- `user_module_access`
- `projects`
- `palletizer_runs`
- `map_sessions`
- `search_queries`
- `uploaded_files`
- `data_sources`
- `events`
- `audit_logs`
- `admin_notes`
- `user_flags`

Modulos base:

- `sislope`
- `adex_palletizer`
- `data_trade_analytics`
- `alvin`
- `admin`
- `api`

## CORS

`FRONTEND_ORIGINS` debe listar origenes exactos separados por coma. No usar wildcard.

Ejemplo:

```text
FRONTEND_ORIGINS=http://localhost:5173,http://localhost:5174,https://adex-palletizer.vercel.app,https://sis-lo-pe.vercel.app
```

## Frontends

Estado actual:

- ADEX Palletizer usa este API como proveedor principal si `VITE_DATA_TRADE_API_URL` esta configurado.
- SisLoPe mantiene su login visual propio. La convergencia correcta es que ese login use este API por debajo, igual que ADEX, y que la navegacion ADEX -> SisLoPe use `/auth/handoff/create` y `/auth/handoff/exchange` sin exponer credenciales ni tokens en URL.
- ALVIN aun no usa auth Data Trade; se integra por contratos JSON.

El API no implica crear una "cuenta Data Trade" visible. La cuenta es la misma del ecosistema y cada frontend conserva su experiencia propia.

## Validacion

```powershell
npm run build
npm run test
$env:DATABASE_URL='postgres://postgres:postgres@localhost:55432/data_trade'
npm run db:verify
```
