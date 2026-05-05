# Data Trade Phase 1.5 Hardening

Fecha: 2026-05-04

## Objetivo

Validar y endurecer `apps/api` antes de iniciar Fase 2 de autenticacion comun. Esta fase mantiene SisLoPe y ADEX Palletizer sin cambios productivos y se concentra en que el backend comun pueda operar contra PostgreSQL real con migraciones verificables.

## Alcance

- Backend `apps/api`.
- Migraciones PostgreSQL en schema `data_trade`.
- Endpoint `GET /health`.
- Endpoint `GET /ready`.
- Endpoint `POST /events/track`.
- Documentacion local para Windows PowerShell.

No se implementa login completo ni se conectan todavia las SPAs productivas.

## Estado de rama

La rama de trabajo es `data-trade-phase-1`. Debe existir en remoto como `origin/data-trade-phase-1`. No se debe hacer merge a `main` durante esta fase.

## PostgreSQL local

Se agrega `apps/api/docker-compose.yml` con:

- PostgreSQL 16 Alpine.
- Puerto host `55432` hacia `5432`.
- DB local `data_trade`.
- Usuario local `postgres`.
- Volumen persistente `data_trade_api_postgres`.
- Healthcheck con `pg_isready`.

Variable local:

```powershell
$env:DATABASE_URL = "postgres://postgres:postgres@localhost:55432/data_trade"
```

## Migraciones

La migracion inicial:

- Crea extension `pgcrypto`.
- Crea schema `data_trade`.
- Crea tablas core de identidad, modulos, proyectos, eventos, auditoria y objetos logisticos.
- Siembra roles `admin`, `owner`, `analyst`, `viewer`.
- Siembra modulos `sislope`, `adex_palletizer`, `data_trade_analytics`, `alvin`, `admin`, `api`.
- Registra migraciones aplicadas en `data_trade.schema_migrations`.

El comando `npm run db:verify` valida:

- Existencia de schema `data_trade`.
- Existencia de tablas obligatorias.
- Columnas `jsonb` criticas.
- Cantidad minima de indices.
- Colisiones de nombres con tablas en `public`.

## Endurecimiento de tracking

`POST /events/track` queda con controles minimos:

- `bodyLimit` configurable por `REQUEST_BODY_LIMIT_BYTES`.
- Zod estricto y rechazo de campos extra.
- `module` restringido a whitelist.
- `eventName` restringido a whitelist.
- `metadata` saneado por profundidad, numero de claves, largo de strings y largo de arrays.
- `metadata` limitado por `EVENT_METADATA_MAX_BYTES`.
- Rate limit in-memory por `anonymousId`, `userId` o hash de IP.
- IP plana no persistida; se guarda HMAC en `ip_hash`.
- CORS configurable por `FRONTEND_ORIGINS`.
- No se agregan logs de payloads ni secretos.

## Modelo de errores

Todos los errores controlados responden:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request payload failed validation.",
    "requestId": "request-id",
    "timestamp": "2026-05-04T00:00:00.000Z"
  }
}
```

Cada request recibe o propaga `x-request-id`.

## Pruebas

Pruebas unitarias obligatorias:

- `GET /health` funciona sin DB.
- `GET /ready` falla si DB no esta disponible.
- `GET /ready` pasa si la integracion con DB real esta habilitada.
- Evento valido aceptado.
- Evento invalido rechazado.
- Metadata excesiva rechazada.
- Modulo desconocido rechazado.
- Evento desconocido rechazado.
- Body demasiado grande rechazado.
- IP hash no expone la IP original.
- Rate limit basico aplicado.
- Error 404 uniforme.

La prueba con DB real usa `TEST_DATABASE_URL` y se omite si la variable no existe.

## Comandos Windows PowerShell

```powershell
cd "C:\Users\Alvaro\Proyectos\Data Trade\apps\api"
npm install
npm run docker:db:up
$env:DATABASE_URL = "postgres://postgres:postgres@localhost:55432/data_trade"
npm run db:migrate
npm run db:verify
npm run build
npm run test
```

Probar API local:

```powershell
$env:IP_HASH_SECRET = "replace-with-32-byte-local-dev-secret"
npm run dev

Invoke-RestMethod -Uri "http://127.0.0.1:8788/health"
Invoke-RestMethod -Uri "http://127.0.0.1:8788/ready"

$body = @{
  anonymousId = "phase-1-5-smoke"
  module = "api"
  eventName = "module_opened"
  path = "/phase-1-5"
  metadata = @{ phase = "1.5" }
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8788/events/track" -ContentType "application/json" -Body $body
```

## Admin bootstrap

Se revisa la necesidad de seed inicial de admin, pero no se implementa login completo en Fase 1.5. La recomendacion para Fase 2 es:

- Crear comando o migracion idempotente de bootstrap usando `ADMIN_BOOTSTRAP_EMAIL`.
- Exigir `ADMIN_BOOTSTRAP_PASSWORD_HASH` ya hasheado, nunca password plano.
- Insertar usuario admin solo si no existe ningun admin activo.
- Registrar la accion en `audit_logs`.
- Bloquear bootstrap en produccion si falta secreto fuerte o si ya existe admin.

## Criterios de salida

- `npm run build` pasa.
- `npm run test` pasa.
- Migraciones aplican en DB limpia.
- `npm run db:verify` valida schema, tablas, indices y JSONB.
- `GET /health` responde.
- `GET /ready` valida DB real.
- `POST /events/track` inserta evento real en `data_trade.events`.
- No se guardan secretos ni `node_modules` en git.

## Resultado de validacion local

Validado en Windows PowerShell el 2026-05-04 contra PostgreSQL local por Docker:

- Docker PostgreSQL 16 en `localhost:55432`.
- `npm run db:migrate` aplico `0000_initial_data_trade.sql` en DB limpia.
- Segunda ejecucion de `npm run db:migrate` omitio la migracion ya aplicada.
- `npm run db:verify` confirmo 19 tablas, 9 columnas JSONB criticas verificadas por el script y 62 indices.
- Consulta directa a PostgreSQL confirmo 19 tablas en `data_trade` y 0 colisiones con tablas Data Trade en `public`.
- Consulta directa a PostgreSQL confirmo 15 columnas JSONB totales.
- Consulta directa a PostgreSQL confirmo 60 constraints.
- Consulta directa a PostgreSQL confirmo 6 modulos seed activos.
- `GET /health`, `GET /ready` y `POST /events/track` respondieron con el servidor compilado.
- El evento smoke quedo insertado en `data_trade.events` con `ip_hash` presente y sin contener `127.0.0.1`.
