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

  let occupiedStartLengthMm = result.selected.marginToWall
  let occupiedEndLengthMm = result.selected.marginToWall + result.selected.occupiedLength
  let occupiedStartWidthMm = result.selected.marginToWall
  let occupiedEndWidthMm = result.selected.marginToWall + result.selected.occupiedWidth

  if (result.placements.length > 0) {
    let minLeft = Number.POSITIVE_INFINITY
    let maxRight = Number.NEGATIVE_INFINITY
    let minTop = Number.POSITIVE_INFINITY
    let maxBottom = Number.NEGATIVE_INFINITY

    result.placements.forEach((placement) => {
      const left = placement.x - placement.length / 2 + input.container.length / 2
      const right = placement.x + placement.length / 2 + input.container.length / 2
      const top = placement.z - placement.width / 2 + input.container.width / 2
      const bottom = placement.z + placement.width / 2 + input.container.width / 2
      minLeft = Math.min(minLeft, left)
      maxRight = Math.max(maxRight, right)
      minTop = Math.min(minTop, top)
      maxBottom = Math.max(maxBottom, bottom)
    })

    occupiedStartLengthMm = minLeft
    occupiedEndLengthMm = maxRight
    occupiedStartWidthMm = minTop
    occupiedEndWidthMm = maxBottom
  }

  const occupiedLength = Math.max(0, occupiedEndLengthMm - occupiedStartLengthMm)
  const occupiedWidth = Math.max(0, occupiedEndWidthMm - occupiedStartWidthMm)
  const leadingResidualLength = Math.max(0, occupiedStartLengthMm)
  const trailingResidualLength = Math.max(0, input.container.length - occupiedEndLengthMm)
  const leadingResidualWidth = Math.max(0, occupiedStartWidthMm)
  const trailingResidualWidth = Math.max(0, input.container.width - occupiedEndWidthMm)

  const palletLeft = offsetX
  const palletTop = offsetY
  const palletRight = offsetX + drawLength
  const palletBottom = offsetY + drawWidth
  const occupiedLeft = offsetX + occupiedStartLengthMm * scale
  const occupiedTop = offsetY + occupiedStartWidthMm * scale
  const occupiedRight = offsetX + occupiedEndLengthMm * scale
  const occupiedBottom = offsetY + occupiedEndWidthMm * scale

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
      occupiedLeft,
      occupiedRight,
      palletBottom,
      palletBottom + 24,
      formatMm(occupiedLength),
    ),
    buildVerticalDimension(
      'container-occupied-width',
      occupiedTop,
      occupiedBottom,
      palletRight,
      palletRight + 24,
      formatMm(occupiedWidth),
    ),
  ]

  if (leadingResidualLength > 0) {
    dimensionLines.push(
      buildHorizontalDimension(
        'container-clearance-left',
        palletLeft,
        occupiedLeft,
        palletTop,
        palletTop - 43,
        formatMm(leadingResidualLength),
      ),
    )
  }

  if (trailingResidualLength > 0) {
    dimensionLines.push(
      buildHorizontalDimension(
        'container-clearance-right-wall',
        occupiedRight,
        palletRight,
        palletTop,
        palletTop - 62,
        formatMm(trailingResidualLength),
      ),
    )
  }

  if (leadingResidualWidth > 0) {
    dimensionLines.push(
      buildVerticalDimension(
        'container-clearance-top',
        palletTop,
        occupiedTop,
        palletLeft,
        palletLeft - 43,
        formatMm(leadingResidualWidth),
      ),
    )
  }

  if (trailingResidualWidth > 0) {
    dimensionLines.push(
      buildVerticalDimension(
        'container-clearance-bottom-wall',
        occupiedBottom,
        palletBottom,
        palletLeft,
        palletLeft - 62,
        formatMm(trailingResidualWidth),
      ),
    )
  }

  if (result.selected.trailingResidualLength > 0) {
    const innerRight = palletRight - result.selected.marginToWall * scale
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
    const innerBottom = palletBottom - result.selected.marginToWall * scale
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

  const effectiveGap = Math.max(0, result.selected.pitchLength - result.selected.palletFootprintL)
  if (result.selected.nx > 1 && effectiveGap > 0) {
    const firstGapStart = occupiedLeft + result.selected.palletFootprintL * scale
    const firstGapEnd = firstGapStart + effectiveGap * scale
    dimensionLines.push(
      buildHorizontalDimension(
        'container-gap-length',
        firstGapStart,
        firstGapEnd,
        occupiedTop,
        occupiedTop - 14,
        formatMm(effectiveGap),
      ),
    )
  }

  if (result.selected.ny > 1 && effectiveGap > 0) {
    const firstGapStart = occupiedTop + result.selected.palletFootprintW * scale
    const firstGapEnd = firstGapStart + effectiveGap * scale
    dimensionLines.push(
      buildVerticalDimension(
        'container-gap-width',
        firstGapStart,
        firstGapEnd,
        occupiedLeft,
        occupiedLeft - 14,
        formatMm(effectiveGap),
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
