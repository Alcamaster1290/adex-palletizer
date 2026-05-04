# Data Trade Migration Roadmap

## Fase 0: auditoria y mapa tecnico

- Crear documentacion de arquitectura, schema, auth, admin y roadmap.
- Riesgo: documentacion divergente del codigo si no se actualiza.
- Aceptacion: docs en `/docs` y plan de fases claro.

## Fase 1: backend PostgreSQL comun

- Crear `apps/api` con Fastify, Drizzle, migracion inicial, health y tracking.
- Archivos principales: `apps/api/src/*`, `apps/api/src/db/*`, `apps/api/.env.example`.
- Riesgo: dependencias nuevas o migracion incompleta.
- Pruebas: build, tests unitarios, endpoint tracking con DB mock.
- Aceptacion: `GET /health`, `GET /ready` y `POST /events/track` existen.

## Fase 2: auth comun

- Implementar login/sesion central y migracion desde usuarios legacy.
- Riesgo: sesiones existentes y cookies por dominio.
- Aceptacion: una cuenta sirve para SisLoPe y ADEX con API central.

## Fase 3: conexion de SisLoPe

- Conectar guards, modulo `sislope`, eventos de mapa, busquedas y sesiones.
- Riesgo: CORS/cookies y no degradar performance del mapa.
- Aceptacion: eventos de mapa llegan a PostgreSQL.

## Fase 4: conexion de ADEX Palletizer

- Persistir `palletizer_runs`, proyectos/escenarios y labels.
- Riesgo: perdida de datos locales en `localStorage`.
- Aceptacion: guardar en backend con fallback local temporal.

## Fase 5: tracking interno

- Completar eventos base y captura de errores API.
- Riesgo: volumen de eventos sin retencion.
- Aceptacion: dashboard puede consultar eventos por modulo.

## Fase 6: panel admin

- Construir UI admin y endpoints agregados.
- Riesgo: exposicion accidental sin rol admin.
- Aceptacion: usuarios no admin reciben 403.

## Fase 7: limpieza y documentacion

- Extraer paquetes compartidos, retirar auth duplicada y documentar operacion.
- Riesgo: imports cruzados y cambios de build.
- Aceptacion: apps existentes siguen desplegando y paquetes compartidos tienen tests.
