# Data Trade API

Backend comun inicial para Data Trade. Esta fase no conecta todavia SisLoPe ni ADEX Palletizer en produccion.

## Comandos

```bash
npm install
npm run build
npm run test
npm run db:migrate
npm run dev
```

## Endpoints iniciales

- `GET /health`: estado del proceso.
- `GET /ready`: valida conectividad con PostgreSQL.
- `POST /events/track`: tracking interno con IP hasheada.

## Variables

Ver `.env.example`. En produccion `IP_HASH_SECRET` debe estar definido y no debe compartirse entre ambientes.

## Migraciones

El schema Drizzle vive en `src/db/schema.ts`. La migracion inicial crea tablas core de usuarios, organizaciones, modulos, proyectos, runs, sesiones de mapa, uploads, eventos y auditoria.
