# Data Trade Auth and SSO Plan

## Estado actual

ADEX tiene auth real sobre PostgreSQL con cookies `HttpOnly`. SisLoPe tiene una copia de esa logica como Vercel Functions. En dominios separados de Vercel no existe cookie compartida limpia.

## Recomendacion

Centralizar auth en `apps/api` y usar dominio comun:

```text
app.datatrade.pe
palletizer.datatrade.pe
sislope.datatrade.pe
api.datatrade.pe
```

Con ese esquema, la cookie puede usar `Domain=.datatrade.pe`, `HttpOnly`, `Secure`, `SameSite=Lax`.

Fase 2 implementa primero Bearer tokens porque ADEX y SisLoPe siguen en dominios Vercel separados. Esto evita asumir cookie compartida entre hosts `*.vercel.app`.

## Si continuan dominios Vercel separados

Usar identidad centralizada con flujo de login redirigido o token por app. No asumir que `sis-lo-pe.vercel.app` y `adex-palletizer.vercel.app` comparten cookie.

## Variables

- `DATABASE_URL`
- `FRONTEND_ORIGINS`
- `AUTH_COOKIE_NAME`
- `AUTH_COOKIE_DOMAIN`
- `AUTH_COOKIE_SECURE`
- `SESSION_TTL_DAYS`
- `IP_HASH_SECRET`
- `AUTH_ACCESS_TOKEN_SECRET`
- `AUTH_ACCESS_TOKEN_TTL_SECONDS`
- `AUTH_RATE_LIMIT_MAX`
- `AUTH_RATE_LIMIT_WINDOW_MS`
- `DATA_TRADE_ADMIN_EMAIL`
- `DATA_TRADE_ADMIN_PASSWORD`
- `DATA_TRADE_ADMIN_NAME`

## Bootstrap admin

No crear `admin/admin`. El primer admin se crea con `npm run db:seed:admin`, leyendo `DATA_TRADE_ADMIN_EMAIL`, `DATA_TRADE_ADMIN_PASSWORD` y `DATA_TRADE_ADMIN_NAME`. El password se recibe por variable de entorno, se hashea con bcrypt y no se imprime. El seed es idempotente y auditable.

## Migracion

1. Crear tablas `users`, `roles`, `memberships`, `auth_accounts`, `auth_sessions`.
2. Implementar endpoints centrales `/auth/*` con Bearer tokens.
3. Migrar usuarios legacy desde `usuarios` a `users`.
4. Hacer que ADEX y SisLoPe consulten `apps/api`.
5. Retirar copias de auth por app cuando haya paridad.

## Estado Fase 2

Implementado en `apps/api`:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/refresh`
- `GET /auth/me`
- `GET /auth/modules`
- `GET /auth/session`

`POST /events/track` sigue aceptando `anonymousId`; si llega Bearer token valido asocia `user_id` automaticamente.

## Estado Actual ADEX

Data Trade Auth es el proveedor central invisible para el login normal de ADEX
cuando `VITE_DATA_TRADE_API_URL` esta configurado:

- `VITE_DATA_TRADE_API_URL` apunta al backend comun.
- `VITE_DATA_TRADE_TRACKING_ENABLED` controla tracking.
- `VITE_DATA_TRADE_ADMIN_DASHBOARD_ENABLED` controla el dashboard admin post-login.
- `VITE_DATA_TRADE_MODULE_CODE` identifica `adex_palletizer` o `sislope`.
- `VITE_ADEX_LEGACY_AUTH_FALLBACK=true` habilita rollback legacy temporal.

El access token y refresh token Data Trade viven en memoria. El refresh no se
guarda en `localStorage`. El paso siguiente, cuando exista dominio comun, es
mover refresh a cookie `HttpOnly`, `Secure`, `SameSite=Lax`,
`Domain=.datatrade.pe`.
