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

## Integracion con SisLoPe

- La cabecera del app incluye el boton `Abrir Sistema Logistico del Peru`.
- Por defecto apunta a:
  - `https://sis-lo-pe.vercel.app`
- Puede sobreescribirse con variable de entorno:

```bash
VITE_SISLOPE_URL=https://sis-lo-pe.vercel.app
```

- La integracion actual es desacoplada y segura: abre SisLoPe en una nueva pestaña sin mezclar el bundle de mapas dentro del palletizer.

## Presets / Scenarios / Share link

- Presets de pallet: `American 1200x1000x150`, `Euro 1200x800x144` y `Custom`.
- Escenarios: guardado local en `localStorage` con comparativa rapida.
- Share link: genera URL con query params (`pL,pW,pH,bPr,bL,bW,bH,maxH,rot,ov,pm,mode`) para reproducir el caso.

## Metricas de area y volumen

- Las vistas de `Caja unica` y `Contenedores` muestran area y volumen en formato dual:
  - principal: `m²` / `m³`
  - referencia: `mm²` / `mm³`
- En `Contenedores` se reportan ambas lecturas de area ocupada:
  - suma de huellas de pallets
  - bloque envolvente ocupado
- Los exports JSON (`Exportar JSON` y `Exportar plan JSON`) incluyen `derivedMetrics` para consumo externo.

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

## Skin 3D de cajas (Box/Sack)

- Selector global `Skin 3D global` en la cabecera del app:
  - `Caja tecnica` (default)
  - `Saco warehouse`
- Aplica de forma consistente en `Caja unica`, `Multiples cajas` y `Contenedores`.
- No cambia el solver ni recalcula resultados: solo cambia la capa visual 3D.
- El valor se conserva al compartir enlace (`skin=box|sack`) y al guardar escenarios.
- El skin `Saco warehouse` usa un modelo 3D real de saco warehouse, normalizado y escalado a las dimensiones configuradas de largo/ancho/alto.

## Contenedores (Sprint 4 + ADEX-29)

- Tab `Contenedores` para calcular carga palletizada dentro de contenedores.
- Presets disponibles: `20' GP`, `40' GP`, `40' HC` y `Custom`.
- Soporta rotacion 0/90 del pallet de carga, limite por payload (opcional) y holgura de separacion:
  - `Holgura` (solo gap pallet-pallet)
- Defaults:
  - `Holgura = 50 mm`
- Puede ejecutarse en:
  - `Homogeneo` (una sola orientacion para todos los pallets)
  - `Alternado por filas` (mezcla 0/90 por fila)
- El objetivo del solver es:
  1. maximizar cantidad de pallets
  2. desempatar por utilizacion de area
- Boton `Use current pallet result` para traer dimensiones desde resultados `single` o `multi`.
- Share link en modo contenedor con parametros:
  - `mode=container`
  - `cPr,cL,cW,cH,ppL,ppW,ppH,cRot,alt,cClr,cRear,wpp,pMax`
  - `cRear` se conserva por compatibilidad historica de links, pero no afecta el solver actual.
- Exports del plan:
  - `Export Plan JSON` (inputs + outputs + placements)
  - `Export Plan PNG` (TopView del contenedor)

Formula base del solver de contenedor (fila homogenea):

- `effectiveL = containerL`
- `effectiveW = containerW`

## DDL de usuarios (base de autenticacion futura)

- Se agrego el script PostgreSQL:
  - `docs/database/001_auth_usuarios_postgres.sql`
- Este DDL crea la tabla `public.usuarios` para profesionalizar el acceso con:
  - `email`
  - `username`
  - `password_hash`
  - `role`
  - `status`
  - trazabilidad basica (`last_login_at`, `last_login_ip`, intentos fallidos, reset de contrasena)
- La contrasena no se almacena en claro:
  - el script usa `pgcrypto` y guarda hash `bcrypt`
- Usuario bootstrap decoy para pruebas futuras de recuperacion de contrasena:
  - `username: admin`
  - `email/identifier: admin`
  - `password inicial: admin`
- Este sprint solo deja preparado el esquema de datos.
- El frontend actual todavia no implementa login real ni recuperacion de contrasena.

## Blueprint de backend

- Documentacion tecnica:
  - `docs/backend/backend-architecture.md`
- Migraciones SQL base:
  - `docs/database/001_auth_usuarios_postgres.sql`
  - `docs/database/002_backend_foundation_postgres.sql`
- El blueprint cubre:
  - autenticacion
  - sesiones
  - recuperacion de contrasena
  - auditoria
  - persistencia de escenarios
  - labels por SKU
  - historial de exports

## Backend auth minimo (Sprint B1)

- Se agrego un backend inicial en:
  - `server/`
- Scripts:
  - `npm run server:start`
  - `npm run server:dev`
  - `npm run server:build`
- Variables de entorno base:
  - `server/.env.example`
- Variable frontend para conectar la SPA con el backend:

```bash
VITE_API_BASE_URL=http://localhost:8787
```
- Endpoints incluidos:
  - `GET /api/health`
  - `POST /api/auth/login`
  - `GET /api/auth/me`
  - `POST /api/auth/refresh`
  - `POST /api/auth/logout`
  - `POST /api/auth/change-password`
- Requiere ejecutar antes:
  - `docs/database/001_auth_usuarios_postgres.sql`
  - `docs/database/002_backend_foundation_postgres.sql`
- Bootstrap actual:
  - `identifier: admin`
  - `password: admin`
- Nota:
  - este backend ya permite arrancar autenticacion real basica con sesiones seguras, pero todavia no incluye email de recuperacion ni CRUD de usuarios.

### Docker Desktop

- Stack local listo para Docker Desktop:
  - `docker-compose.backend.yml`
  - `Dockerfile.backend`
- Levantar PostgreSQL + backend:

```bash
docker compose -f docker-compose.backend.yml up -d --build
```

- Verificar salud:

```bash
curl http://localhost:8787/api/health
curl http://localhost:8787/api/integrations/sislope/health
```

- Login bootstrap:

```json
{
  "identifier": "admin",
  "password": "admin"
}
```

- El endpoint `/api/integrations/sislope/health` permite verificar que la integracion externa con `https://sis-lo-pe.vercel.app` responde sin error.
- `pitchL = palletL + palletGap`
- `pitchW = palletW + palletGap`
- `nx = floor((effectiveL + palletGap) / pitchL)`
- `ny = floor((effectiveW + palletGap) / pitchW)`
- `total = nx * ny`
- warning si `palletH > containerH` (clearance no aplica en altura)

En modo alternado por filas (MVP):

- Se construyen filas `A` (`LxW`) y `B` (`WxL`).
- Se exploran combinaciones deterministas de filas (`A...B...`, `B...A...`, `ABAB...`, `BABA...`).
- Se elige la mejor por:
  1. mayor total de pallets
  2. mayor utilizacion de area
  3. menor residual interno en ancho

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

- Modelo: "Bag" por Quaternius
- Fuente: Poly Pizza
- Licencia: Public Domain (CC0 1.0)
- URL: https://poly.pizza/m/VRfAODZ0Xk

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
