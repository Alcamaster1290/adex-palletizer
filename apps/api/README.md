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
npm run dev
```

Probar endpoints:

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8788/health"
Invoke-RestMethod -Uri "http://127.0.0.1:8788/ready"

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

## Variables

Ver `.env.example`. En produccion `IP_HASH_SECRET` debe estar definido, ser largo y no compartirse entre ambientes.

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

El bootstrap de admin por variable de entorno queda para Fase 2 junto con auth comun. No debe implementarse login parcial en esta fase.
