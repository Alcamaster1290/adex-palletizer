# Data Trade - Contratos de Integracion

Contratos JSON versionados para la comunicacion entre modulos del ecosistema Data Trade.

## Regla operativa

Toda integracion entre modulos debe pasar por `caseId` y contratos versionados, no por scraping de UIs ni imports ad hoc.

## Contratos

### trade-case.v1

**Proposito:** Describe un caso comercial de importacion/exportacion.

| Campo | Descripcion |
|-------|-------------|
| **Productor** | ADEX Palletizer |
| **Consumidores** | import_cost_calculator, SisLoPe |
| **Archivo schema** | `trade-case.v1.schema.json` |
| **Ejemplo** | `trade-case.v1.example.json` |

**Campos requeridos:** `version`, `caseId`, `createdAt`, `operationType`, `skus[]`

**Campos opcionales del Palletizer:** `packagingSummary`, `palletSummary`, `containerSummary` - solo presentes cuando el caso fue generado desde ADEX Palletizer con datos de embalaje.

**Compatibilidad con JSON legacy del Palletizer:** El campo `skus[].skuId` mapea a `multiSkuInputs[].skuId` del export actual. El import_cost_calculator mantiene soporte transitorio para el formato legacy.

### trade-costs.v1

**Proposito:** Describe los costos calculados de una operacion.

| Campo | Descripcion |
|-------|-------------|
| **Productor** | import_cost_calculator |
| **Consumidores** | SisLoPe, dashboards, Excel export |
| **Archivo schema** | `trade-costs.v1.schema.json` |
| **Ejemplo** | `trade-costs.v1.example.json` |

**Campos requeridos:** `version`, `caseId`, `currency`, `exchangeRate`, `generatedAt`

**Precision decimal:** Todos los montos se representan como strings (`"25907.20"`) para preservar precision `decimal.Decimal` sin perdida por flotantes IEEE 754.

**Base regulatoria:** El campo `regulatoryBasis` documenta la normativa aplicada y la fecha de vigencia de las tasas. Los consumidores deben verificar `ratesValidAsOf` contra la fecha actual.

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

```
ADEX Palletizer                import_cost_calculator              SisLoPe
      |                                |                              |
      |-- trade-case.v1 ------------->|                              |
      |                                |-- trade-costs.v1 ---------->|
      |-- trade-case.v1 ------------------------------------------>|
```

### Validacion

Se recomienda usar `jsonschema` (Python) o `ajv` (TypeScript) para validar contra los schemas antes de consumir.
