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

  const occupiedLength = Math.min(
    input.container.length,
    result.selected.nx * result.selected.palletFootprintL,
  )
  const occupiedWidth = Math.min(
    input.container.width,
    result.selected.ny * result.selected.palletFootprintW,
  )

  const palletLeft = offsetX
  const palletTop = offsetY
  const palletRight = offsetX + drawLength
  const palletBottom = offsetY + drawWidth
  const occupiedRight = offsetX + occupiedLength * scale
  const occupiedBottom = offsetY + occupiedWidth * scale

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
      palletLeft,
      occupiedRight,
      palletBottom,
      palletBottom + 24,
      formatMm(occupiedLength),
    ),
    buildVerticalDimension(
      'container-occupied-width',
      palletTop,
      occupiedBottom,
      palletRight,
      palletRight + 24,
      formatMm(occupiedWidth),
    ),
  ]

  if (result.selected.residualLength > 0) {
    dimensionLines.push(
      buildHorizontalDimension(
        'container-residual-length',
        occupiedRight,
        palletRight,
        palletBottom,
        palletBottom + 43,
        formatMm(result.selected.residualLength),
      ),
    )
  }

  if (result.selected.residualWidth > 0) {
    dimensionLines.push(
      buildVerticalDimension(
        'container-residual-width',
        occupiedBottom,
        palletBottom,
        palletRight,
        palletRight + 43,
        formatMm(result.selected.residualWidth),
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
