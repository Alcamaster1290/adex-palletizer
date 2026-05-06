# Data Trade Auth Phase 2.5 Security Review

Fecha: 2026-05-04

## Alcance

Revision y endurecimiento de la auth comun en `apps/api` antes de conectar SisLoPe y ADEX Palletizer. No se conectan frontends productivos, no se modifica `alvin`, no se cierran PR #14 ni PR #15.

## Hallazgos

### Tokens

- Access token: Bearer firmado con HMAC SHA-256 y expiracion corta por `AUTH_ACCESS_TOKEN_TTL_SECONDS` (default 900 segundos).
- Refresh token: opaco, aleatorio y de alta entropia.
- Antes de Fase 2.5 el refresh token se guardaba como SHA-256 simple. Ahora se guarda como HMAC-SHA-256 usando `AUTH_REFRESH_TOKEN_SECRET`.
- Refresh ya rotaba token; se agregaron tests para reutilizacion despues de rotacion.
- Logout revoca sesion; se agregaron tests para refresh despues de logout.

### Secretos

- `AUTH_ACCESS_TOKEN_SECRET` viene de env.
- `AUTH_REFRESH_TOKEN_SECRET` viene de env.
- `IP_HASH_SECRET` viene de env.
- Si `APP_ENV=production` o `NODE_ENV=production`, la API falla al iniciar si falta un secreto fuerte.
- Secretos fuertes deben tener al menos 32 caracteres y no usar placeholders.
- No se loguean tokens, passwords ni secretos.

### Passwords

- Se usa `bcryptjs` con bcrypt cost 12.
- Decision: se mantiene `bcryptjs` porque no rompe build ni despliegue serverless.
- Nota de produccion: evaluar `argon2id` o `bcrypt` nativo si el runtime final lo permite.

### CORS

- CORS usa allowlist por `FRONTEND_ORIGINS`.
- No se permite wildcard `*` porque `credentials` esta habilitado.
- Origenes esperados:
  - `https://sis-lo-pe.vercel.app`
  - `https://adex-palletizer.vercel.app`
  - `https://app.datatrade.pe`
  - `https://palletizer.datatrade.pe`
- `https://api.datatrade.pe` es host de API; solo debe agregarse si sirve UI propia.
- Vercel preview solo se permite si el origen exacto esta explicitamente en env.

### Estrategia Frontend

- Estrategia inicial: `Authorization: Bearer`.
- Access token idealmente en memoria.
- Refresh token con manejo controlado; evitar `localStorage`.
- Si se acepta `localStorage` temporal durante migracion, se documenta como riesgo.
- Futuro: cookies `HttpOnly`, `Secure`, `SameSite=Lax` bajo dominio comun `.datatrade.pe`.

### Rate Limit

- Register/login/refresh usan `AUTH_RATE_LIMIT_MAX` y `AUTH_RATE_LIMIT_WINDOW_MS`.
- Default: 10 requests por 15 minutos por clave.
- Se agrego test de rate limit para refresh.
- Riesgo: rate limit in-memory solo sirve para una instancia. Produccion multi-instancia debe usar Redis, Postgres o WAF.

### Events Tracking

- Evento autenticado asocia `user_id` desde Bearer token valido.
- Evento anonimo sigue funcionando con `anonymousId`.
- No se acepta `userId` enviado por cliente sin Bearer valido.
- No se acepta `metadata.user_id` ni `metadata.userId`.
- Metadata sigue sanitizada.
- `ip_hash` usa HMAC y no expone IP plana.

### Permisos

- `GET /auth/modules` consulta `data_trade.user_module_access`.
- Usuario normal recibe solo modulos permitidos; no recibe `admin`.
- Admin bootstrap recibe `admin` y `api`.
- Se agregaron tests unitarios e integracion real para estos casos.

## Cambios Aplicados

- Nuevo `AUTH_REFRESH_TOKEN_SECRET`.
- Validacion de `APP_ENV=production` y secretos fuertes.
- Rechazo de wildcard en `FRONTEND_ORIGINS`.
- HMAC para hash de refresh token.
- Manejo defensivo de tokens Bearer malformados.
- Rechazo de metadata con campos de identidad.
- Tests de refresh rotation, refresh revocado, rate limit de refresh y permisos de modulos.

## Validacion Esperada

```powershell
cd "C:\Users\Alvaro\Proyectos\Data Trade\apps\api"
npm run build
npm run test
$env:DATABASE_URL='postgres://postgres:postgres@localhost:55432/data_trade'; npm run db:migrate
$env:DATABASE_URL='postgres://postgres:postgres@localhost:55432/data_trade'; npm run db:verify
npm audit --omit=dev
```

Smoke HTTP real:

- `GET /health`
- `GET /ready`
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `GET /auth/modules`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/refresh` con token revocado debe fallar
- `POST /events/track` autenticado
- `POST /events/track` anonimo

## Riesgos Pendientes

- Rate limit in-memory no es suficiente para Vercel/serverless multi-instancia.
- Falta migracion de usuarios legacy `public.usuarios`.
- Falta definir almacenamiento frontend exacto de refresh token durante la transicion.
- Falta cookie compartida cuando existan dominios `*.datatrade.pe`.
