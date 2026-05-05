# Data Trade Metrics Aggregation - Fase 5

## Objetivo

Fase 5 prepara Data Trade para medir traccion real sin depender siempre de consultas directas sobre `data_trade.events`.

Se mantienen eventos crudos. Los agregados diarios son derivados recalculables.

## Tablas nuevas

`data_trade.daily_module_metrics`:

- `date`
- `module_code`
- `events_count`
- `unique_users`
- `anonymous_users`
- `sessions_count`
- `calculations_count`
- `errors_count`
- `created_at`
- `updated_at`

`data_trade.daily_user_metrics`:

- `date`
- `user_id`
- `events_count`
- `modules_used_count`
- `sessions_count`
- `last_event_at`
- `created_at`
- `updated_at`

Este diseno mantiene un agregado por modulo/dia y usuario/dia. Es suficiente para overview, uso por modulo y retencion simple. Para cohortes avanzadas o funnels por plan convendra agregar tablas especificas.

## Script de agregacion

```powershell
cd "C:\Users\Alvaro\Proyectos\Data Trade\apps\api"
$env:DATABASE_URL = "postgres://postgres:postgres@localhost:55432/data_trade"
npm run metrics:aggregate
```

Por defecto recalcula los ultimos 30 dias hasta hoy. Para rango especifico:

```powershell
$env:METRICS_FROM = "2026-05-01"
$env:METRICS_TO = "2026-05-05"
npm run metrics:aggregate
Remove-Item Env:\METRICS_FROM
Remove-Item Env:\METRICS_TO
```

El script:

- Lee `data_trade.events`.
- Agrupa por dia.
- Hace upsert en `daily_module_metrics` y `daily_user_metrics`.
- No borra eventos crudos.
- Es idempotente para el mismo conjunto de eventos.

## Endpoint manual admin

`POST /admin/metrics/aggregate`

Requiere Bearer token y rol `admin`.

Body:

```json
{
  "from": "2026-05-01",
  "to": "2026-05-05"
}
```

Limite: maximo 31 dias por request para evitar abuso desde UI/API.

Respuesta:

```json
{
  "from": "2026-05-01",
  "to": "2026-05-05",
  "events_read": 120,
  "module_rows": 8,
  "user_rows": 24
}
```

## Endpoints admin actualizados

Usan agregados diarios cuando existen y fallback seguro a `events` cuando no hay agregados:

- `GET /admin/metrics/overview`
- `GET /admin/modules/usage`
- `GET /admin/retention`

Notas:

- `active_users_7d` y `active_users_30d` se calculan con `daily_user_metrics` como usuarios distintos en rango.
- `modules/usage.unique_users` desde `daily_module_metrics` representa suma de usuarios diarios por modulo; puede contar al mismo usuario mas de una vez en rangos largos.
- `latest_event_at` sigue saliendo de `events` para mantener precision.

## Eventos productivos ADEX

Se agregan eventos opt-in:

- `auth_panel_opened`
- `admin_dashboard_opened`
- `admin_metric_viewed`
- `palletizer_calculation_exported`
- `api_error`

Eventos existentes que siguen activos:

- `module_opened`
- `palletizer_calculation_created`

`palletizer_input_changed` queda soportado por contrato pero no instrumentado por ahora para evitar spam de eventos por cada cambio de input. Debe implementarse despues con debounce y muestreo.

## Smoke PowerShell

```powershell
cd "C:\Users\Alvaro\Proyectos\Data Trade\apps\api"
npm run docker:db:up
$env:DATABASE_URL = "postgres://postgres:postgres@localhost:55432/data_trade"
$env:IP_HASH_SECRET = "replace-with-at-least-32-random-bytes"
$env:AUTH_ACCESS_TOKEN_SECRET = "replace-with-at-least-32-random-bytes"
$env:AUTH_REFRESH_TOKEN_SECRET = "replace-with-at-least-32-random-bytes"
npm run db:migrate

$env:DATA_TRADE_ADMIN_EMAIL = "admin@datatrade.local"
$env:DATA_TRADE_ADMIN_PASSWORD = "ChangeMeOnlyLocal123"
$env:DATA_TRADE_ADMIN_NAME = "Data Trade Admin"
npm run db:seed:admin
Remove-Item Env:\DATA_TRADE_ADMIN_PASSWORD

npm run metrics:aggregate
npm run dev
```

En otra terminal:

```powershell
$base = "http://127.0.0.1:8788"
$loginBody = @{ email = "admin@datatrade.local"; password = "ChangeMeOnlyLocal123" } | ConvertTo-Json
$login = Invoke-RestMethod -Method Post -Uri "$base/auth/login" -ContentType "application/json" -Body $loginBody
$headers = @{ Authorization = "Bearer $($login.accessToken)" }

Invoke-RestMethod -Uri "$base/admin/metrics/overview" -Headers $headers
Invoke-RestMethod -Uri "$base/admin/modules/usage" -Headers $headers

$aggregateBody = @{ from = "2026-05-01"; to = "2026-05-05" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$base/admin/metrics/aggregate" -Headers $headers -ContentType "application/json" -Body $aggregateBody
```

## Produccion

Fase 5 deja `npm run metrics:aggregate` listo para cron o worker. En Vercel conviene moverlo a un job controlado o ejecutarlo desde backend/worker con rango acotado.

Riesgos pendientes:

- No hay job scheduler todavia.
- Los agregados son diarios, no por hora.
- No hay deduplicacion por `event_id`; se asume que `events` es append-only.
- En volumen alto conviene ejecutar agregacion incremental por fecha y no desde UI.
