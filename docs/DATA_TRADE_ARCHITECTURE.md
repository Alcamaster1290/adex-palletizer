# Data Trade Architecture

Data Trade es el motor comun del ecosistema, no una app paralela. Su responsabilidad es centralizar identidad, sesiones, modulos, eventos, metricas y trazabilidad para ADEX Palletizer, SisLoPe, ALVIN y futuros modulos.

## Estado Actual

- `apps/api`: backend comun Fastify + PostgreSQL schema `data_trade`.
- `adex-palletizer-web`: frontend ADEX; usa el login normal visual y Data Trade Auth por debajo.
- `SistemaLogisticoPeruano/SisLoPe`: repo anidado independiente; recibe handoff seguro desde ADEX en su propia rama.
- `alvin`: se mantiene intacto; integra por contratos y flujos posteriores.

## Reglas De Producto

- No mostrar "Cuenta Data Trade" como flujo separado.
- No renderizar un segundo login.
- No revivir `DataTradeAuthPanel`.
- El Dashboard admin se abre desde el menu de perfil de ADEX y solo para rol `admin`.
- Tracking usa la sesion normal si existe; si no, usa `anonymousId`.

## Modulos

Modulos base en `data_trade.modules`:

- `sislope`
- `adex_palletizer`
- `data_trade_analytics`
- `alvin`
- `admin`
- `api`

## Navegacion Autenticada

ADEX puede abrir SisLoPe con una sesion compartida mediante handoff temporal:

```text
http://localhost:5173 -> http://localhost:5174
```

La URL de SisLoPe solo puede incluir `handoff=<code>`. Nunca debe incluir credenciales ni tokens.
