# Data Trade Architecture Plan

## Recomendacion

Usar monorepo modular como arquitectura objetivo, pero sin mover de inmediato las apps desplegadas. La primera entrega agrega `apps/api` como backend comun y deja SisLoPe/ADEX intactos hasta fases posteriores.

## Estructura objetivo

```text
apps/web
apps/api
apps/sislope
apps/palletizer
apps/workers
packages/db
packages/auth
packages/events
packages/contracts
packages/ui
docs
```

## Opciones evaluadas

### Opcion A: repos separados con backend comun

- Puntos fuertes: menor cambio inicial, menos riesgo sobre despliegues Vercel actuales, integracion gradual.
- Puntos debiles: mantiene duplicacion de auth, env vars, UI y contratos; mas dificil versionar cambios transversales.
- Costo tecnico: bajo al inicio, medio/alto en mantenimiento.
- Riesgo: bajo para produccion, medio para consistencia.
- Esfuerzo estimado: 2 a 4 semanas para backend y primera integracion.

### Opcion B: monorepo modular

- Puntos fuertes: paquetes compartidos, migraciones centralizadas, contratos versionados, admin y auth comunes.
- Puntos debiles: migracion inicial mas delicada y requiere orden de despliegue.
- Costo tecnico: medio al inicio, menor despues.
- Riesgo: medio, mitigado si las apps actuales no se mueven hasta estar listas.
- Esfuerzo estimado: 4 a 8 semanas para shell, paquetes compartidos y migracion inicial de modulos.

## Decision

Implementar Opcion B de forma incremental. Fase 1 crea backend comun en `apps/api`; fases posteriores extraen `packages/*` y migran SPAs sin romper los deployments actuales.

## Separacion de responsabilidades

- `apps/api`: API comun, health, tracking, auth comun, admin y modelos core.
- `services/maritime-api`: dominio maritimo especializado; se integra luego como worker o modulo.
- `adex-palletizer-web`: se mantiene como app productiva hasta migrar escenarios/runs.
- `SistemaLogisticoPeruano/SisLoPe`: se mantiene como app productiva hasta conectar tracking y auth central.
- `alvin`: se conserva como motor Python con contratos; futura API/worker.
