# Data Trade API

Backend comun para identidad, sesiones, modulos, eventos, metricas y dashboard admin del ecosistema Data Trade.

Produccion: https://data-trade-api-production.up.railway.app

## Lugar En Data Trade

```text
data-trade/
|-- apps/
|   `-- api/                   <- ESTE SERVICIO (Fastify 5 + Drizzle + PostgreSQL)
|                              Deploy: data-trade-api-production.up.railway.app
|-- adex-palletizer-web/       Cliente principal hoy (Vercel: adex-palletizer.vercel.app)
|-- SistemaLogisticoPeruano/
|   `-- SisLoPe/               Convergencia esperada (Vercel: sis-lo-pe.vercel.app)
|                              Tiene su propio servicio "maritime-api" (dominio maritimo)
|-- alvin/                     Aun no integrado a Auth (Streamlit: alvin-comex.streamlit.app)
|-- contracts/                 Contratos JSON entre modulos
`-- docs/                      Arquitectura y planes
```

Consumidores actuales:

- **adex-palletizer-web** (Vercel): usa este API con `VITE_DATA_TRADE_API_URL` para `/auth/*`, `/auth/handoff/create` y `/events/track`.
- **SisLoPe** (Vercel): debe converger a usar este API por debajo de su login propio y aceptar handoff desde ADEX por `/auth/handoff/exchange`.
- **ALVIN** (Streamlit): no consume Auth por ahora. Se integra por contratos JSON (`contracts/`).
- **maritime-api** (dentro de SisLoPe): servicio de dominio maritimo, no es un segundo backend Data Trade.

## Estado Actual

- Runtime: Fastify 5 sobre Node.js 20+ (Railway corre Node 24).
- Base de datos: PostgreSQL con schema dedicado `data_trade`.
- ORM: Drizzle.
- Migraciones: SQL versionado en `src/db/migrations`, registradas en `data_trade.schema_migrations`.
- Boot en produccion: `npm start` corre `migrate.js && seedAdmin.js && server.js` secuencialmente. Las migrations son idempotentes (skip si ya aplicadas). El seed admin es idempotente (upsert por email).
- Auth: email + password (`bcryptjs` cost 12), access token Bearer corto y refresh token aleatorio hasheado HMAC-SHA-256 en DB.
- Handoff SSO: codigos temporales de un solo uso para navegar entre modulos sin exponer credenciales en URL.
- Tracking: `POST /events/track` con metadata sanitizada e IP hasheada.
- Admin: endpoints read-only protegidos por rol `admin`.
- Limpieza local: script dev-only para usuarios y eventos smoke.

## Desarrollo Local En Windows

```powershell
cd apps/api
npm install
npm run docker:db:up
$env:DATABASE_URL='postgres://postgres:postgres@localhost:55432/data_trade'
$env:IP_HASH_SECRET='clave-local-larga'
$env:AUTH_ACCESS_TOKEN_SECRET='clave-local-larga-32-chars-min'
$env:AUTH_REFRESH_TOKEN_SECRET='otra-clave-local-larga-32-chars'
$env:DATA_TRADE_ADMIN_EMAIL='admin@datatrade.local'
$env:DATA_TRADE_ADMIN_PASSWORD='ADEXPERU2026'
$env:DATA_TRADE_ADMIN_NAME='Data Trade Admin'
$env:FRONTEND_ORIGINS='http://localhost:5173,http://localhost:5174'
npm run db:migrate
npm run db:verify
npm run db:seed:admin
npm run dev
```

Endpoints base:

```powershell
Invoke-RestMethod http://localhost:8788/health
Invoke-RestMethod http://localhost:8788/ready
```

`/health` valida que el server esta vivo; `/ready` valida que tambien puede pegarle a Postgres.

## Scripts

```powershell
npm run dev               # tsx watch (dev local)
npm run build             # tsc + copia .sql a dist/db/migrations
npm run start             # migrate.js && seedAdmin.js && server.js (boot de produccion)
npm run test              # vitest run
npm run db:generate       # drizzle-kit generate (cuando cambia schema)
npm run db:migrate        # corre migrations contra DATABASE_URL
npm run db:verify         # verifica que las tablas existen
npm run db:seed:admin     # crea o verifica el admin segun DATA_TRADE_ADMIN_*
npm run db:cleanup:smoke  # borra usuarios smoke (solo dev)
npm run docker:db:up      # levanta Postgres local en :55432
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
- Refresh token aleatorio; solo se guarda HMAC-SHA-256 con `AUTH_REFRESH_TOKEN_SECRET`. El token plano se devuelve una sola vez al cliente.
- Refresh token rota en cada `POST /auth/refresh`.
- Logout revoca la sesion (marca `revoked_at`).
- Rate limit in-memory para register/login/refresh.
- En produccion, secretos debiles (`AUTH_ACCESS_TOKEN_SECRET`, `AUTH_REFRESH_TOKEN_SECRET`, `IP_HASH_SECRET`) hacen fallar el arranque.

Nota: evaluar migrar a `argon2id` cuando el runtime lo soporte sin overhead inaceptable.

### Handoff Entre Modulos

`POST /auth/handoff/create` requiere `Authorization: Bearer <accessToken>` y body:

```json
{ "targetModule": "sislope" }
```

Devuelve un `handoffCode` valido por 60 segundos. En PostgreSQL se guarda solo un HMAC del codigo, nunca el valor plano.

`POST /auth/handoff/exchange` recibe:

```json
{ "code": "codigo-temporal", "targetModule": "sislope" }
```

Valida expiracion, uso unico, modulo destino y acceso del usuario. Si todo pasa, marca el codigo como usado y crea una sesion normal con `accessToken`, `refreshToken`, `user`, `session` y `modules`.

## Tracking

Endpoint: `POST /events/track`

Eventos validos (whitelist en `src/events.ts`):

- `user_signed_up`
- `user_logged_in`
- `module_opened`
- `palletizer_calculation_created`
- `map_layer_toggled`
- `search_performed`
- `file_uploaded`
- `export_generated`
- `api_error`
- `session_started`
- `session_ended`

Reglas:

- Si llega Bearer valido, se asocia `user_id` automaticamente.
- Si no hay sesion, debe llegar `anonymousId` en el body.
- No se acepta `metadata.user_id` ni `metadata.userId` (impedir spoofing).
- No se guarda IP plana; solo `ip_hash` derivado con HMAC.
- Metadata limitada por tamano (`EVENT_METADATA_MAX_BYTES`), profundidad y largo de strings/arrays.

## Admin

Endpoints protegidos por Bearer + rol `admin`:

- `GET /admin/metrics/overview`
- `GET /admin/users`
- `GET /admin/users/:id/activity`
- `GET /admin/events`
- `GET /admin/modules/usage`
- `GET /admin/retention`
- `GET /admin/errors`

Las responses no devuelven `password_hash`, refresh tokens, secretos ni IPs planas.

## Limpieza De Smoke Local

`db:cleanup:smoke` elimina solo datos de prueba conocidos. Falla por seguridad si detecta `APP_ENV=production` o `NODE_ENV=production`.

```powershell
cd apps/api
$env:DATABASE_URL='postgres://postgres:postgres@localhost:55432/data_trade'
npm run db:cleanup:smoke
```

Protege siempre `admin@datatrade.local`. Patrones de usuarios smoke considerados borrables:

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

## Schema PostgreSQL

Tablas en el schema `data_trade`:

| Tabla | Rol |
| --- | --- |
| `users` | Cuentas de usuario (email, username, display name, status). |
| `auth_accounts` | Credenciales por provider (`credentials` para password). |
| `auth_sessions` | Sesiones activas con refresh token hasheado. |
| `auth_handoff_codes` | Codigos temporales para SSO entre modulos. |
| `organizations` | Organizaciones (multitenant ready). |
| `memberships` | Relacion user-organization-role. |
| `roles` | Catalogo de roles: `admin`, `owner`, `analyst`, `viewer`. |
| `modules` | Catalogo de modulos: `sislope`, `adex_palletizer`, `data_trade_analytics`, `alvin`, `admin`, `api`. |
| `user_module_access` | Acceso por usuario y modulo (`access_level`: `user`, `manager`, `admin`). |
| `projects` | Casos/proyectos por modulo. |
| `palletizer_runs` | Calculos del Palletizer (input + result). |
| `map_sessions` | Sesiones de mapa de SisLoPe. |
| `search_queries` | Busquedas registradas. |
| `uploaded_files` | Archivos subidos por usuarios. |
| `data_sources` | Fuentes de datos integradas. |
| `events` | Telemetria via `/events/track`. |
| `audit_logs` | Audit log de acciones admin. |
| `admin_notes` | Notas internas del admin sobre usuarios. |
| `user_flags` | Feature flags por usuario. |
| `schema_migrations` | Migraciones aplicadas (usada por `db:migrate`). |

Modulos seed:

- `sislope`, `adex_palletizer`, `data_trade_analytics`, `alvin`, `admin`, `api`.

Detalle completo: `docs/DATA_TRADE_POSTGRES_SCHEMA.md`.

## CORS

`FRONTEND_ORIGINS` debe listar origenes exactos separados por coma. No usar wildcards.

Ejemplo produccion:

```text
FRONTEND_ORIGINS=https://adex-palletizer.vercel.app,https://sis-lo-pe.vercel.app
```

Si hay preview deploys de Vercel que deben funcionar contra produccion, agregar tambien `https://adex-palletizer-git-main-alcamaster1290s-projects.vercel.app` (o el alias estable correspondiente).

Una request con `Origin` que no este en la lista recibe `500 ORIGIN_NOT_ALLOWED` y el preflight CORS falla.

## Despliegue En Railway

Servicio: `data-trade-api` en el proyecto Data Trade.

- Build command: `npm run build` (corre `tsc` y copia `.sql` a `dist/`).
- Start command: `npm start` (`migrate.js && seedAdmin.js && server.js`).
- Auto-deploy: branch `main`.

Variables requeridas:

```text
DATABASE_URL=${{Postgres.DATABASE_URL}}    # referencia, no texto plano
NODE_ENV=production
APP_ENV=production
HOST=0.0.0.0
LOG_LEVEL=info

AUTH_ACCESS_TOKEN_SECRET=<32+ chars random>
AUTH_REFRESH_TOKEN_SECRET=<32+ chars random, distinto del access>
AUTH_ACCESS_TOKEN_TTL_SECONDS=900
AUTH_RATE_LIMIT_MAX=10
AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTH_COOKIE_SECURE=true

IP_HASH_SECRET=<32+ chars random>
SESSION_TTL_DAYS=30

EVENT_METADATA_MAX_BYTES=8192
EVENT_RATE_LIMIT_MAX=120
EVENT_RATE_LIMIT_WINDOW_MS=60000
REQUEST_BODY_LIMIT_BYTES=65536

DATA_TRADE_ADMIN_EMAIL=<email del admin bootstrap>
DATA_TRADE_ADMIN_PASSWORD=<password fuerte>
DATA_TRADE_ADMIN_NAME=Data Trade Admin

FRONTEND_ORIGINS=https://adex-palletizer.vercel.app,https://sis-lo-pe.vercel.app
```

Notas:

- `DATABASE_URL` debe ser **referencia** a `Postgres.DATABASE_URL`. Si la pones como texto plano, rotar credenciales de Postgres deja el API stale.
- Al recrear el servicio Postgres, Railway regenera la password y todas las referencias se actualizan automaticamente. El boot del API recorre migrations idempotentes y vuelve a quedar healthy.
- Los secretos `AUTH_*_SECRET` y `IP_HASH_SECRET` deben ser random reales de 32+ caracteres y diferentes entre si. Valores placeholder (`"otra-clave-larga..."`) son rechazados en boot bajo `APP_ENV=production`.

Verificacion post-deploy:

```bash
curl https://data-trade-api-production.up.railway.app/health
# { "status": "ok", ... }

curl https://data-trade-api-production.up.railway.app/ready
# { "status": "ok", "database": "ok", ... }
```

## Validacion

```powershell
npm run build
npm run test
$env:DATABASE_URL='postgres://postgres:postgres@localhost:55432/data_trade'
npm run db:verify
```
