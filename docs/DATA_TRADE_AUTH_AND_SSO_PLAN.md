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
- `ADMIN_BOOTSTRAP_EMAIL`
- `ADMIN_BOOTSTRAP_PASSWORD_HASH`

## Bootstrap admin

No crear `admin/admin`. El primer admin debe provenir de variables de entorno o seed seguro con password ya hasheado. El seed debe ser idempotente y auditable.

## Migracion

1. Crear tablas `users`, `roles`, `memberships`, `auth_accounts`, `auth_sessions`.
2. Migrar usuarios legacy desde `usuarios` a `users`.
3. Hacer que ADEX y SisLoPe consulten `apps/api`.
4. Retirar copias de auth por app cuando haya paridad.
