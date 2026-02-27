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
