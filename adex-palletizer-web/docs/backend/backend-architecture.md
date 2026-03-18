# Backend Architecture Blueprint

## Objetivo

Dejar definido un backend realista para `adex-palletizer-web` que cubra:

- autenticacion profesional con `identifier + password`
- recuperacion de contrasena
- sesiones seguras
- auditoria y analitica de acceso
- persistencia de escenarios, labels y exports

El frontend actual sigue funcionando sin backend. Esta documentacion define el siguiente sprint backend sin ambiguedad.

## Stack recomendado

### Runtime

- `Node.js 22`
- `TypeScript`

### API

- `Fastify`
- `@fastify/cookie`
- `@fastify/rate-limit`
- `zod` para validacion de contratos

### Datos

- `PostgreSQL`
- SQL versionado en `docs/database/*.sql`
- acceso con `pg` o `postgres` y repositorios propios

### Seguridad

- hash de password en backend:
  - bootstrap actual: `bcrypt` por compatibilidad con `001_auth_usuarios_postgres.sql`
  - objetivo recomendado: `argon2id` para nuevas contrasenas
- cookies `httpOnly`, `secure`, `sameSite=lax`
- refresh token persistido solo como hash

## Entidades principales

### Auth

- `usuarios`
- `auth_sessions`
- `auth_password_reset_tokens`
- `auth_audit_log`

### Negocio

- `scenarios`
- `scenario_versions`
- `sku_labels`
- `export_history`

## Flujo de autenticacion recomendado

### 1. Login

1. Usuario envia `identifier` y `password`.
2. API busca usuario activo por `username` o `email`.
3. Verifica hash.
4. Si es valido:
   - reinicia `failed_login_attempts`
   - actualiza `last_login_at`
   - crea `auth_sessions`
   - devuelve:
     - cookie de sesion segura `httpOnly`
     - metadatos de la sesion actual
5. Si `must_change_password = true`, la UI obliga a ir a cambio de contrasena.

### 2. Refresh de sesion

1. Cliente envia cookie con refresh token.
2. API valida hash del token contra `auth_sessions`.
3. Si la sesion sigue activa y no expiro:
   - rota el token de sesion
   - actualiza `last_seen_at`
   - devuelve la sesion renovada

### 3. Logout

1. API revoca la sesion actual.
2. Limpia cookie.
3. Registra evento en `auth_audit_log`.

### 4. Recuperar contrasena

1. Usuario solicita reset con `email`.
2. API genera token aleatorio de un solo uso.
3. Guarda solo `token_hash` en `auth_password_reset_tokens`.
4. Envia email con link temporal.
5. Al consumirlo:
   - se valida expiracion
   - se marca `used_at`
   - se actualiza password
   - se fuerza revocacion de sesiones activas

## Endpoints REST recomendados

## Auth

### `POST /api/auth/login`

Body:

```json
{
  "identifier": "admin",
  "password": "admin"
}
```

Response:

```json
{
  "user": {
    "id": "uuid",
    "email": "admin",
    "username": "admin",
    "role": "admin",
    "mustChangePassword": true
  }
}
```

### `POST /api/auth/refresh`

Usa cookie segura. Devuelve usuario y sesion renovada.

### `POST /api/auth/logout`

Revoca la sesion actual.

### `GET /api/auth/me`

Devuelve usuario autenticado actual y permisos basicos.

### `POST /api/auth/change-password`

Body:

```json
{
  "currentPassword": "admin",
  "newPassword": "NuevaClaveSegura123"
}
```

### `POST /api/auth/forgot-password`

Implementacion prevista para Sprint B2.

Body:

```json
{
  "email": "admin"
}
```

Respuesta neutra. No revelar si el email existe.

### `POST /api/auth/reset-password`

Body:

```json
{
  "token": "raw-reset-token",
  "newPassword": "NuevaClaveSegura123"
}
```

## Usuarios

### `GET /api/users`

Solo `admin`. Lista usuarios, estado y actividad reciente.

### `POST /api/users`

Crea usuario con rol y password temporal.

### `PATCH /api/users/:id`

Permite activar, bloquear, cambiar rol o forzar reset.

## Escenarios

### `GET /api/scenarios`

Lista escenarios del usuario autenticado.

### `POST /api/scenarios`

Body:

```json
{
  "name": "Exportacion cafe 20GP",
  "mode": "container",
  "input": {},
  "result": {},
  "labelsBySku": {}
}
```

### `GET /api/scenarios/:id`

Obtiene escenario y ultima version.

### `POST /api/scenarios/:id/versions`

Crea nueva version del escenario.

### `DELETE /api/scenarios/:id`

Archivado logico.

## Labels

### `GET /api/labels`

Lista labels por SKU del usuario.

### `PUT /api/labels/:skuId`

Guarda o actualiza configuracion de label por SKU.

## Exports y analitica

### `POST /api/exports`

Registra export ejecutado por la UI.

### `GET /api/audit/access-summary`

Solo `admin`. Devuelve resumen de accesos y actividad.

## Politicas recomendadas

### Passwords

- minimo 12 caracteres
- al menos una mayuscula, una minuscula y un numero
- el usuario `admin/admin` debe existir solo como bootstrap y con `must_change_password = true`

### Rate limiting

- `POST /api/auth/login`: 5 intentos por 15 minutos por IP + identifier
- `POST /api/auth/forgot-password`: 3 intentos por hora por email

### Auditoria minima

Eventos obligatorios:

- `auth.login.success`
- `auth.login.failure`
- `auth.logout`
- `auth.password.change`
- `auth.password.reset.requested`
- `auth.password.reset.completed`
- `scenario.created`
- `scenario.updated`
- `scenario.exported`

## Integracion con frontend actual

### Fase 1

- mantener `localStorage` como fallback
- si backend esta disponible:
  - `scenarios`
  - `sku labels`
  - `export history`
  se persisten por API

### Fase 2

- mover `localStorage` a cache secundaria
- requerir login para guardar y compartir trabajo persistido

## Roadmap por sprints

### Sprint B1 - Auth base

- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/refresh`
- `GET /auth/me`
- `POST /auth/change-password`
- middleware de roles

### Sprint B2 - Recuperacion de contrasena

- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- email transaccional
- invalidacion de sesiones despues de reset

### Sprint B3 - Escenarios persistidos

- CRUD de `scenarios`
- versionado con `scenario_versions`
- migracion progresiva desde `localStorage`

### Sprint B4 - Labels y exports

- persistencia backend de `sku_labels`
- registro en `export_history`
- analitica de uso

### Sprint B5 - Hardening

- rate limiting
- auditoria completa
- dashboard admin basico
- rotacion/invalidez de sesiones

## Riesgos y mitigaciones

### Riesgo: mezclar auth real con frontend sin backend estable

Mitigacion:

- implementar API primero
- no simular auth en frontend

### Riesgo: guardar data URLs grandes en PostgreSQL

Mitigacion:

- aceptable en MVP
- planificar migracion a object storage en una segunda fase

### Riesgo: token reset o refresh almacenado en claro

Mitigacion:

- guardar solo hash
- token raw solo vive en email/cookie

## Archivos base ya preparados

- `docs/database/001_auth_usuarios_postgres.sql`
- `docs/database/002_backend_foundation_postgres.sql`

Estos dos archivos dejan listo el contrato de datos inicial para empezar el backend real.
