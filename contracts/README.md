# Data Trade - Contratos de Integracion

Contratos JSON versionados para la comunicacion entre modulos del ecosistema Data Trade.

Estos contratos no reemplazan las funcionalidades propias de ADEX Palletizer, ALVIN o SisLoPe. Su objetivo es permitir que cada proyecto intercambie casos y resultados sin acoplar UIs, scripts internos o estructuras de carpetas.

## Posicion En Data Trade

`contracts/` es la capa de **datos de negocio** entre modulos. Es independiente del backend comun (`apps/api`), que se ocupa solo de identidad y telemetria.

```text
data-trade/
|-- apps/api/                Identidad, sesiones, eventos (NO transporta contratos)
|                            Deploy: data-trade-api-production.up.railway.app
|-- adex-palletizer-web/     Productor de trade-case.v1 (Vercel)
|-- alvin/                   Consumidor de trade-case.v1 / productor de trade-costs.v1 (Streamlit)
|-- SistemaLogisticoPeruano/
|   `-- SisLoPe/             Consumidor (Vercel)
|-- contracts/               <- ESTA CARPETA (schemas y ejemplos)
`-- docs/                    Arquitectura y planes
```

Separacion de responsabilidades:

- `apps/api` transporta identidad y eventos. Un evento puede referenciar un `caseId`, pero el payload del caso vive en su contrato JSON.
- `contracts/` define el **formato**; el **transporte** (archivo descargado, upload manual, share link, fetch) lo decide cada modulo.
- `docs/` documenta arquitectura y planes; los schemas viven aqui como fuente unica de verdad.

## Regla Operativa

Toda integracion entre modulos debe pasar por `caseId` y contratos versionados, no por scraping de UIs ni imports ad hoc.

## Contratos

| Contrato | Productor principal | Consumidores esperados | Archivos |
| --- | --- | --- | --- |
| `trade-case.v1` | ADEX Palletizer | ALVIN / import_cost_calculator, SisLoPe, futuros ETL | `trade-case.v1.schema.json`, `trade-case.v1.example.json` |
| `trade-costs.v1` | ALVIN / import_cost_calculator | SisLoPe, dashboards, Excel export, futuros ETL | `trade-costs.v1.schema.json`, `trade-costs.v1.example.json` |

### trade-case.v1

Describe un caso comercial de importacion/exportacion.

Campos requeridos:

- `version`
- `caseId`
- `createdAt`
- `operationType`
- `skus[]`

Campos opcionales agregados por el Palletizer:

- `sourceModule`
- `packagingSummary`
- `palletSummary`
- `containerSummary`

Estos campos solo aparecen cuando el caso fue generado desde ADEX Palletizer con datos de embalaje, palletizacion o contenedor.

Compatibilidad con JSON legacy del Palletizer:

- `skus[].skuId` mapea a `multiSkuInputs[].skuId` del export actual.
- ALVIN / import_cost_calculator mantiene soporte transitorio para el formato legacy mientras se completa la migracion.
- Los consumidores deben tolerar campos opcionales nuevos dentro de `v1`.

### trade-costs.v1

Describe los costos calculados de una operacion.

Campos requeridos:

- `version`
- `caseId`
- `currency`
- `exchangeRate`
- `generatedAt`

Precision decimal:

- Todos los montos se representan como **strings** (`"25907.20"`) para preservar precision `decimal.Decimal` sin perdida por flotantes IEEE 754.
- No convertir montos a `number` si se requiere precision contable o conciliacion con Excel.

Base regulatoria:

- `regulatoryBasis`: normativa aplicada (ley, decreto, base aduanera).
- `ratesValidAsOf`: fecha de vigencia de las tasas usadas.
- `sourceModule`: modulo productor para trazabilidad.

Los consumidores deben verificar `ratesValidAsOf` antes de tratar los montos como autoritativos para una fecha actual.

## Notas De Compatibilidad

### v1 -> futuras versiones

- El campo `version` permite detectar la version del contrato.
- Los consumidores deben validar `version` antes de procesar.
- Nuevos campos **opcionales** pueden agregarse sin romper compatibilidad.
- Si un campo requerido cambia o cambia su semantica, crear nueva version (v2).
- Los productores deben incluir `sourceModule` para trazabilidad.

### Tipos de datos

| Tipo | Representacion JSON | Notas |
|------|---------------------|-------|
| Montos | `string` (`"1234.56"`) | Precision decimal, nunca `number` |
| Cantidades en SKU | `number` | Enteros o decimales |
| Fechas | `string` ISO 8601 | `"2026-04-13T15:30:00.000Z"` |
| Dimensiones | `number` en mm | Consistente con Palletizer |
| Pesos | `number` en kg | Consistente con Palletizer |
| Tasas / porcentajes | `string` (`"0.06"`) | Decimales, no porcentajes |

### Flujo de datos

```text
ADEX Palletizer                ALVIN / import_cost_calculator        SisLoPe
      |                                |                              |
      |-- trade-case.v1 ------------->|                              |
      |                                |-- trade-costs.v1 ---------->|
      |-- trade-case.v1 ------------------------------------------>|
```

## Validacion

Librerias recomendadas:

- TypeScript: `ajv`
- Python: `jsonschema`

Reglas:

- Validar `version` antes de procesar.
- Rechazar contratos con campos requeridos faltantes.
- Aceptar campos opcionales nuevos mientras la version sea compatible.
- Crear `v2` si cambia un campo requerido o su semantica.

## Relacion Con Data Trade API

Estos contratos **no** reemplazan a `apps/api`. Cumplen un rol distinto:

| | `apps/api` | `contracts/` |
| --- | --- | --- |
| Que transporta | Identidad, sesiones, eventos, metricas | Datos de negocio (casos, costos) |
| Persistencia | PostgreSQL `data_trade` | Cada modulo decide |
| Acoplamiento | Frontend conoce endpoints REST | Modulos solo conocen el schema JSON |

Un evento o sesion de Data Trade puede referenciar un `caseId`, pero el contenido portable del caso siempre vive en su contrato versionado correspondiente.
