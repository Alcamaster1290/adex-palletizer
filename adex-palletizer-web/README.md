# adex-palletizer-web

Aplicacion web para calcular y visualizar unitarizacion homogenea caja master -> pallet, con render 3D interactivo.

## Requisitos

- Node.js 22+
- npm 10+

## Instalacion y ejecucion

```bash
npm install
npm run dev
```

## Scripts disponibles

```bash
npm run test
npm run build
npm run preview
```

## Presets / Scenarios / Share link

- Presets de pallet: `American 1200x1000x150`, `Euro 1200x800x144` y `Custom`.
- Escenarios: guardado local en `localStorage` con comparativa rapida.
- Share link: genera URL con query params (`pL,pW,pH,bPr,bL,bW,bH,maxH,rot,ov,pm,mode`) para reproducir el caso.

## Presets de Caja Maestra

- Disponible en `Caja unica` con selector `Preset de caja maestra`.
- Presets incluidos:
  - `Standard 600x400x200` (default)
  - `Standard 500x350x450`
  - `Euronorm 400x300x240`
  - `Compact 360x260x220`
  - `Custom`
- Si editas manualmente largo/ancho/alto, el preset cambia automaticamente a `Custom`.
- Validacion tecnica de dimensiones en caja unica: minimo `50 mm`.

## Label Designer por SKU (MVP)

- Permite crear una etiqueta por SKU con plantilla 2D y aplicarla como textura en 3D.
- UI:
  - `Caja unica`: boton lapiz sobre el visor (`Editar caja maestra`).
  - `Multiples cajas`: boton `Editar caja (SKU)` junto a `Limpiar`.
- Editor incluye:
  - Plantilla (`Minimal`, `Export`, `Retail`)
  - Shipping marks (`CONSIGNEE`, `DESTINATION`, `SKU/PRODUCT`, `LOT`, `CARTON NO`)
  - Pictogramas ISO 780 base (This Side Up, Fragile, Keep Dry, Keep Away From Heat)
  - Preview 2D en canvas
- Persistencia local:
  - Key: `adexPalletizer.skuLabels.v1`
- Integracion 3D:
  - Se aplica una textura por SKU y se mantiene el flujo de instancing en contenedores.
- Export JSON:
  - Incluye `labelsBySku` cuando existe.

## Container loading (Sprint 4)

- Nuevo tab `Container loading` para calcular pallets homogeneos dentro de contenedores.
- Presets disponibles: `20' GP`, `40' GP`, `40' HC` y `Custom`.
- Soporta rotacion 0/90 del pallet de carga, clearance y limite por payload (opcional).
- `Clearance` por defecto y minimo: `50 mm` (editable hacia arriba). Se aplica en planta:
  - margen minimo a paredes (4 lados)
  - separacion minima pallet-pallet
- Boton `Use current pallet result` para traer dimensiones desde resultados `single` o `multi`.
- Share link en modo contenedor con parametros:
  - `mode=container`
  - `cPr,cL,cW,cH,ppL,ppW,ppH,cRot,cClr,wpp,pMax`
- Exports del plan:
  - `Export Plan JSON` (inputs + outputs + placements)
  - `Export Plan PNG` (TopView del contenedor)

Formula base del solver de contenedor:

- `effectiveL = containerL - 2*clearance`
- `effectiveW = containerW - 2*clearance`
- `pitchL = palletL + clearance`
- `pitchW = palletW + clearance`
- `nx = floor((effectiveL + clearance) / pitchL)`
- `ny = floor((effectiveW + clearance) / pitchW)`
- `total = nx * ny`
- desempate por mayor utilizacion de area
- warning si `palletH > containerH` (clearance no aplica en altura)

## Modo multi (Sprint 3)

- `Generar 3D`: crea un **preview determinista** por filas/columnas/capas usando la lista de SKUs.
- `Solve (heuristic)`: ejecuta heuristica **First-Fit Decreasing por capas** con free-rectangles para mejorar ubicacion.
- Restricciones por SKU:
  - `allowRotation`
  - `maxLayers`
  - `noStack` (solo capa 0)

### Ejemplo rapido multi

1. Ir a tab `Multiples cajas`.
2. Agregar SKUs con `Add SKU` y completar `skuId`, dimensiones y `quantity`.
3. Ejecutar `Generar 3D` para preview base.
4. Ejecutar `Solve (heuristic)` para intentar mejor aprovechamiento.
5. Guardar con `Save scenario` para comparar resultados.

## Grid vs Advanced (Caja unica)

- `Advanced` (modo estandar cuando `Grid` deja area libre): usa packing mixed-orientation por item (0/90) con `free-rectangles` y heuristic `bestShortSideFit`.
- `Grid`: usa una orientacion global por capa (`LxW` o `WxL`) y calcula `nx x ny`.
- Cuándo usar cada uno:
  - `Grid`: resultados rapidos y comparables con el metodo clasico de capas uniformes.
  - `Advanced`: cuando quieres maximizar aprovechamiento en planta mezclando orientaciones dentro de la misma capa.
- Share link para `single` agrega `pm`:
  - `pm=advanced`
  - `pm=grid`

## Deploy en Vercel

Este proyecto esta preparado para desplegarse como app Vite estatica en Vercel.

1. Importa el repositorio en Vercel.
2. Si el repo contiene esta app dentro de una subcarpeta (ejemplo: `adex-palletizer-web/`), usa el `vercel.json` de la raiz para build automatico sin cambiar Root Directory.
3. Si prefieres configurar por dashboard, en Project Settings -> Root Directory selecciona `adex-palletizer-web`.
4. Verifica (o deja por defecto) estos valores:
   - Install Command: `npm install`
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. Deploy.

Notas:

- Existe `vercel.json` con configuracion para Vite y rewrite SPA a `index.html`.
- Se recomienda Node `>=20.19.0` (definido en `package.json`).

## Modelo 3D del pallet (reemplazable)

La app carga un modelo GLB desde:

- `public/models/pallet.glb`

El modelo se ajusta automaticamente a las dimensiones de pallet configuradas en UI (`length/width/height`), por lo que puedes cambiarlo solo reemplazando ese archivo.

Si el modelo tarda en cargar, se muestra un pallet de respaldo en forma de bloque.

### Atribucion del modelo incluido

- Modelo: "Wooden Pallet" por J-Toastie
- Fuente: Poly Pizza
- Licencia: CC BY 3.0
- URL: https://poly.pizza/m/XSKlcrzyi6

## Logica de calculo (resumen)

Se evaluan orientaciones:

- A: `boxL x boxW`
- B: `boxW x boxL` (si `allowRotation=true`)

Para cada orientacion:

- `nx = floor((palletL + overhang) / boxL)`
- `ny = floor((palletW + overhang) / boxW)`
- `perLayer = nx * ny`
- `util = ((nx*boxL)*(ny*boxW)) / (palletL*palletW)`

Se elige la orientacion por:

1. Mayor `perLayer`
2. Empate: mayor `util`

Capas y totales:

- `available = maxTotalHeight - palletHeight`
- `layers = floor(available / boxH)` si `available > 0`, si no `layers = 0`
- `totalBoxes = perLayer * layers`
- `totalHeight = palletHeight + layers * boxH`

Validacion clave:

- Si `maxTotalHeight <= palletHeight`, se muestra error y `layers = 0`.

## Caso de aceptacion

Entrada:

- Pallet: `1200 x 1000 x 150`
- Caja: `500 x 350 x 450`
- `maxTotalHeight = 1200`
- `allowRotation = true`
- `overhang = 0`

Salida esperada:

- `nx = 3`
- `ny = 2`
- `perLayer = 6`
- `layers = 2`
- `totalBoxes = 12`
- `totalHeight = 1050 mm`
