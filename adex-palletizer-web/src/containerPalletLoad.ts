import { buildBoxInstances } from './solver'
import type {
  BoxInstance,
  ExportedPalletBoxPlacement,
  ExportedPalletLoad,
  MultiPreviewInput,
  MultiPreviewResult,
  SolverInput,
  SolverResult,
} from './types'

const DEFAULT_BOX_COLOR = '#2f8f9d'

interface GroupedLoadBoxes {
  lengthMm: number
  widthMm: number
  heightMm: number
  color: string
  skuId?: string
  boxes: ExportedPalletBoxPlacement[]
}

function normalizeColor(color: string | undefined) {
  if (!color) {
    return DEFAULT_BOX_COLOR
  }

  if (/^#[0-9a-fA-F]{6}$/.test(color)) {
    return color
  }

  if (/^[0-9a-fA-F]{6}$/.test(color)) {
    return `#${color}`
  }

  return DEFAULT_BOX_COLOR
}

export function buildExportedPalletLoadFromSingle(
  input: SolverInput,
  result: SolverResult,
  boxesOverride?: BoxInstance[],
): ExportedPalletLoad {
  const sourceBoxes = boxesOverride ?? buildBoxInstances(input, result)
  const boxesPlacements = sourceBoxes.map((box) => ({
    xMm: box.x,
    yMm: box.y - input.pallet.height,
    zMm: box.z,
    lengthMm: box.length,
    widthMm: box.width,
    heightMm: box.height,
    color: box.color,
  }))

  return {
    palletLengthMm: input.pallet.length,
    palletWidthMm: input.pallet.width,
    palletHeightMm: input.pallet.height,
    loadTotalHeightMm: result.totalHeight,
    boxesPlacements,
    source: 'single',
    meta: {
      nx: result.selected.nx,
      ny: result.selected.ny,
      layers: result.layers,
      totalBoxes: result.totalBoxes,
    },
  }
}

export function buildExportedPalletLoadFromMulti(
  input: MultiPreviewInput,
  result: MultiPreviewResult,
): ExportedPalletLoad {
  const boxesPlacements = result.boxes.map((box) => ({
    xMm: box.x,
    yMm: box.y - input.pallet.height,
    zMm: box.z,
    lengthMm: box.length,
    widthMm: box.width,
    heightMm: box.height,
    skuId: box.skuId,
    color: box.color,
  }))

  const topHeightMm =
    boxesPlacements.length > 0
      ? Math.max(
          ...boxesPlacements.map((box) => box.yMm + box.heightMm / 2),
        )
      : 0

  const loadTotalHeightMm = input.pallet.height + Math.max(0, topHeightMm)

  return {
    palletLengthMm: input.pallet.length,
    palletWidthMm: input.pallet.width,
    palletHeightMm: input.pallet.height,
    loadTotalHeightMm,
    boxesPlacements,
    source: 'multi',
    meta: {
      layers: result.layersUsed,
      totalBoxes: result.placedTotal,
    },
  }
}

export function groupLoadBoxesForInstancing(
  boxesPlacements: ExportedPalletBoxPlacement[],
): GroupedLoadBoxes[] {
  const groups = new Map<string, GroupedLoadBoxes>()

  boxesPlacements.forEach((box) => {
    const color = normalizeColor(box.color)
    const key = [
      box.lengthMm,
      box.widthMm,
      box.heightMm,
      color,
      box.skuId ?? '',
    ].join('|')

    const existing = groups.get(key)
    if (existing) {
      existing.boxes.push(box)
      return
    }

    groups.set(key, {
      lengthMm: box.lengthMm,
      widthMm: box.widthMm,
      heightMm: box.heightMm,
      color,
      skuId: box.skuId,
      boxes: [box],
    })
  })

  return Array.from(groups.values())
}
