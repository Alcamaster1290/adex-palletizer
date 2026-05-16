# Data Trade Phase Archive

Esta carpeta contiene documentos historicos generados durante fases de implementacion anteriores del ecosistema Data Trade. Son **historial**, no arquitectura viva ni runbook operativo.

## Documentos archivados

- `DATA_TRADE_PHASE_1_5_HARDENING.md` — fase 1.5: hardening inicial de seguridad del backend.
- `DATA_TRADE_AUTH_PHASE_2.md` — fase 2: auth con email/password, access y refresh tokens.
- `DATA_TRADE_AUTH_PHASE_2_5_SECURITY_REVIEW.md` — review de seguridad de la fase 2.
- `DATA_TRADE_FRONTEND_AUTH_PHASE_3.md` — fase 3: integracion de Data Trade Auth en el frontend de ADEX.
- `DATA_TRADE_ADMIN_DASHBOARD_PHASE_4.md` — fase 4: dashboard admin con metricas y tabla de usuarios.

## Regla operativa

No usar estos archivos como fuente principal de arquitectura actual. La **documentacion viva** esta en el nivel superior (`docs/`):

- `../DATA_TRADE_ARCHITECTURE.md` — arquitectura en uso.
- `../DATA_TRADE_ARCHITECTURE_PLAN.md` — arquitectura objetivo.
- `../DATA_TRADE_LOCAL_RUNBOOK.md` — runbook de desarrollo local.
- `../DATA_TRADE_AUTH.md` — auth operativo (login, refresh, handoff).
- `../DATA_TRADE_AUTH_AND_SSO_PLAN.md` — plan de SSO entre modulos.
- `../DATA_TRADE_ADMIN_DASHBOARD_PLAN.md` — plan vivo del dashboard admin.
- `../DATA_TRADE_FRONTEND_INTEGRATION_GUIDE.md` — guia para integrar nuevos frontends.
- `../DATA_TRADE_POSTGRES_SCHEMA.md` — schema PostgreSQL detallado.
- `../DATA_TRADE_MIGRATION_ROADMAP.md` — roadmap de migraciones.
- `../DATA_TRADE_AUDIT.md` — auditoria operativa del backend.

Si un documento historico contradice el README raiz, los READMEs de los proyectos (`apps/api`, `adex-palletizer-web`, `contracts`), o algun documento vivo en `docs/`, **prevalece la documentacion viva**.

## Cuando archivar un doc nuevo

Mover un documento aqui cuando:

- La fase descrita esta cerrada y el comportamiento ya esta en produccion o documentado en docs vivos.
- Los detalles puntuales (decisiones de diseño, descartes, tradeoffs) tienen valor historico pero no son referencia operativa.

Al archivar, actualizar la lista de "Documentos archivados" en este README.
