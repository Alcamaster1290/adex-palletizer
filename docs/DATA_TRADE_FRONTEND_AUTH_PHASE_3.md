# Data Trade Frontend Auth Phase 3

## Alcance

Fase 3 conecta ADEX Palletizer y SisLoPe con `apps/api` en modo opt-in. No reemplaza auth legacy, no bloquea rutas productivas y no cambia despliegues actuales de Vercel si los flags permanecen apagados.

## Auditoria previa

### ADEX Palletizer

- Frontend real en `adex-palletizer-web`, SPA React/Vite.
- Auth legacy en `adex-palletizer-web/src/auth/*`, `adex-palletizer-web/api/auth/*` y `adex-palletizer-web/server/src/auth.ts`.
- Usa cookies `HttpOnly` propias del host ADEX para refresh legacy.
- Persistencia local todavia existe en `src/scenarios.ts` y `src/labels/labelStorage.ts`.
- Fase 3 agrega `src/dataTrade/*` sin eliminar auth legacy.

### SisLoPe

- Carpeta local en `SistemaLogisticoPeruano/SisLoPe`, pero es repositorio Git anidado apuntando a `Alcamaster1290/SisLoPe`.
- Frontend real en `SistemaLogisticoPeruano/SisLoPe/src`, SPA React/Vite con Zustand y MapLibre/deck.gl.
- Auth legacy en `src/auth/*` y `api/auth/*`, con cookie propia `sislope_refresh_token`.
- Fase 3 agrega cliente local `src/dataTrade/*` y tracking de toggles si se decide publicar un PR en el repo SisLoPe.

## Decision tecnica

- Estrategia inicial: `Authorization: Bearer` contra `apps/api`.
- Access token y refresh token viven solo en memoria del cliente Data Trade.
- No se guarda refresh token en `localStorage`.
- `localStorage` solo se usa para `anonymousId` de tracking anonimo.
- Futuro: migrar a cookies `HttpOnly` bajo `.datatrade.pe` cuando existan dominios comunes.

## Feature Flags

Flags por frontend:

```text
VITE_DATA_TRADE_AUTH_ENABLED=false
VITE_DATA_TRADE_API_URL=
VITE_DATA_TRADE_TRACKING_ENABLED=false
VITE_DATA_TRADE_MODULE_CODE=adex_palletizer
```

Para SisLoPe:

```text
VITE_DATA_TRADE_MODULE_CODE=sislope
```

Con flags apagados no se hacen llamadas al backend Data Trade.

## Integracion ADEX

Archivos nuevos:

- `adex-palletizer-web/src/dataTrade/config.ts`
- `adex-palletizer-web/src/dataTrade/client.ts`
- `adex-palletizer-web/src/dataTrade/runtime.ts`
- `adex-palletizer-web/src/dataTrade/DataTradeAuthPanel.tsx`
- `adex-palletizer-web/src/dataTrade/client.test.ts`
- `adex-palletizer-web/.env.example`

Cambios:

- `adex-palletizer-web/src/App.tsx` renderiza `DataTradeAuthPanel` solo si el flag de auth esta activo.
- Envia `module_opened` al entrar con auth legacy.
- Envia `palletizer_calculation_created` en calculos single, multi y container si tracking esta activo.
- `adex-palletizer-web/src/styles.css` agrega estilos mínimos del panel.

## Integracion SisLoPe

Archivos nuevos equivalentes en:

- `SistemaLogisticoPeruano/SisLoPe/src/dataTrade/*`

Cambios locales:

- `src/app/App.tsx` renderiza `DataTradeAuthPanel` solo si el flag de auth esta activo.
- Envia `module_opened` y `session_started`.
- Envia `map_layer_toggled` para labels, flows, corridors y fleet heatmap.
- `src/styles/index.css` agrega estilos mínimos del panel.
- `.env.example` agrega flags Data Trade.

Como SisLoPe es repo Git anidado, estos cambios deben commitearse en `Alcamaster1290/SisLoPe` o replicarse desde `docs/DATA_TRADE_FRONTEND_INTEGRATION_GUIDE.md`.

## Guards Preparados

Cada cliente expone:

```ts
canAccessModule(modules, "adex_palletizer")
canAccessModule(modules, "sislope")
canAccessModule(modules, "admin")
```

No se aplica bloqueo duro todavía. La Fase 3 solo deja listo el helper para proteger rutas futuras.

## Riesgos Pendientes

- Tokens en memoria implican que la sesion Data Trade se pierde al recargar la pagina. Es aceptable para opt-in inicial.
- Si en una fase futura se guarda refresh token en navegador, debe tratarse como riesgo alto salvo que sea cookie `HttpOnly`.
- Rate limit del backend sigue siendo in-memory; produccion multi-instancia debe usar Redis, Postgres o WAF.
- Mientras ADEX y SisLoPe sigan en `*.vercel.app`, no se debe asumir cookie compartida.
