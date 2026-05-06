# Data Trade Local Runbook

Este documento es la guia viva para correr y limpiar el entorno local de Data Trade. Los documentos por fase quedan en `docs/archive/` como historial, no como arquitectura activa.

## API Local

Desde PowerShell:

```powershell
cd apps/api
$env:DATABASE_URL='postgres://postgres:postgres@localhost:55432/data_trade'
$env:IP_HASH_SECRET='clave-local-larga'
$env:AUTH_ACCESS_TOKEN_SECRET='clave-local-larga'
$env:AUTH_REFRESH_TOKEN_SECRET='clave-local-larga'
$env:DATA_TRADE_ADMIN_EMAIL='admin@datatrade.local'
$env:DATA_TRADE_ADMIN_PASSWORD='ADEXPERU2026'
$env:DATA_TRADE_ADMIN_NAME='Data Trade Admin'
$env:FRONTEND_ORIGINS='http://localhost:5173,http://localhost:5174'
docker compose up -d postgres
npm run db:migrate
npm run db:seed:admin
npm run dev
```

Verificaciones basicas:

```powershell
Invoke-RestMethod http://localhost:8788/health
Invoke-RestMethod http://localhost:8788/ready
```

## Limpieza De Smoke Local

El comando `db:cleanup:smoke` elimina solo usuarios y eventos de prueba locales conocidos. Falla si `APP_ENV=production` o `NODE_ENV=production`.

Patrones permitidos para borrar:

```text
agent-browser-smoke-%@datatrade.local
admin-smoke-%@datatrade.local
normal-phase%@datatrade.local
admin-phase%@datatrade.local
smoke-phase%@datatrade.local
phase2-%@datatrade.local
phase3-%@datatrade.local
admin-[numeros]@datatrade.local
```

El seed `admin@datatrade.local` esta protegido y nunca debe borrarse.

```powershell
cd apps/api
$env:DATABASE_URL='postgres://postgres:postgres@localhost:55432/data_trade'
npm run db:cleanup:smoke
```

## Frontend ADEX Local

Archivo `adex-palletizer-web/.env.local` esperado:

```text
VITE_DATA_TRADE_API_URL=http://localhost:8788
VITE_DATA_TRADE_TRACKING_ENABLED=true
VITE_DATA_TRADE_MODULE_CODE=adex_palletizer
VITE_DATA_TRADE_ADMIN_DASHBOARD_ENABLED=true
VITE_ADEX_LEGACY_AUTH_FALLBACK=false
VITE_SISLOPE_URL=http://localhost:5174
```

Arranque:

```powershell
cd adex-palletizer-web
npm run dev -- --force
```

## Limpieza De Cache Frontend

Limpiar cache de Vite:

```powershell
cd adex-palletizer-web
Remove-Item -Recurse -Force .\node_modules\.vite -ErrorAction SilentlyContinue
npm run dev -- --force
```

Limpiar estado del navegador desde consola:

```javascript
localStorage.clear()
sessionStorage.clear()
location.reload()
```

Con `agent-browser`, despues de abrir `http://localhost:5173`:

```powershell
agent-browser eval "localStorage.clear(); sessionStorage.clear(); document.cookie.split(';').forEach(c => document.cookie = c.replace(/^ +/, '').replace(/=.*/, '=;expires=' + new Date(0).toUTCString() + ';path=/')); location.reload();"
```

## Dashboard Admin

El Dashboard admin no se renderiza en la pantalla principal. Para abrirlo:

1. Iniciar sesion con el login normal de ADEX.
2. Abrir el menu del icono de perfil.
3. Si el usuario tiene rol `admin` y `VITE_DATA_TRADE_ADMIN_DASHBOARD_ENABLED=true`, usar la opcion `Dashboard admin`.
4. Usar `Volver al palletizador` para regresar.

## Auditoria De Duplicados

Estado revisado en esta correccion:

- No hay carpetas `phase4`, `phase5` o equivalentes en el codigo productivo.
- Los documentos `DATA_TRADE_*_PHASE_*.md` se movieron a `docs/archive/`.
- `.claude/` esta versionado y parece configuracion local de editor; se deja intacto para no mezclar limpieza de tooling con este cambio funcional.
- `alvin` y `SistemaLogisticoPeruano/SisLoPe` son gitlinks/submodulos esperados y no se modifican en esta tarea.

## SisLoPe Local Con Misma Cuenta

SisLoPe corre como repo Git independiente en `SistemaLogisticoPeruano/SisLoPe`. Su login visual sigue siendo propio, pero el flujo ADEX -> SisLoPe usa un handoff temporal de Data Trade.

Variables esperadas para SisLoPe:

```text
VITE_DATA_TRADE_API_URL=http://localhost:8788
VITE_DATA_TRADE_TRACKING_ENABLED=true
VITE_DATA_TRADE_MODULE_CODE=sislope
VITE_ADEX_LEGACY_AUTH_FALLBACK=false
```

Arranque:

```powershell
cd SistemaLogisticoPeruano/SisLoPe
Remove-Item -Recurse -Force .\node_modules\.vite -ErrorAction SilentlyContinue
npm run dev -- --force --port 5174
```

Credenciales locales para la prueba:

```text
admin@datatrade.local
ADEXPERU2026
```

El login visual de SisLoPe debe seguir siendo el suyo propio, autenticando contra Data Trade por debajo igual que ADEX.

## Smoke Handoff ADEX A SisLoPe

1. Levantar API en `http://localhost:8788`.
2. Levantar ADEX en `http://localhost:5173`.
3. Levantar SisLoPe en `http://localhost:5174`.
4. Iniciar sesion en ADEX con `admin@datatrade.local`.
5. Click en `SisLoPe`.
6. Validar:
   - ADEX llama `POST http://localhost:8788/auth/handoff/create`.
   - SisLoPe abre con `?handoff=<code>`.
   - La URL no contiene email, password, access token ni refresh token.
   - SisLoPe llama `POST http://localhost:8788/auth/handoff/exchange`.
   - SisLoPe limpia el query param con `history.replaceState`.
   - SisLoPe entra al mapa sin pedir otra contrasena.
   - SisLoPe envia `POST http://localhost:8788/events/track` con `module=sislope`.
