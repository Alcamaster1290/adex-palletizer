import type { ContainerInput, ContainerResult, PalletPlacement } from '../types'

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

interface PlacementBounds {
  occupiedStartLengthMm: number
  occupiedEndLengthMm: number
  occupiedStartWidthMm: number
  occupiedEndWidthMm: number
}

function getPlacementBounds(
  input: ContainerInput,
  result: ContainerResult,
): PlacementBounds {
  if (result.placements.length === 0) {
    const wall = result.wallClearanceMm
    const rear = result.rearClearanceMm
    const side = result.wallClearanceMm
    return {
      occupiedStartLengthMm: wall,
      occupiedEndLengthMm: Math.max(wall, input.container.length - rear),
      occupiedStartWidthMm: side,
      occupiedEndWidthMm: Math.max(side, input.container.width - side),
    }
  }

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

  return {
    occupiedStartLengthMm: minLeft,
    occupiedEndLengthMm: maxRight,
    occupiedStartWidthMm: minTop,
    occupiedEndWidthMm: maxBottom,
  }
}

function mmToPx(
  offsetX: number,
  offsetY: number,
  scale: number,
  leftMm: number,
  topMm: number,
) {
  return {
    x: offsetX + leftMm * scale,
    y: offsetY + topMm * scale,
  }
}

function resolveHorizontalGap(
  placements: PalletPlacement[],
  containerLength: number,
  containerWidth: number,
): { gapMm: number; startMm: number; endMm: number; rowTopMm: number } | null {
  if (placements.length < 2) {
    return null
  }

  const rows = new Map<string, Array<{ left: number; right: number; top: number }>>()
  placements.forEach((placement) => {
    const left = placement.x - placement.length / 2 + containerLength / 2
    const right = placement.x + placement.length / 2 + containerLength / 2
    const top = placement.z - placement.width / 2 + containerWidth / 2
    const key = top.toFixed(3)
    if (!rows.has(key)) {
      rows.set(key, [])
    }
    rows.get(key)?.push({ left, right, top })
  })

  for (const row of rows.values()) {
    const ordered = [...row].sort((left, right) => left.left - right.left)
    for (let index = 0; index < ordered.length - 1; index += 1) {
      const gapMm = ordered[index + 1].left - ordered[index].right
      if (gapMm > 0.5) {
        return {
          gapMm,
          startMm: ordered[index].right,
          endMm: ordered[index + 1].left,
          rowTopMm: ordered[index].top,
        }
      }
    }
  }

  return null
}

function resolveVerticalGap(
  placements: PalletPlacement[],
  containerLength: number,
  containerWidth: number,
): { gapMm: number; startMm: number; endMm: number; columnLeftMm: number } | null {
  if (placements.length < 2) {
    return null
  }

  const columns = new Map<string, Array<{ top: number; bottom: number; left: number }>>()
  placements.forEach((placement) => {
    const top = placement.z - placement.width / 2 + containerWidth / 2
    const bottom = placement.z + placement.width / 2 + containerWidth / 2
    const left = placement.x - placement.length / 2 + containerLength / 2
    const key = left.toFixed(3)
    if (!columns.has(key)) {
      columns.set(key, [])
    }
    columns.get(key)?.push({ top, bottom, left })
  })

  for (const column of columns.values()) {
    const ordered = [...column].sort((left, right) => left.top - right.top)
    for (let index = 0; index < ordered.length - 1; index += 1) {
      const gapMm = ordered[index + 1].top - ordered[index].bottom
      if (gapMm > 0.5) {
        return {
          gapMm,
          startMm: ordered[index].bottom,
          endMm: ordered[index + 1].top,
          columnLeftMm: ordered[index].left,
        }
      }
    }
  }

  return null
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

  const bounds = getPlacementBounds(input, result)
  const occupiedLength = Math.max(0, bounds.occupiedEndLengthMm - bounds.occupiedStartLengthMm)
  const occupiedWidth = Math.max(0, bounds.occupiedEndWidthMm - bounds.occupiedStartWidthMm)
  const trailingResidualLength = Math.max(0, input.container.length - bounds.occupiedEndLengthMm)
  const leadingResidualWidth = Math.max(0, bounds.occupiedStartWidthMm)
  const trailingResidualWidth = Math.max(0, input.container.width - bounds.occupiedEndWidthMm)

  const palletLeft = offsetX
  const palletTop = offsetY
  const palletRight = offsetX + drawLength
  const palletBottom = offsetY + drawWidth
  const occupiedLeft = offsetX + bounds.occupiedStartLengthMm * scale
  const occupiedTop = offsetY + bounds.occupiedStartWidthMm * scale
  const occupiedRight = offsetX + bounds.occupiedEndLengthMm * scale
  const occupiedBottom = offsetY + bounds.occupiedEndWidthMm * scale

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

  const frontClearancePx = result.wallClearanceMm * scale
  const rearClearancePx = result.rearClearanceMm * scale
  const sideClearancePx = result.wallClearanceMm * scale

  if (result.wallClearanceMm > 0) {
    dimensionLines.push(
      buildHorizontalDimension(
        'container-clearance-front',
        palletLeft,
        palletLeft + frontClearancePx,
        palletTop,
        palletTop - 43,
        formatMm(result.wallClearanceMm),
      ),
    )
  }

  if (result.rearClearanceMm > 0) {
    dimensionLines.push(
      buildHorizontalDimension(
        'container-clearance-rear',
        palletRight - rearClearancePx,
        palletRight,
        palletTop,
        palletTop - 62,
        formatMm(result.rearClearanceMm),
      ),
    )
  }

  if (result.wallClearanceMm > 0) {
    dimensionLines.push(
      buildVerticalDimension(
        'container-clearance-top',
        palletTop,
        palletTop + sideClearancePx,
        palletLeft,
        palletLeft - 43,
        formatMm(result.wallClearanceMm),
      ),
      buildVerticalDimension(
        'container-clearance-bottom',
        palletBottom - sideClearancePx,
        palletBottom,
        palletLeft,
        palletLeft - 62,
        formatMm(result.wallClearanceMm),
      ),
    )
  }

  const residualRear = Math.max(0, trailingResidualLength - result.rearClearanceMm)
  const residualSideTop = Math.max(0, leadingResidualWidth - result.wallClearanceMm)
  const residualSideBottom = Math.max(0, trailingResidualWidth - result.wallClearanceMm)

  if (residualRear > 0) {
    const start = occupiedRight
    const end = occupiedRight + residualRear * scale
    dimensionLines.push(
      buildHorizontalDimension(
        'container-residual-rear',
        start,
        end,
        palletBottom,
        palletBottom + 43,
        formatMm(residualRear),
      ),
    )
  }

  if (residualSideTop > 0) {
    const start = palletTop + result.wallClearanceMm * scale
    const end = start + residualSideTop * scale
    dimensionLines.push(
      buildVerticalDimension(
        'container-residual-top',
        start,
        end,
        palletRight,
        palletRight + 43,
        formatMm(residualSideTop),
      ),
    )
  }

  if (residualSideBottom > 0) {
    const end = palletBottom - result.wallClearanceMm * scale
    const start = end - residualSideBottom * scale
    dimensionLines.push(
      buildVerticalDimension(
        'container-residual-bottom',
        start,
        end,
        palletRight,
        palletRight + 62,
        formatMm(residualSideBottom),
      ),
    )
  }

  const horizontalGap = resolveHorizontalGap(
    result.placements,
    input.container.length,
    input.container.width,
  )
  if (horizontalGap) {
    const startPoint = mmToPx(
      offsetX,
      offsetY,
      scale,
      horizontalGap.startMm,
      horizontalGap.rowTopMm,
    )
    const endPoint = mmToPx(
      offsetX,
      offsetY,
      scale,
      horizontalGap.endMm,
      horizontalGap.rowTopMm,
    )
    dimensionLines.push(
      buildHorizontalDimension(
        'container-gap-horizontal',
        startPoint.x,
        endPoint.x,
        startPoint.y,
        startPoint.y - 14,
        formatMm(horizontalGap.gapMm),
      ),
    )
  }

  const verticalGap = resolveVerticalGap(
    result.placements,
    input.container.length,
    input.container.width,
  )
  if (verticalGap) {
    const startPoint = mmToPx(
      offsetX,
      offsetY,
      scale,
      verticalGap.columnLeftMm,
      verticalGap.startMm,
    )
    const endPoint = mmToPx(
      offsetX,
      offsetY,
      scale,
      verticalGap.columnLeftMm,
      verticalGap.endMm,
    )
    dimensionLines.push(
      buildVerticalDimension(
        'container-gap-vertical',
        startPoint.y,
        endPoint.y,
        startPoint.x,
        startPoint.x - 14,
        formatMm(verticalGap.gapMm),
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
