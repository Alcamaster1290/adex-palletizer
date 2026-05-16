# Changelog

Resumen de cambios mergeados a `main`. Para detalles de cada commit ver el historial de Git.

## 2026-05-15 — Production launch

Sesion completa de puesta en produccion del stack Data Trade en Vercel + Railway. Login funcional end-to-end, dashboard admin visible, infraestructura idempotente.

### Frontend (`adex-palletizer-web`)

- **Login limpio para produccion** ([5691065](https://github.com/Alcamaster1290/adex-palletizer/commit/5691065)): elimina "ADEX ACCESS GATE", chips de estado ("Acceso seguro", "Sesion profesional"/"Alta inmediata", hint de backend), debug "Origen API" en la pantalla checking, y badges `<strong>` decorativos en los labels de los formularios (excepto "opcional" que sigue informativo).
- **Vercel build fix** ([11029b7](https://github.com/Alcamaster1290/adex-palletizer/commit/11029b7)): `installCommand` en `adex-palletizer-web/vercel.json` ahora es `npm install --include=dev` para que devDependencies (`typescript`, `vite`) esten disponibles bajo Node 24, que Vercel auto-upgrade desde Node 20 por `engines: ">=20.19.0"`.
- **Dashboard admin: acceso por modulo, no solo por role string** ([2d6216a](https://github.com/Alcamaster1290/adex-palletizer/commit/2d6216a)): `adminDashboardAvailable` ahora considera `authModules.some(m => m.key === 'admin' && m.accessLevel === 'admin')` ademas de `authUser.role === 'admin'`. Robusto frente a variantes de mapeo del JWT.
- **`parseBooleanFlag` tolera whitespace** ([3693de1](https://github.com/Alcamaster1290/adex-palletizer/commit/3693de1)): `.trim().toLowerCase()` antes de comparar. Aplicado en `src/auth/authApi.ts` y `src/dataTrade/config.ts`. Esto desbloqueo el dashboard admin en produccion donde las env vars de Vercel quedaron con `"true\n"` al agregarlas con `echo` desde CLI.
- **Drop `admin_view_opened`** ([f37777a](https://github.com/Alcamaster1290/adex-palletizer/commit/f37777a)): el evento ya no se dispara al abrir el dashboard ni esta tipado en `client.ts`.

### Backend (`apps/api`)

- **Auto-migrate y seed en boot** ([bb5ed39](https://github.com/Alcamaster1290/adex-palletizer/commit/bb5ed39)): `npm start` ahora corre `node dist/db/migrate.js && node dist/db/seedAdmin.js && node dist/server.js`. Build copia `src/db/migrations/*.sql` a `dist/db/migrations/` via `scripts/copy-migrations.mjs`. `seedAdmin.ts` ya no falla si faltan env vars del admin, hace skip silente.
- **Drop `admin_view_opened` del whitelist** ([f37777a](https://github.com/Alcamaster1290/adex-palletizer/commit/f37777a)): el array `trackedEventNames` en `src/events.ts` ya no incluye el evento. Cualquier intento de enviarlo desde un cliente desactualizado sera rechazado.
- **Logging del `/ready`** ([fad9000](https://github.com/Alcamaster1290/adex-palletizer/commit/fad9000), [ca7478e](https://github.com/Alcamaster1290/adex-palletizer/commit/ca7478e), [3693de1](https://github.com/Alcamaster1290/adex-palletizer/commit/3693de1)): se agrego logging via `request.log.error({ err })` para no swallow silenciosamente el error de readiness. El diagnostico ayudo a identificar el password vacio en Postgres durante el bootstrap.

### Configuracion en infraestructura

- **Vercel**: 6 variables `VITE_*` agregadas al environment `Production` (`VITE_DATA_TRADE_API_URL`, `VITE_DATA_TRADE_TRACKING_ENABLED`, `VITE_DATA_TRADE_MODULE_CODE`, `VITE_DATA_TRADE_ADMIN_DASHBOARD_ENABLED`, `VITE_ADEX_LEGACY_AUTH_FALLBACK`, `VITE_SISLOPE_URL`). Re-agregadas con `printf` para eliminar trailing newlines que rompian `parseBooleanFlag`.
- **Railway**: `FRONTEND_ORIGINS` actualizado con `https://adex-palletizer.vercel.app` y `https://sis-lo-pe.vercel.app`. Servicio Postgres recreado tras la incidencia de `POSTGRES_PASSWORD=""`; `DATABASE_URL` del API service confirmado como referencia (`${{Postgres.DATABASE_URL}}`).

### Documentacion

- **READMEs de estructura del sistema** ([de316ac](https://github.com/Alcamaster1290/adex-palletizer/commit/de316ac)): seccion consistente "Estructura/Posicion/Lugar en Data Trade" agregada a los 4 READMEs activos (root, `adex-palletizer-web`, `apps/api`, `contracts`).
- **Refresh completo de READMEs** ([622bf1a](https://github.com/Alcamaster1290/adex-palletizer/commit/622bf1a)): los 5 READMEs reescritos contra el estado real de produccion. Cambios destacados:
  - Root README: nueva seccion "Despliegue En Produccion" con plantillas completas de env vars para Vercel y Railway, comandos de desarrollo local separados por componente.
  - `apps/api/README.md`: documenta el auto-migrate boot, agrega `auth_handoff_codes` y `schema_migrations` al schema, lista de eventos sin `admin_view_opened`, seccion completa de despliegue en Railway.
  - `adex-palletizer-web/README.md`: aclarado que el access token vive solo en memoria, documenta tolerancia de `parseBooleanFlag` al whitespace, marca legacy scripts como transicionales.
  - `contracts/README.md`: eliminada duplicacion de tabla productor/consumidor, agregada tabla comparativa con `apps/api`.
  - `docs/archive/README.md`: enumera los 5 docs archivados que realmente existen, cross-reference actualizado con los 10 docs vivos.

### URLs de produccion verificadas

| Servicio | URL | Stack |
| --- | --- | --- |
| Frontend ADEX | https://adex-palletizer.vercel.app | React 19 + Vite 7 (Vercel) |
| Backend Data Trade | https://data-trade-api-production.up.railway.app | Fastify 5 + Drizzle (Railway) |
| Postgres | Postgres servicio en el mismo proyecto Railway | Managed PostgreSQL |

### Login de produccion verificado

- `POST /auth/login` con `000350943@adexperu.edu.pe` / `ADEXPERU2026` devuelve 200 con `roles: ["user", "admin"]`.
- `GET /auth/modules` con Bearer token devuelve 5 modulos con `accessLevel: "admin"`.
- CORS preflight desde `adex-palletizer.vercel.app` responde 204 con `allow-origin` correcto.
- Dashboard admin visible en el menu de perfil tras hard refresh.
- Tabla de Usuarios cargando datos reales desde `/admin/users`.

### Reglas operativas aprendidas

1. **DATABASE_URL en Railway debe ser referencia, no texto plano.** Rotar la password del Postgres regenera todas las referencias automaticamente. Texto plano queda stale.
2. **Para agregar env vars en Vercel via CLI, usar `printf "valor"` y no `echo "valor"`.** `echo` mete `\n` al final y eso rompe comparaciones strict como `value === 'true'`.
3. **Las imagenes oficiales de Postgres aplican `POSTGRES_PASSWORD` solo en `initdb`.** Cambiar la variable despues de que la DB ya esta inicializada no actualiza la password del usuario `postgres`. Recrear el servicio es la salida limpia.
4. **El `/ready` del API debe loggear el error con `request.log.error({ err })`** (no swallow silencioso) para diagnosticar fallos de DB en produccion.
5. **Las migraciones idempotentes en el boot son baratas y eliminan una clase entera de bugs de despliegue.** Cada redeploy las re-corre sin efecto si ya estan aplicadas.

### Commits incluidos

- `5691065` Clean ADEX login page for production
- `de316ac` Document Data Trade system structure across READMEs
- (merge `dfd6e5b` — PR #22)
- `11029b7` Fix Vercel build: force devDependencies install
- `fad9000` Log ready check error to diagnose DATABASE_UNAVAILABLE
- `ca7478e` Use console.error in ready check so full error surfaces in logs
- `bb5ed39` Auto-migrate and seed admin at API service boot
- `2d6216a` Show admin dashboard when user has admin module access
- `dd0e2ce` Expose auth state debug snapshot on window for diagnosis (revertido en 3693de1)
- `3693de1` Trim env var values in parseBooleanFlag and clean up debug
- `f37777a` Drop admin_view_opened tracking event
- `622bf1a` Refresh all READMEs to reflect current ecosystem state
