# Data Trade

Workspace de convergencia para herramientas internas de logistica, comercio exterior y analisis de datos. La idea no es construir una app paralela, sino tener un backend comun (`apps/api`) que provea identidad, sesiones, modulos, eventos, metricas y trazabilidad para los frontends que ya existen (ADEX Palletizer, SisLoPe, ALVIN).

Este README documenta el ecosistema completo. Cada subproyecto tiene su propio README con detalles internos.

## Estado Actual

| Proyecto | Estado | Rol | Despliegue |
| --- | --- | --- | --- |
| `apps/api` | Activo | Backend comun Fastify + PostgreSQL schema `data_trade`. Identidad, eventos, metricas, admin. | Railway: `data-trade-api-production.up.railway.app` |
| `adex-palletizer-web` | Activo | SPA React/Vite de palletizacion 3D. Primer frontend integrado a Data Trade Auth. | Vercel: `adex-palletizer.vercel.app` |
| `SistemaLogisticoPeruano/SisLoPe` | Repo anidado | SPA geoespacial con mapa, capas, rutas y modulo maritimo. Convergencia pendiente a Data Trade Auth. | Vercel: `sis-lo-pe.vercel.app` |
| `SistemaLogisticoPeruano/SisLoPe/services/maritime-api` | Servicio separado | Backend de dominio maritimo (Fastify + Drizzle + Postgres) para tracking y heatmap. | Dentro de SisLoPe |
| `alvin` | Repo anidado | Streamlit/Python para costos COMEX. Integrado por contratos JSON, sin auth Data Trade aun. | Streamlit Cloud: `alvin-comex.streamlit.app` |
| `contracts` | Activo | Schemas JSON versionados (`trade-case.v1`, `trade-costs.v1`). | En repo |
| `docs` | Activo | Arquitectura, runbook local, planes y archivo historico de fases. | En repo |

## Estructura Del Sistema

```text
data-trade/
|-- apps/
|   `-- api/                          Backend comun Fastify + PostgreSQL schema "data_trade"
|                                     Deploy: data-trade-api-production.up.railway.app
|-- adex-palletizer-web/              SPA React/Vite - ADEX Palletizer (frontend activo)
|                                     Deploy: adex-palletizer.vercel.app
|-- SistemaLogisticoPeruano/
|   `-- SisLoPe/                      Repo anidado - SPA logistica geoespacial
|                                     Deploy: sis-lo-pe.vercel.app
|-- alvin/                            Repo anidado - Streamlit costos COMEX
|                                     Deploy: alvin-comex.streamlit.app
|-- contracts/                        Contratos JSON versionados
`-- docs/                             Arquitectura, runbook, planes, archivo historico
```

Flujo de identidad y datos:

```text
                  +------------------+
                  |   apps/api       |  identidad, sesiones, modulos
                  |  (Railway)       |  eventos, metricas, admin
                  +---------+--------+
                            ^
              /auth/* y /events/track (Bearer)
                            |
        +-------------------+--------------------+
        |                   |                    |
        v                   v                    v
+----------------+  +-----------------+  +-----------------+
| adex-palletizer|  |     SisLoPe     |  |      ALVIN      |
| (Vercel)       |  |    (Vercel)     |  | (Streamlit)     |
+--------+-------+  +--------+--------+  +-----------------+
         |                   ^                    ^
         |                   |                    |
         +-- handoff/create  |                    |
         |   handoff/exchange|                    |
         |                                        |
         +--------- trade-case.v1 / trade-costs.v1 (contracts/)
```

Reglas estructurales:

- `alvin/` y `SistemaLogisticoPeruano/SisLoPe/` son repos git anidados; viven en disco dentro de este workspace pero mantienen su propio historial y deploy.
- Solo `adex-palletizer-web`, `apps/api` y `contracts` se versionan dentro de este repo principal.
- El backend comun es uno solo (`apps/api`). `maritime-api` dentro de SisLoPe es un servicio de dominio maritimo, no reemplaza al backend Data Trade.
- Toda integracion entre modulos pasa por `apps/api` (identidad/eventos) o por `contracts/` (datos de negocio).

## Funcionalidades Por Proyecto

### ADEX Palletizer

- Calculo de unitarizacion caja/pallet/contenedor.
- Modos `Caja unica`, `Multiples cajas` y contenedores `20 GP`, `40 GP`, `40 HC` o custom.
- Visualizacion 3D con presets de pallet, skin de caja o saco warehouse y fallback geometrico.
- Label Designer por SKU y escenarios guardados en `localStorage`.
- Share links y exports JSON/PNG.
- Export de `trade-case.v1` para ALVIN, SisLoPe o futuros ETL.
- Login visible unico de ADEX. Auth real corre por debajo contra Data Trade API cuando `VITE_DATA_TRADE_API_URL` esta configurado.
- Dashboard admin accesible desde el menu de perfil para usuarios con acceso al modulo `admin`.

### SisLoPe

- Mapa logistico con capas geoespaciales, nodos, rutas, filtros y busqueda.
- Datos logisticos del Peru y capas operativas internas.
- `maritime-api` separado para tracking maritimo y heatmap diario.
- Login visual propio (no se reemplaza). La convergencia esperada es que ese login use Data Trade Auth por debajo y acepte handoffs entrantes desde ADEX.

### ALVIN

- Expediente de costos de importacion y exportacion.
- Factura comercial, configuracion de tasas, tributos aduaneros, gastos, prorrateo por producto y precio de venta.
- Dashboard con KPIs, graficos y export Excel/JSON.
- Motor numerico con `decimal.Decimal`.
- Hoy se integra al ecosistema solo por contratos JSON (`trade-case.v1`, `trade-costs.v1`). Integracion futura a Data Trade Auth queda como opcion abierta.

### maritime-api

- Read models maritimos para SisLoPe.
- Tracking por embarque/buque y heatmap diario maritimo/fluvial.
- Workers para sincronizar fuentes agregadas, sin consultar AIS desde requests de usuario.
- Servicio de dominio maritimo; no reemplaza a `apps/api`.

## Desarrollo Local

Para correr todo localmente en Windows con PowerShell.

### Backend (`apps/api`)

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

API queda en `http://localhost:8788`. Health: `/health`. Ready: `/ready`.

### Frontend (`adex-palletizer-web`)

```powershell
cd adex-palletizer-web
npm install
npm run dev -- --force
```

`.env.local` recomendado para apuntar al backend local:

```text
VITE_DATA_TRADE_API_URL=http://localhost:8788
VITE_DATA_TRADE_TRACKING_ENABLED=true
VITE_DATA_TRADE_MODULE_CODE=adex_palletizer
VITE_DATA_TRADE_ADMIN_DASHBOARD_ENABLED=true
VITE_ADEX_LEGACY_AUTH_FALLBACK=false
VITE_SISLOPE_URL=https://sis-lo-pe.vercel.app
```

Frontend en `http://localhost:5173`. Login admin: `admin@datatrade.local` / `ADEXPERU2026`.

## Despliegue En Produccion

### Frontend en Vercel

- Proyecto: `adex-palletizer` (team `alcamaster1290s-projects`).
- Root directory: `adex-palletizer-web/`.
- Framework: Vite.
- Auto-deploy: branch `main` de este repo.
- Variables de entorno (Environment: Production):

```text
VITE_DATA_TRADE_API_URL=https://data-trade-api-production.up.railway.app
VITE_DATA_TRADE_TRACKING_ENABLED=true
VITE_DATA_TRADE_MODULE_CODE=adex_palletizer
VITE_DATA_TRADE_ADMIN_DASHBOARD_ENABLED=true
VITE_ADEX_LEGACY_AUTH_FALLBACK=false
VITE_SISLOPE_URL=https://sis-lo-pe.vercel.app
```

Al agregar variables via CLI usar `printf "valor"` (no `echo "valor"`) para evitar trailing newline. El frontend tolera whitespace en flags booleanos desde el fix de `parseBooleanFlag`, pero las URLs deben venir limpias.

### Backend en Railway

- Proyecto: Data Trade.
- Servicio `data-trade-api`: Node 24, comando `npm start` (corre `migrate.js && seedAdmin.js && server.js` en boot).
- Servicio `Postgres`: PostgreSQL administrado por Railway.
- Variables de entorno (en `data-trade-api`):

```text
DATABASE_URL=${{Postgres.DATABASE_URL}}      # referencia, no texto plano
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

DATA_TRADE_ADMIN_EMAIL=<email del admin>
DATA_TRADE_ADMIN_PASSWORD=<password fuerte>
DATA_TRADE_ADMIN_NAME=Data Trade Admin

FRONTEND_ORIGINS=https://adex-palletizer.vercel.app,https://sis-lo-pe.vercel.app
```

Notas operativas:

- `npm start` corre migrations y seed admin antes del server. Es idempotente: si las tablas existen las salta, si el admin existe lo verifica y mantiene su acceso.
- La `DATABASE_URL` debe ser una **referencia** a `Postgres.DATABASE_URL`. Si se pone texto plano queda stale al rotar credenciales.
- Si el Postgres se recrea, Railway regenera password y las referencias se actualizan automaticamente.
- CORS solo aplica a los dominios listados en `FRONTEND_ORIGINS` (sin wildcards).

## Limpieza Local

Para limpiar usuarios y eventos smoke en Postgres local sin borrar `admin@datatrade.local`:

```powershell
cd apps/api
$env:DATABASE_URL='postgres://postgres:postgres@localhost:55432/data_trade'
npm run db:cleanup:smoke
```

El script falla si detecta `APP_ENV=production` o `NODE_ENV=production`.

Para limpiar cache del frontend:

```powershell
cd adex-palletizer-web
Remove-Item -Recurse -Force .\node_modules\.vite -ErrorAction SilentlyContinue
npm run dev -- --force
```

## Documentacion

Documentos vivos:

- `docs/DATA_TRADE_ARCHITECTURE.md` — arquitectura en uso.
- `docs/DATA_TRADE_ARCHITECTURE_PLAN.md` — arquitectura objetivo.
- `docs/DATA_TRADE_LOCAL_RUNBOOK.md` — runbook de desarrollo local.
- `docs/DATA_TRADE_AUTH.md` — auth operativo (login, refresh, handoff).
- `docs/DATA_TRADE_AUTH_AND_SSO_PLAN.md` — plan de SSO entre modulos.
- `docs/DATA_TRADE_ADMIN_DASHBOARD_PLAN.md` — plan del dashboard admin.
- `docs/DATA_TRADE_FRONTEND_INTEGRATION_GUIDE.md` — guia para integrar nuevos frontends.
- `docs/DATA_TRADE_POSTGRES_SCHEMA.md` — schema PostgreSQL detallado.
- `docs/DATA_TRADE_MIGRATION_ROADMAP.md` — roadmap de migraciones.
- `docs/DATA_TRADE_AUDIT.md` — auditoria operativa del backend.
- `contracts/README.md` — contratos JSON entre modulos.
- `apps/api/README.md` — backend.
- `adex-palletizer-web/README.md` — frontend ADEX.
- `docs/archive/README.md` — fases historicas archivadas.

## Reglas Operativas

- No crear un segundo login visible para Data Trade. Cada frontend conserva su login propio.
- No duplicar experiencias de cuenta por modulo.
- No guardar secretos en el repo. Las env vars sensibles viven en Vercel y Railway.
- No usar `localStorage` para refresh tokens. El frontend mantiene el access token solo en memoria.
- Mantener `alvin/` y `SistemaLogisticoPeruano/SisLoPe/` como repos anidados hasta que se haga una migracion coordinada.
- En Railway, `DATABASE_URL` del API debe ser referencia (`${{Postgres.DATABASE_URL}}`), no texto plano.
- En Vercel, agregar env vars con `printf` o desde el dashboard (nunca con `echo` desde CLI, que mete `\n`).
