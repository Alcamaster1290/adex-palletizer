# Data Trade Audit

Fecha: 2026-05-04

## Resumen ejecutivo

Data Trade debe evolucionar de varias aplicaciones conectadas por enlaces y contratos sueltos hacia un aplicativo modular con backend PostgreSQL compartido. La recomendacion es una migracion incremental: primero backend comun y documentacion, luego auth comun, despues integracion progresiva de SisLoPe, ADEX Palletizer y modulos analiticos.

## SisLoPe

- Arquitectura actual: SPA React/Vite con mapa logistico, MapLibre, Deck.gl, Three.js, Zustand y datos principales en `src/data/*`.
- Backend actual: Vercel Functions para auth en `api/auth/*`; backend maritimo separado en `services/maritime-api`.
- Datos actuales: nodos, flujos, departamentos y geometrias hardcodeados en TypeScript; heatmap/tracking maritimo en PostgreSQL por `services/maritime-api` si se despliega.
- Auth: copia local de la auth de ADEX que consulta `public.usuarios` y `public.auth_sessions`.
- Riesgo: la auth esta duplicada y el backend maritimo es especifico de dominio, no una base limpia para el backend general.

## ADEX Palletizer

- Arquitectura actual: SPA React/Vite con calculos de paletizacion/contenedores, Three/Fiber, modelos 3D y exportaciones.
- Backend actual: Fastify + `pg`, expuesto localmente y por Vercel Functions.
- Datos actuales: usuarios/sesiones en PostgreSQL; escenarios y labels aun en `localStorage`.
- Auth: login, registro, refresh, logout, cambio de password y auditoria basica sobre `usuarios`, `auth_sessions`, `auth_audit_log`.
- Riesgo: migraciones SQL manuales y bootstrap `admin/admin` deben reemplazarse antes de exponer admin real.

## Veritrade/Data Trade Analytics

- Arquitectura actual: scripts Python/Streamlit, Excel y dashboards exploratorios.
- Datos actuales: archivos Excel locales y transformaciones con pandas.
- Valor reutilizable: limpieza de columnas, dashboard comercial, busqueda de partidas y estructura inicial de dataset de comercio exterior.
- Riesgo: datasets pesados en repo y ausencia de modelo ETL/versionado.

## ALVIN / Cost Calculator

- Arquitectura actual: Streamlit + motor Python con `decimal.Decimal`.
- Datos actuales: estado en `st.session_state`, import/export JSON y Excel.
- Valor reutilizable: logica de costos, contratos `trade-case.v1` y `trade-costs.v1`, tests de dominio.
- Riesgo: no conviene reescribir a TypeScript en la primera fase; debe empaquetarse o exponerse como worker/API cuando el backend comun exista.

## Duplicacion y unificacion

- Auth duplicada entre ADEX y SisLoPe.
- URLs hardcodeadas entre apps (`sis-lo-pe.vercel.app`, `adex-palletizer.vercel.app`, Streamlit ALVIN).
- Dependencias repetidas: React, Vite, TypeScript, Vitest, Fastify, zod, PostgreSQL.
- Contratos ya compartibles: `contracts/trade-case.v1.schema.json` y `contracts/trade-costs.v1.schema.json`.
- Modulos que pueden unificarse: auth, tracking, contratos, UI shell, admin, proyectos guardados, eventos.
- Modulos que deben seguir separados por ahora: `services/maritime-api`, ALVIN Python, dashboards Veritrade y SPAs productivas.
