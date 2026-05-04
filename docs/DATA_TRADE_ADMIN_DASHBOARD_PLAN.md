# Data Trade Admin Dashboard Plan

## Objetivo

Crear un dashboard solo para administradores que permita medir adopcion, actividad y errores por modulo.

## Metricas

- Usuarios registrados y activos por dia, semana y mes.
- Nuevos registros por periodo.
- Retencion basica.
- Uso por modulo: SisLoPe, ADEX Palletizer, Data Trade analytics y ALVIN.
- Calculos de palletizacion.
- Sesiones de mapa.
- Busquedas realizadas.
- Archivos cargados.
- Errores por modulo.
- Eventos importantes.
- Ultimo acceso por usuario.
- Usuarios mas activos.
- Modulos mas usados.
- Conversiones futuras free/premium.

## Endpoints

- `GET /admin/metrics/overview`
- `GET /admin/users`
- `GET /admin/users/:id/activity`
- `GET /admin/events`
- `GET /admin/modules/usage`
- `GET /admin/errors`
- `GET /admin/retention`

## Seguridad

Todos los endpoints admin deben requerir usuario autenticado con rol `admin`. Cada acceso al dashboard debe emitir `admin_view_opened` y acciones sensibles deben entrar en `audit_logs`.

## Implementacion por fases

Fase 1 solo crea modelo y tracking base. Los endpoints admin se agregan cuando la auth central este activa.
