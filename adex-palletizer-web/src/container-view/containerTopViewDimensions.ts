import type { ContainerInput, ContainerResult } from '../types'

interface DimensionLine {
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

export interface ContainerTopViewGeometry {
  frameWidth: number
  frameHeight: number
  scale: number
  drawLength: number
  drawWidth: number
  offsetX: number
  offsetY: number
  dimensionLines: DimensionLine[]
}

const FRAME_WIDTH = 640
const FRAME_HEIGHT = 390
const PADDING = 18
const DIMENSION_BAND = 52

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
): DimensionLine {
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
): DimensionLine {
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

export function buildContainerTopViewGeometry(
  input: ContainerInput,
  result: ContainerResult,
): ContainerTopViewGeometry {
  const drawAreaWidth = FRAME_WIDTH - (PADDING + DIMENSION_BAND) * 2
  const drawAreaHeight = FRAME_HEIGHT - (PADDING + DIMENSION_BAND) * 2
  const scale = Math.min(
    drawAreaWidth / input.container.length,
    drawAreaHeight / input.container.width,
  )
  const drawLength = input.container.length * scale
  const drawWidth = input.container.width * scale
  const offsetX = (FRAME_WIDTH - drawLength) / 2
  const offsetY = (FRAME_HEIGHT - drawWidth) / 2

  const marginToWall = result.selected.marginToWall
  const occupiedLength = Math.min(input.container.length, result.selected.occupiedLength)
  const occupiedWidth = Math.min(input.container.width, result.selected.occupiedWidth)

  const palletLeft = offsetX
  const palletTop = offsetY
  const palletRight = offsetX + drawLength
  const palletBottom = offsetY + drawWidth
  const innerLeft = palletLeft + marginToWall * scale
  const innerTop = palletTop + marginToWall * scale
  const innerRight = palletRight - marginToWall * scale
  const innerBottom = palletBottom - marginToWall * scale
  const occupiedRight = innerLeft + occupiedLength * scale
  const occupiedBottom = innerTop + occupiedWidth * scale

  const dimensionLines: DimensionLine[] = [
    buildHorizontalDimension(
      'container-total-length',
      palletLeft,
      palletRight,
      palletTop,
      palletTop - 24,
      formatMm(input.container.length),
    ),
    buildVerticalDimension(
      'container-total-width',
      palletTop,
      palletBottom,
      palletLeft,
      palletLeft - 24,
      formatMm(input.container.width),
    ),
    buildHorizontalDimension(
      'container-occupied-length',
      innerLeft,
      occupiedRight,
      palletBottom,
      palletBottom + 24,
      formatMm(occupiedLength),
    ),
    buildVerticalDimension(
      'container-occupied-width',
      innerTop,
      occupiedBottom,
      palletRight,
      palletRight + 24,
      formatMm(occupiedWidth),
    ),
  ]

  if (marginToWall > 0) {
    dimensionLines.push(
      buildHorizontalDimension(
        'container-clearance-left',
        palletLeft,
        innerLeft,
        palletTop,
        palletTop - 43,
        formatMm(marginToWall),
      ),
      buildHorizontalDimension(
        'container-clearance-right-wall',
        innerRight,
        palletRight,
        palletTop,
        palletTop - 62,
        formatMm(marginToWall),
      ),
      buildVerticalDimension(
        'container-clearance-top',
        palletTop,
        innerTop,
        palletLeft,
        palletLeft - 43,
        formatMm(marginToWall),
      ),
      buildVerticalDimension(
        'container-clearance-bottom-wall',
        innerBottom,
        palletBottom,
        palletLeft,
        palletLeft - 62,
        formatMm(marginToWall),
      ),
    )
  }

  if (result.selected.trailingResidualLength > 0) {
    dimensionLines.push(
      buildHorizontalDimension(
        'container-residual-length',
        occupiedRight,
        innerRight,
        palletBottom,
        palletBottom + 43,
        formatMm(result.selected.trailingResidualLength),
      ),
    )
  }

  if (result.selected.trailingResidualWidth > 0) {
    dimensionLines.push(
      buildVerticalDimension(
        'container-residual-width',
        occupiedBottom,
        innerBottom,
        palletRight,
        palletRight + 43,
        formatMm(result.selected.trailingResidualWidth),
      ),
    )
  }

  if (result.selected.nx > 1 && input.clearance > 0) {
    const firstGapStart = innerLeft + result.selected.palletFootprintL * scale
    const firstGapEnd = firstGapStart + input.clearance * scale
    dimensionLines.push(
      buildHorizontalDimension(
        'container-gap-length',
        firstGapStart,
        firstGapEnd,
        innerTop,
        innerTop - 14,
        formatMm(input.clearance),
      ),
    )
  }

  if (result.selected.ny > 1 && input.clearance > 0) {
    const firstGapStart = innerTop + result.selected.palletFootprintW * scale
    const firstGapEnd = firstGapStart + input.clearance * scale
    dimensionLines.push(
      buildVerticalDimension(
        'container-gap-width',
        firstGapStart,
        firstGapEnd,
        innerLeft,
        innerLeft - 14,
        formatMm(input.clearance),
      ),
    )
  }

  return {
    frameWidth: FRAME_WIDTH,
    frameHeight: FRAME_HEIGHT,
    scale,
    drawLength,
    drawWidth,
    offsetX,
    offsetY,
    dimensionLines,
  }
}
