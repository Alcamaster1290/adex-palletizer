# Contratos de Integracion - ADEX Palletizer

Este modulo **produce** `trade-case.v1`.

## trade-case.v1 (Productor)

Archivo JSON que describe un caso comercial con datos de embalaje, paletizacion y contenedorizacion.

**Campos producidos:**
- `caseId` — UUID generado al momento del export
- `createdAt` — Timestamp ISO 8601
- `operationType` — `"import"` o `"export"`
- `skus[]` — Del multi-SKU input: `skuId`, `name`, `quantity`, `weightKg`, `dimensions`
- `skus[].fobUnitPrice` — Ingresado por el usuario (nuevo campo, default 0)
- `packagingSummary` — Total de cajas, peso bruto, volumen
- `palletSummary` — Pallet spec, pallets requeridos, cajas/pallet, capas, utilizacion
- `containerSummary` — Tipo contenedor, pallets/contenedor, utilizacion area/volumen, peso

**Campos que el usuario completa:**
- `company`, `originCountry`, `destinationCountry`, `incoterm`, `modePreference`

**CTA "Enviar a Costos":**
- Descarga un archivo `trade-case-{caseId}.json` validado contra el schema
- Alternativamente abre import_cost_calculator con el caso pre-cargado

**Schema:** Ver `contracts/trade-case.v1.schema.json` en la raiz del workspace.

## Relacion con export JSON legacy

El export JSON actual (`pallet-layout.json`, `container-plan-*.json`) se mantiene para uso interno del Palletizer. `trade-case.v1` es el formato de handoff entre modulos.

| Campo legacy | Campo trade-case.v1 |
|-------------|---------------------|
| `input.multiSkuInputs[].skuId` | `skus[].skuId` |
| `input.multiSkuInputs[].name` | `skus[].name` |
| `input.multiSkuInputs[].quantity` | `skus[].quantity` |
| `input.multiSkuInputs[].unitWeightKg` | `skus[].weightKg` |
| `input.multiSkuInputs[].{length,width,height}` | `skus[].dimensions` |

## Regla operativa

Toda integracion entre modulos pasa por `caseId` y contratos versionados.
