# Data Trade

Data Trade es el workspace de convergencia para herramientas internas de logistica, comercio exterior y analisis de datos. El objetivo actual no es crear una app paralela, sino usar un backend comun invisible para identidad, sesiones, modulos, eventos, metricas y trazabilidad.

Este README resume el estado del workspace completo sin reemplazar los README de cada proyecto. Las funcionalidades propias de ADEX Palletizer, SisLoPe, ALVIN, `maritime-api` y los contratos se mantienen y se documentan en sus carpetas.

## Estado Actual

| Proyecto | Estado | Rol en Data Trade |
| --- | --- | --- |
| `apps/api` | Activo | Backend comun Fastify + PostgreSQL en schema `data_trade`. Expone auth, tracking y endpoints admin. |
| `adex-palletizer-web` | Activo | SPA React/Vite de palletizacion, visualizacion 3D, escenarios, labels, exports y navegacion hacia modulos relacionados. Usa Data Trade Auth por debajo del login normal de ADEX. |
| `SistemaLogisticoPeruano/SisLoPe` | Repo anidado | SPA geoespacial logistica con mapa, capas, rutas, nodos, busqueda y modulo maritimo. Mantiene su repo propio y debe converger al mismo proveedor Data Trade sin segundo login. |
| `SistemaLogisticoPeruano/SisLoPe/services/maritime-api` | Servicio separado | Backend maritimo Fastify + Drizzle + PostgreSQL para tracking/heatmap maritimo de SisLoPe. |
| `alvin` | Repo anidado | Streamlit/Python para expediente de costos de importacion/exportacion, tributos, gastos, prorrateo, pricing y export. Consume/produce contratos JSON; no esta conectado aun al backend Data Trade. |
| `contracts` | Activo | Schemas JSON versionados para interoperabilidad entre modulos. |
| `docs` | Activo | Arquitectura, planes, runbook local y archivo historico de fases. |

## Estructura Del Sistema Data Trade

Layout actual del monorepo y como se relaciona cada pieza:

```text
data-trade/
|-- apps/
|   `-- api/                          Backend comun Fastify + PostgreSQL schema "data_trade"
|                                     Deploy: data-trade-api-production.up.railway.app
|-- adex-palletizer-web/              SPA React/Vite - ADEX Palletizer (modulo activo)
|                                     Deploy: adex-palletizer.vercel.app
|-- SistemaLogisticoPeruano/
|   `-- SisLoPe/                      Repo anidado - SPA logistica geoespacial
|                                     Deploy: sis-lo-pe.vercel.app
|-- alvin/                            Repo anidado - Streamlit costos COMEX
|                                     Deploy: alvin-comex.streamlit.app
|-- contracts/                        Contratos JSON versionados (trade-case.v1, trade-costs.v1)
`-- docs/                             Arquitectura, runbook, planes y archivo historico
```

| Componente | Stack | Despliegue | Rol |
| --- | --- | --- | --- |
| `apps/api` | Fastify 5, Drizzle, PostgreSQL | Railway (`data-trade-api-production.up.railway.app`) | Identidad, sesiones, modulos, eventos, metricas, admin |
| `adex-palletizer-web` | React 19, Vite 7, Three/Fiber | Vercel (`adex-palletizer.vercel.app`) | Palletizacion, visualizacion 3D, exports, handoff a SisLoPe |
| `SisLoPe` | SPA + `maritime-api` Fastify | Vercel (`sis-lo-pe.vercel.app`) | Mapa logistico, capas, rutas, modulo maritimo |
| `alvin` | Streamlit (Python) | Streamlit Cloud (`alvin-comex.streamlit.app`) | Costos importacion/exportacion, tributos, pricing |
| `contracts` | JSON Schema | - | Intercambio entre modulos por `caseId` portable |

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
- Solo `adex-palletizer-web` y `apps/api` se versionan dentro de este repo principal.
- El backend comun es uno solo (`apps/api`). `maritime-api` dentro de SisLoPe es un servicio de dominio maritimo, no reemplaza al backend Data Trade.
- Toda integracion entre modulos pasa por `apps/api` (identidad/eventos) o por `contracts/` (datos de negocio).

## Funcionalidades Por Proyecto

### ADEX Palletizer

- Calculo de unitarizacion caja/pallet/contenedor.
- Modos `Caja unica`, `Multiples cajas` y contenedores `20 GP`, `40 GP`, `40 HC` o custom.
- Visualizacion 3D con presets de pallet, cajas, sacks/warehouse skin y fallback geometrico.
- Label Designer por SKU y escenarios guardados localmente.
- Share links y exports JSON/PNG.
- Export de `trade-case.v1` para ALVIN, SisLoPe o futuros ETL.
- Login visible unico de ADEX; Data Trade Auth funciona por debajo cuando `VITE_DATA_TRADE_API_URL` esta configurado.
- Dashboard admin solo desde el menu de perfil para usuarios con rol `admin`.

### SisLoPe

- Mapa logistico con capas geoespaciales, nodos, rutas, filtros y busqueda.
- Integracion con datos logisticos del Peru y capas operativas internas.
- Backend maritimo separado para tracking/heatmap diario agregado.
- Debe mantener su login visual propio como unica puerta del modulo.
- La convergencia esperada es usar Data Trade Auth por debajo y aceptar handoff temporal desde ADEX sin credenciales en URL.

### ALVIN

- Expediente de costos de importacion y exportacion.
- Factura comercial, configuracion de tasas, tributos aduaneros, gastos, prorrateo por producto y precio de venta.
- Dashboard con KPIs, graficos y export Excel/JSON.
- Motor numerico con `decimal.Decimal` y contratos `trade-case.v1` / `trade-costs.v1`.
- Integracion futura con Data Trade para identidad, eventos y trazabilidad si se requiere.

### maritime-api

- Read models maritimos para SisLoPe.
- Tracking por embarque/buque y heatmap diario maritimo/fluvial.
- Workers para sincronizar fuentes agregadas, sin consultar AIS desde requests de usuario.
- Servicio de dominio maritimo; no reemplaza a `apps/api`.

## Arquitectura En Uso

```text
adex-palletizer-web
  login normal ADEX
  -> apps/api /auth/*
  -> apps/api /events/track
  -> apps/api /admin/* solo desde menu de perfil si rol admin
  -> apps/api /auth/handoff/create para navegar a SisLoPe sin tokens en URL

SisLoPe
  login visual propio
  -> convergencia esperada: apps/api /auth/*
  -> puede canjear handoff con /auth/handoff/exchange cuando su repo tenga el receptor habilitado

ALVIN
  Streamlit local/hosteado
  -> contratos JSON trade-case.v1 y trade-costs.v1
```

## Backend Comun

El backend comun esta en `apps/api`.

Comandos principales en PowerShell:

```powershell
cd apps/api
npm install
npm run docker:db:up
$env:DATABASE_URL='postgres://postgres:postgres@localhost:55432/data_trade'
npm run db:migrate
npm run db:verify
npm run db:seed:admin
npm run dev
```

Variables locales tipicas:

```text
DATABASE_URL=postgres://postgres:postgres@localhost:55432/data_trade
IP_HASH_SECRET=clave-local-larga
AUTH_ACCESS_TOKEN_SECRET=clave-local-larga
AUTH_REFRESH_TOKEN_SECRET=clave-local-larga
DATA_TRADE_ADMIN_EMAIL=admin@datatrade.local
DATA_TRADE_ADMIN_PASSWORD=ADEXPERU2026
DATA_TRADE_ADMIN_NAME=Data Trade Admin
FRONTEND_ORIGINS=http://localhost:5173,http://localhost:5174
```

## ADEX Palletizer

El usuario ve un solo login: el login normal de ADEX. Si `VITE_DATA_TRADE_API_URL` existe, ese login llama a Data Trade Auth.

```powershell
cd adex-palletizer-web
npm install
npm run dev -- --force
```

`.env.local` recomendado:

```text
VITE_DATA_TRADE_API_URL=http://localhost:8788
VITE_DATA_TRADE_TRACKING_ENABLED=true
VITE_DATA_TRADE_MODULE_CODE=adex_palletizer
VITE_DATA_TRADE_ADMIN_DASHBOARD_ENABLED=true
VITE_ADEX_LEGACY_AUTH_FALLBACK=false
```

## Limpieza Local

Para limpiar usuarios/eventos smoke de PostgreSQL local sin borrar `admin@datatrade.local`:

```powershell
cd apps/api
$env:DATABASE_URL='postgres://postgres:postgres@localhost:55432/data_trade'
npm run db:cleanup:smoke
```

Para limpiar cache del frontend:

```powershell
cd adex-palletizer-web
Remove-Item -Recurse -Force .\node_modules\.vite -ErrorAction SilentlyContinue
npm run dev -- --force
```

## Documentacion

- Runbook local: `docs/DATA_TRADE_LOCAL_RUNBOOK.md`
- Arquitectura viva: `docs/DATA_TRADE_ARCHITECTURE.md`
- Arquitectura objetivo/plan: `docs/DATA_TRADE_ARCHITECTURE_PLAN.md`
- Auth operativo: `docs/DATA_TRADE_AUTH.md`
- Auth y SSO: `docs/DATA_TRADE_AUTH_AND_SSO_PLAN.md`
- Schema PostgreSQL: `docs/DATA_TRADE_POSTGRES_SCHEMA.md`
- Contratos JSON: `contracts/README.md`
- Historico de fases: `docs/archive/README.md`

## Reglas Operativas

- No crear un segundo login visible para Data Trade.
- No duplicar experiencias de cuenta por modulo.
- No guardar secretos en el repo.
- No usar `localStorage` para refresh tokens.
- Mantener `alvin` y `SisLoPe` como repos anidados hasta que se haga una migracion coordinada.
