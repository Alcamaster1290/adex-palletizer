import type {
  ContainerPalletCatalogEntry,
  ExportedPalletBoxPlacement,
  ExportedPalletLoad,
} from './types'

const DEFAULT_PALLET_COLOR = '#2f8f9d'

export function cloneExportedPalletBoxPlacement(
  box: ExportedPalletBoxPlacement,
): ExportedPalletBoxPlacement {
  return {
    xMm: box.xMm,
    yMm: box.yMm,
    zMm: box.zMm,
    lengthMm: box.lengthMm,
    widthMm: box.widthMm,
    heightMm: box.heightMm,
    skuId: box.skuId,
    color: box.color,
  }
}

export function cloneExportedPalletLoad(
  load: ExportedPalletLoad | null | undefined,
): ExportedPalletLoad | null {
  if (!load) {
    return null
  }

  return {
    palletLengthMm: load.palletLengthMm,
    palletWidthMm: load.palletWidthMm,
    palletHeightMm: load.palletHeightMm,
    loadTotalHeightMm: load.loadTotalHeightMm,
    boxesPlacements: load.boxesPlacements.map(cloneExportedPalletBoxPlacement),
    source: load.source,
    meta: load.meta ? { ...load.meta } : undefined,
  }
}

export function cloneContainerPalletCatalogEntry(
  entry: ContainerPalletCatalogEntry,
): ContainerPalletCatalogEntry {
  return {
    id: entry.id,
    name: entry.name,
    source: entry.source,
    quantity: entry.quantity,
    pallet: { ...entry.pallet },
    weightPerPalletKg: entry.weightPerPalletKg,
    load: cloneExportedPalletLoad(entry.load),
    color: entry.color,
  }
}

export function cloneContainerPalletCatalog(
  entries: ContainerPalletCatalogEntry[] | undefined,
): ContainerPalletCatalogEntry[] {
  if (!entries || entries.length === 0) {
    return []
  }

  return entries.map(cloneContainerPalletCatalogEntry)
}

function normalizeColor(color: string | undefined) {
  if (!color) {
    return DEFAULT_PALLET_COLOR
  }

  if (/^#[0-9a-fA-F]{6}$/.test(color)) {
    return color
  }

  if (/^[0-9a-fA-F]{6}$/.test(color)) {
    return `#${color}`
  }

  return DEFAULT_PALLET_COLOR
}

export function detectPalletCatalogColor(
  load: ExportedPalletLoad | null | undefined,
): string {
  if (!load || load.boxesPlacements.length === 0) {
    return DEFAULT_PALLET_COLOR
  }

  const firstBoxWithColor = load.boxesPlacements.find((box) => box.color)
  return normalizeColor(firstBoxWithColor?.color)
}

export function buildContainerPalletCatalogSignature(
  source: 'single' | 'multi',
  load: ExportedPalletLoad | null | undefined,
  weightPerPalletKg?: number,
): string {
  const normalizedLoad = cloneExportedPalletLoad(load)
  const groupedBoxes = (normalizedLoad?.boxesPlacements ?? [])
    .map((box) => ({
      skuId: box.skuId ?? '',
      color: normalizeColor(box.color),
      lengthMm: box.lengthMm,
      widthMm: box.widthMm,
      heightMm: box.heightMm,
      xMm: box.xMm,
      yMm: box.yMm,
      zMm: box.zMm,
    }))
    .sort((left, right) => {
      if (left.skuId !== right.skuId) {
        return left.skuId.localeCompare(right.skuId)
      }
      if (left.lengthMm !== right.lengthMm) {
        return left.lengthMm - right.lengthMm
      }
      if (left.widthMm !== right.widthMm) {
        return left.widthMm - right.widthMm
      }
      if (left.heightMm !== right.heightMm) {
        return left.heightMm - right.heightMm
      }
      if (left.xMm !== right.xMm) {
        return left.xMm - right.xMm
      }
      if (left.yMm !== right.yMm) {
        return left.yMm - right.yMm
      }
      return left.zMm - right.zMm
    })

  return JSON.stringify({
    source,
    palletLengthMm: normalizedLoad?.palletLengthMm ?? 0,
    palletWidthMm: normalizedLoad?.palletWidthMm ?? 0,
    palletHeightMm: normalizedLoad?.palletHeightMm ?? 0,
    loadTotalHeightMm: normalizedLoad?.loadTotalHeightMm ?? 0,
    weightPerPalletKg: weightPerPalletKg ?? null,
    boxes: groupedBoxes,
  })
}
