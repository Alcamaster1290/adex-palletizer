export interface TopViewCell {
  ix: number
  iy: number
}

export interface TopViewGeometry {
  frameWidth: number
  frameHeight: number
  padding: number
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

const FRAME_WIDTH = 640
const FRAME_HEIGHT = 430
const PADDING = 20
const DIMENSION_BAND = 56

const mmFormatter = new Intl.NumberFormat('es-ES', {
  maximumFractionDigits: 0,
})

function formatMm(value: number) {
  return `${mmFormatter.format(value)} mm`
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
    labelY: lineY - 6,
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
    scale,
    drawLength,
    drawWidth,
    offsetX,
    offsetY,
  }
}

export function buildTopViewDimensionLines(
  geometry: TopViewGeometry,
  palletLength: number,
  palletWidth: number,
  occupiedLength: number,
  occupiedWidth: number,
  residualLength: number,
  residualWidth: number,
): TopViewDimensionLine[] {
  const palletLeft = geometry.offsetX
  const palletTop = geometry.offsetY
  const palletRight = geometry.offsetX + geometry.drawLength
  const palletBottom = geometry.offsetY + geometry.drawWidth
  const occupiedRight = geometry.offsetX + occupiedLength * geometry.scale
  const occupiedBottom = geometry.offsetY + occupiedWidth * geometry.scale

  const lines: TopViewDimensionLine[] = [
    buildHorizontalDimension(
      'single-total-length',
      palletLeft,
      palletRight,
      palletTop,
      palletTop - 24,
      formatMm(palletLength),
    ),
    buildVerticalDimension(
      'single-total-width',
      palletTop,
      palletBottom,
      palletLeft,
      palletLeft - 24,
      formatMm(palletWidth),
    ),
    buildHorizontalDimension(
      'single-occupied-length',
      palletLeft,
      occupiedRight,
      palletBottom,
      palletBottom + 24,
      formatMm(occupiedLength),
    ),
    buildVerticalDimension(
      'single-occupied-width',
      palletTop,
      occupiedBottom,
      palletRight,
      palletRight + 24,
      formatMm(occupiedWidth),
    ),
  ]

  if (residualLength > 0) {
    lines.push(
      buildHorizontalDimension(
        'single-residual-length',
        occupiedRight,
        palletRight,
        palletBottom,
        palletBottom + 43,
        formatMm(residualLength),
      ),
    )
  }

  if (residualWidth > 0) {
    lines.push(
      buildVerticalDimension(
        'single-residual-width',
        occupiedBottom,
        palletBottom,
        palletRight,
        palletRight + 43,
        formatMm(residualWidth),
      ),
    )
  }

  return lines
}
