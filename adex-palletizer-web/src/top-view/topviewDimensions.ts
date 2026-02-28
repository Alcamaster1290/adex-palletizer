import type { OrientationPlan } from '../types'

export interface TopViewCell {
  ix: number
  iy: number
}

export interface TopViewGeometry {
  frameWidth: number
  frameHeight: number
  padding: number
  dimensionBand: number
  scale: number
  drawLength: number
  drawWidth: number
  offsetX: number
  offsetY: number
}

export interface TopViewDimensionLine {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
  ex1: number
  ey1: number
  ex2: number
  ey2: number
  ex3: number
  ey3: number
  ex4: number
  ey4: number
  label: string
  labelX: number
  labelY: number
  rotate?: number
}

export interface TopViewLayout {
  geometry: TopViewGeometry
  cells: TopViewCell[]
  occupiedLength: number
  occupiedWidth: number
  occupiedDrawLength: number
  occupiedDrawWidth: number
  residualLength: number
  residualWidth: number
  dimensions: TopViewDimensionLine[]
}

const FRAME_WIDTH = 640
const FRAME_HEIGHT = 430
const PADDING = 20
const DIMENSION_BAND = 56

const mmFormatter = new Intl.NumberFormat('es-ES', {
  maximumFractionDigits: 0,
})
const cmFormatter = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

export function formatDimension(mm: number, showCm = true): string {
  const base = `${mmFormatter.format(mm)} mm`
  if (!showCm) {
    return base
  }

  return `${base} (${cmFormatter.format(mm / 10)} cm)`
}

export function buildTopViewCells(nx: number, ny: number): TopViewCell[] {
  const cells: TopViewCell[] = []
  for (let ix = 0; ix < nx; ix += 1) {
    for (let iy = 0; iy < ny; iy += 1) {
      cells.push({ ix, iy })
    }
  }
  return cells
}

export function buildTopViewGeometry(
  palletLength: number,
  palletWidth: number,
): TopViewGeometry {
  const drawAreaWidth = FRAME_WIDTH - (PADDING + DIMENSION_BAND) * 2
  const drawAreaHeight = FRAME_HEIGHT - (PADDING + DIMENSION_BAND) * 2
  const scale = Math.min(drawAreaWidth / palletLength, drawAreaHeight / palletWidth)
  const drawLength = palletLength * scale
  const drawWidth = palletWidth * scale
  const offsetX = (FRAME_WIDTH - drawLength) / 2
  const offsetY = (FRAME_HEIGHT - drawWidth) / 2

  return {
    frameWidth: FRAME_WIDTH,
    frameHeight: FRAME_HEIGHT,
    padding: PADDING,
    dimensionBand: DIMENSION_BAND,
    scale,
    drawLength,
    drawWidth,
    offsetX,
    offsetY,
  }
}

function buildHorizontalDimension(
  id: string,
  startX: number,
  endX: number,
  referenceY: number,
  lineY: number,
  label: string,
): TopViewDimensionLine {
  return {
    id,
    x1: startX,
    y1: lineY,
    x2: endX,
    y2: lineY,
    ex1: startX,
    ey1: referenceY,
    ex2: startX,
    ey2: lineY,
    ex3: endX,
    ey3: referenceY,
    ex4: endX,
    ey4: lineY,
    label,
    labelX: (startX + endX) / 2,
    labelY: lineY - 7,
  }
}

function buildVerticalDimension(
  id: string,
  startY: number,
  endY: number,
  referenceX: number,
  lineX: number,
  label: string,
): TopViewDimensionLine {
  return {
    id,
    x1: lineX,
    y1: startY,
    x2: lineX,
    y2: endY,
    ex1: referenceX,
    ey1: startY,
    ex2: lineX,
    ey2: startY,
    ex3: referenceX,
    ey3: endY,
    ex4: lineX,
    ey4: endY,
    label,
    labelX: lineX + 12,
    labelY: (startY + endY) / 2,
    rotate: -90,
  }
}

export function buildTopViewLayout(
  palletLength: number,
  palletWidth: number,
  selected: OrientationPlan,
  showCm = true,
): TopViewLayout {
  const geometry = buildTopViewGeometry(palletLength, palletWidth)
  const cells = buildTopViewCells(selected.nx, selected.ny)
  const occupiedLength = Math.min(palletLength, selected.nx * selected.boxFootprintL)
  const occupiedWidth = Math.min(palletWidth, selected.ny * selected.boxFootprintW)
  const occupiedDrawLength = occupiedLength * geometry.scale
  const occupiedDrawWidth = occupiedWidth * geometry.scale
  const residualLength = Math.max(0, palletLength - occupiedLength)
  const residualWidth = Math.max(0, palletWidth - occupiedWidth)

  const palletLeft = geometry.offsetX
  const palletTop = geometry.offsetY
  const palletRight = geometry.offsetX + geometry.drawLength
  const palletBottom = geometry.offsetY + geometry.drawWidth
  const occupiedRight = geometry.offsetX + occupiedDrawLength
  const occupiedBottom = geometry.offsetY + occupiedDrawWidth

  const dimensions: TopViewDimensionLine[] = [
    buildHorizontalDimension(
      'total-length',
      palletLeft,
      palletRight,
      palletTop,
      palletTop - 24,
      formatDimension(palletLength, showCm),
    ),
    buildVerticalDimension(
      'total-width',
      palletTop,
      palletBottom,
      palletLeft,
      palletLeft - 24,
      formatDimension(palletWidth, showCm),
    ),
    buildHorizontalDimension(
      'occupied-length',
      palletLeft,
      occupiedRight,
      palletBottom,
      palletBottom + 24,
      formatDimension(occupiedLength, showCm),
    ),
    buildVerticalDimension(
      'occupied-width',
      palletTop,
      occupiedBottom,
      palletRight,
      palletRight + 24,
      formatDimension(occupiedWidth, showCm),
    ),
  ]

  if (residualLength > 0) {
    dimensions.push(
      buildHorizontalDimension(
        'residual-length',
        occupiedRight,
        palletRight,
        palletBottom,
        palletBottom + 44,
        formatDimension(residualLength, showCm),
      ),
    )
  }

  if (residualWidth > 0) {
    dimensions.push(
      buildVerticalDimension(
        'residual-width',
        occupiedBottom,
        palletBottom,
        palletRight,
        palletRight + 44,
        formatDimension(residualWidth, showCm),
      ),
    )
  }

  return {
    geometry,
    cells,
    occupiedLength,
    occupiedWidth,
    occupiedDrawLength,
    occupiedDrawWidth,
    residualLength,
    residualWidth,
    dimensions,
  }
}
