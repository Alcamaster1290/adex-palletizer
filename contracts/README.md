# Data Trade - Contratos de Integracion

Contratos JSON versionados para la comunicacion entre modulos del ecosistema Data Trade.

Estos contratos no reemplazan las funcionalidades propias de ADEX Palletizer, ALVIN o SisLoPe. Su objetivo es permitir que cada proyecto intercambie casos y resultados sin acoplar UIs, scripts internos o estructuras de carpetas.

## Regla operativa

Toda integracion entre modulos debe pasar por `caseId` y contratos versionados, no por scraping de UIs ni imports ad hoc.

## Contratos

| Contrato | Productor principal | Consumidores esperados | Archivos |
| --- | --- | --- | --- |
| `trade-case.v1` | ADEX Palletizer | ALVIN / import_cost_calculator, SisLoPe, futuros ETL | `trade-case.v1.schema.json`, `trade-case.v1.example.json` |
| `trade-costs.v1` | ALVIN / import_cost_calculator | SisLoPe, dashboards, Excel export, futuros ETL | `trade-costs.v1.schema.json`, `trade-costs.v1.example.json` |

### trade-case.v1

**Proposito:** Describe un caso comercial de importacion/exportacion.

| Campo | Descripcion |
|-------|-------------|
| **Productor** | ADEX Palletizer |
| **Consumidores** | ALVIN / import_cost_calculator, SisLoPe |
| **Archivo schema** | `trade-case.v1.schema.json` |
| **Ejemplo** | `trade-case.v1.example.json` |

Campos requeridos:

- `version`
- `caseId`
- `createdAt`
- `operationType`
- `skus[]`

Campos opcionales del Palletizer:

- `sourceModule`
- `packagingSummary`
- `palletSummary`
- `containerSummary`

Estos campos solo estan presentes cuando el caso fue generado desde ADEX Palletizer con datos de embalaje, palletizacion o contenedor.

Compatibilidad con JSON legacy del Palletizer:

- `skus[].skuId` mapea a `multiSkuInputs[].skuId` del export actual.
- ALVIN / import_cost_calculator mantiene soporte transitorio para el formato legacy.
- Los consumidores deben tolerar campos opcionales nuevos dentro de `v1`.

### trade-costs.v1

**Proposito:** Describe los costos calculados de una operacion.

| Campo | Descripcion |
|-------|-------------|
| **Productor** | ALVIN / import_cost_calculator |
| **Consumidores** | SisLoPe, dashboards, Excel export |
| **Archivo schema** | `trade-costs.v1.schema.json` |
| **Ejemplo** | `trade-costs.v1.example.json` |

Campos requeridos:

- `version`
- `caseId`
- `currency`
- `exchangeRate`
- `generatedAt`

Precision decimal:

- Todos los montos se representan como strings (`"25907.20"`) para preservar precision `decimal.Decimal` sin perdida por flotantes IEEE 754.
- No convertir montos a `number` si se requiere precision contable o conciliacion con Excel.

Base regulatoria:

- `regulatoryBasis`
- `ratesValidAsOf`
- `sourceModule`

El campo `regulatoryBasis` documenta la normativa aplicada y la fecha de vigencia de las tasas. Los consumidores deben verificar `ratesValidAsOf` contra la fecha actual.

## Notas de compatibilidad

### v1 -> futuras versiones

- El campo `version` permite detectar la version del contrato.
- Los consumidores deben validar `version` antes de procesar.
- Nuevos campos opcionales pueden agregarse sin romper compatibilidad.
- Si un campo requerido cambia, se debe crear una nueva version (v2).
- Los productores deben incluir `sourceModule` para trazabilidad.

### Tipos de datos

| Tipo | Representacion JSON | Notas |
|------|---------------------|-------|
| Montos | `string` (`"1234.56"`) | Precision decimal, nunca `number` |
| Cantidades en SKU | `number` | Enteros o decimales |
| Fechas | `string` ISO 8601 | `"2026-04-13T15:30:00.000Z"` |
| Dimensiones | `number` en mm | Consistente con Palletizer |
| Pesos | `number` en kg | Consistente con Palletizer |
| Tasas/Porcentajes | `string` (`"0.06"`) | Decimales, no porcentajes |

### Flujo de datos

```text
ADEX Palletizer                ALVIN / import_cost_calculator        SisLoPe
      |                                |                              |
      |-- trade-case.v1 ------------->|                              |
      |                                |-- trade-costs.v1 ---------->|
      |-- trade-case.v1 ------------------------------------------>|
```

## Validacion

Consumidores recomendados:

- TypeScript: `ajv`
- Python: `jsonschema`

Reglas:

- Validar `version` antes de procesar.
- Rechazar contratos con campos requeridos faltantes.
- Aceptar campos opcionales nuevos mientras la version sea compatible.
- Crear `v2` si cambia un campo requerido o su semantica.

## Relacion con Data Trade API

Estos contratos no reemplazan al backend `apps/api`. Cumplen un rol distinto:

- `apps/api`: identidad, sesiones, modulos, eventos, metricas y admin.
- `contracts`: intercambio de casos y resultados entre modulos de negocio.

Un evento o sesion de Data Trade puede referenciar un `caseId`, pero el contenido portable del caso debe seguir viviendo en el contrato versionado correspondiente.
