import { rectPack2d } from './rectPack2d'
import type {
  BoxInstance,
  MultiPreviewInput,
  MultiPreviewResult,
  MultiSkuInput,
  MultiTypePlacementSummary,
  RectPackPlacement,
} from './types'

function normalizeColumnValue(value: number) {
  return Number(value.toFixed(4))
}

function buildColumnSignature(box: BoxInstance) {
  const x = normalizeColumnValue(box.x)
  const z = normalizeColumnValue(box.z)
  const length = normalizeColumnValue(box.length)
  const width = normalizeColumnValue(box.width)
  return `${x}|${z}|${length}|${width}`
}

interface PreparedSku {
  sku: MultiSkuInput
  skuId: string
  skuName: string
  color: string
  stackPerColumn: number
  columnsNeeded: number
  columnsAssigned: number
  value: number
  canRotate: boolean
  limitedByVerticalRules: boolean
  baseFits: boolean
  unplaceable: number
}

interface ColumnItem {
  id: string
  skuId: string
  w: number
  h: number
  canRotate: boolean
  color: string
}

const isPositive = (value: number) => Number.isFinite(value) && value > 0

function sanitize(value: string, fallback: string) {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : fallback
}

function validateInput(input: MultiPreviewInput): string[] {
  const errors: string[] = []

  if (!isPositive(input.pallet.length)) {
    errors.push('El largo del pallet debe ser mayor a 0.')
  }
  if (!isPositive(input.pallet.width)) {
    errors.push('El ancho del pallet debe ser mayor a 0.')
  }
  if (!isPositive(input.pallet.height)) {
    errors.push('El alto del pallet debe ser mayor a 0.')
  }
  if (!isPositive(input.maxTotalHeight)) {
    errors.push('La altura total maxima debe ser mayor a 0.')
  }
  if (!Number.isFinite(input.overhang) || input.overhang < 0) {
    errors.push('El overhang no puede ser negativo.')
  }

  input.skus.forEach((sku, index) => {
    if (!isPositive(sku.length) || !isPositive(sku.width) || !isPositive(sku.height)) {
      errors.push(`SKU ${index + 1}: dimensiones invalidas.`)
    }
    if (!Number.isInteger(sku.quantity) || sku.quantity < 1) {
      errors.push(`SKU ${index + 1}: quantity debe ser entero mayor o igual a 1.`)
    }
  })

  if (input.skus.length === 0) {
    errors.push('Debe existir al menos un SKU para resolver el pallet multicaja.')
  }

  return errors
}

function emptyResult(errors: string[]): MultiPreviewResult {
  return {
    algorithm: 'heuristic',
    solverVariant: 'heuristic-columns',
    boxes: [],
    bySku: [],
    placedBySku: {},
    unplacedBySku: {},
    columnsBySku: {},
    layersUsedBySku: {},
    requestedTotal: 0,
    placedTotal: 0,
    unplacedTotal: 0,
    unplaceableTotal: 0,
    totalPlaced: 0,
    totalUnplaced: 0,
    layersUsed: 0,
    utilization: 0,
    availableHeight: 0,
    heightUsed: 0,
    heightFree: 0,
    errors,
    warnings: [],
  }
}

function buildOrientationOptions(sku: MultiSkuInput, allowRotation: boolean) {
  const options = [{ length: sku.length, width: sku.width }]
  if (allowRotation && sku.allowRotation && sku.length !== sku.width) {
    options.push({ length: sku.width, width: sku.length })
  }
  return options
}

function canFitInBase(
  sku: MultiSkuInput,
  palletLength: number,
  palletWidth: number,
  allowRotation: boolean,
) {
  return buildOrientationOptions(sku, allowRotation).some(
    (option) => option.length <= palletLength && option.width <= palletWidth,
  )
}

function resolveSkuColor(rawColor: string | undefined) {
  if (!rawColor) {
    return '#2f8f9d'
  }
  if (/^#[0-9a-fA-F]{6}$/.test(rawColor)) {
    return rawColor
  }
  if (/^[0-9a-fA-F]{6}$/.test(rawColor)) {
    return `#${rawColor}`
  }
  return '#2f8f9d'
}

function buildSummary(
  input: MultiPreviewInput,
  placedBySku: Record<string, number>,
  unplacedBySku: Record<string, number>,
  unplaceableBySku: Record<string, number>,
  rotationsBySku: Record<string, number>,
  layersBySku: Map<string, Set<number>>,
): MultiTypePlacementSummary[] {
  return input.skus.map((sku, index) => {
    const skuId = sanitize(sku.skuId, `SKU-${sku.id}`)
    const placed = placedBySku[skuId] ?? 0
    const unplaced = unplacedBySku[skuId] ?? 0
    const unplaceable = unplaceableBySku[skuId] ?? 0
    const layersUsed = layersBySku.get(skuId)?.size ?? 0

    return {
      id: sku.id,
      skuId,
      name: sanitize(sku.name, `SKU ${index + 1}`),
      requested: sku.quantity,
      placed,
      unplaced,
      unplaceable,
      layersUsed,
      rotationsUsed: rotationsBySku[skuId] ?? 0,
      color: resolveSkuColor(sku.color),
    }
  })
}

function buildColumns(preparedSkus: PreparedSku[]): ColumnItem[] {
  const columns: ColumnItem[] = []
  preparedSkus.forEach((prepared) => {
    for (let index = 0; index < prepared.columnsAssigned; index += 1) {
      columns.push({
        id: `${prepared.skuId}::${index + 1}`,
        skuId: prepared.skuId,
        w: prepared.sku.length,
        h: prepared.sku.width,
        canRotate: prepared.canRotate,
        color: prepared.color,
      })
    }
  })
  return columns
}

function sortByPriority(preparedSkus: PreparedSku[]) {
  return [...preparedSkus].sort((left, right) => {
    if (right.value !== left.value) {
      return right.value - left.value
    }
    return left.skuId.localeCompare(right.skuId)
  })
}

function runColumnPacking(
  palletLength: number,
  palletWidth: number,
  columns: ColumnItem[],
) {
  return rectPack2d(
    palletLength,
    palletWidth,
    columns.map((column) => ({
      id: column.id,
      skuId: column.skuId,
      w: column.w,
      h: column.h,
      canRotate: column.canRotate,
      color: column.color,
    })),
  )
}

export function assertNoMixedColumns(boxes: BoxInstance[]) {
  const skuByColumn = new Map<string, string>()

  boxes.forEach((box) => {
    const skuId = box.skuId ?? ''
    const key = buildColumnSignature(box)
    const current = skuByColumn.get(key)
    if (!current) {
      skuByColumn.set(key, skuId)
      return
    }
    if (current !== skuId) {
      throw new Error(
        `Mezcla de SKU detectada en columna ${key}: ${current} vs ${skuId}`,
      )
    }
  })
}

export function solveMultiHeuristicNoMix(input: MultiPreviewInput): MultiPreviewResult {
  const errors = validateInput(input)
  if (errors.length > 0) {
    return emptyResult(errors)
  }

  const warnings: string[] = []
  const availableHeight = Math.max(0, input.maxTotalHeight - input.pallet.height)
  const palletLength = input.pallet.length + input.overhang
  const palletWidth = input.pallet.width + input.overhang

  const placedBySku: Record<string, number> = {}
  const unplacedBySku: Record<string, number> = {}
  const unplaceableBySku: Record<string, number> = {}
  const columnsBySku: Record<string, number> = {}
  const layersUsedBySku: Record<string, number> = {}
  const rotationsBySku: Record<string, number> = {}
  const layersBySku = new Map<string, Set<number>>()

  const preparedSkus: PreparedSku[] = []
  let requestedTotal = 0
  let unplaceableTotal = 0
  let limitedByVerticalRules = false

  input.skus.forEach((sku, index) => {
    const skuId = sanitize(sku.skuId, `SKU-${sku.id}`)
    const skuName = sanitize(sku.name, `SKU ${index + 1}`)
    const color = resolveSkuColor(sku.color)
    const baseFits = canFitInBase(sku, palletLength, palletWidth, input.allowRotation)

    requestedTotal += sku.quantity
    placedBySku[skuId] = 0
    unplacedBySku[skuId] = sku.quantity
    unplaceableBySku[skuId] = 0
    columnsBySku[skuId] = 0
    layersUsedBySku[skuId] = 0
    rotationsBySku[skuId] = 0

    if (!baseFits) {
      unplaceableBySku[skuId] = sku.quantity
      unplaceableTotal += sku.quantity
      warnings.push(`${skuId} no cabe por base y queda como no ubicable.`)
      preparedSkus.push({
        sku,
        skuId,
        skuName,
        color,
        stackPerColumn: 0,
        columnsNeeded: 0,
        columnsAssigned: 0,
        value: 0,
        canRotate: input.allowRotation && sku.allowRotation,
        limitedByVerticalRules: false,
        baseFits: false,
        unplaceable: sku.quantity,
      })
      return
    }

    const globalLayers = Math.floor(availableHeight / sku.height)
    let maxLayersForSku = globalLayers
    if (typeof sku.maxLayers === 'number') {
      maxLayersForSku = Math.min(maxLayersForSku, sku.maxLayers)
    }
    if (sku.noStack) {
      maxLayersForSku = Math.min(maxLayersForSku, 1)
    }
    const stackPerColumn = Math.max(0, maxLayersForSku)

    if (stackPerColumn === 0) {
      unplaceableBySku[skuId] = sku.quantity
      unplaceableTotal += sku.quantity
      limitedByVerticalRules = true
      preparedSkus.push({
        sku,
        skuId,
        skuName,
        color,
        stackPerColumn: 0,
        columnsNeeded: 0,
        columnsAssigned: 0,
        value: 0,
        canRotate: input.allowRotation && sku.allowRotation,
        limitedByVerticalRules: true,
        baseFits: true,
        unplaceable: sku.quantity,
      })
      return
    }

    const columnsNeeded = Math.ceil(sku.quantity / stackPerColumn)
    const footprintArea = sku.length * sku.width
    const value = stackPerColumn / footprintArea
    const hasVerticalRestriction =
      sku.noStack ||
      (typeof sku.maxLayers === 'number' && sku.maxLayers < globalLayers) ||
      stackPerColumn < globalLayers
    if (hasVerticalRestriction) {
      limitedByVerticalRules = true
    }

    preparedSkus.push({
      sku,
      skuId,
      skuName,
      color,
      stackPerColumn,
      columnsNeeded,
      columnsAssigned: columnsNeeded,
      value,
      canRotate: input.allowRotation && sku.allowRotation,
      limitedByVerticalRules: hasVerticalRestriction,
      baseFits: true,
      unplaceable: 0,
    })
  })

  const activeSkus = preparedSkus.filter((sku) => sku.columnsNeeded > 0)
  const priorityDesc = sortByPriority(activeSkus)
  const removalOrder = [...priorityDesc].reverse()

  let columnsReduced = false
  let columnItems = buildColumns(priorityDesc)
  let packResult = runColumnPacking(palletLength, palletWidth, columnItems)

  while (packResult.unplaced.length > 0) {
    let reduced = false
    for (const sku of removalOrder) {
      if (sku.columnsAssigned > 0) {
        sku.columnsAssigned -= 1
        columnsReduced = true
        reduced = true
        break
      }
    }

    if (!reduced) {
      break
    }

    columnItems = buildColumns(priorityDesc)
    packResult = runColumnPacking(palletLength, palletWidth, columnItems)
  }

  if (columnsReduced) {
    warnings.push('Columns reduced because pallet area is insufficient.')
  }
  if (limitedByVerticalRules) {
    warnings.push('Vertical capacity limits applied (maxLayers/noStack).')
  }

  const placementById = new Map<string, RectPackPlacement>()
  packResult.placements.forEach((placement) => {
    placementById.set(placement.itemId, placement)
  })

  const remainingBySku: Record<string, number> = {}
  preparedSkus.forEach((prepared) => {
    remainingBySku[prepared.skuId] = prepared.sku.quantity
  })

  const boxes: BoxInstance[] = []
  let totalBaseAreaUsed = 0
  let maxLayerIndex = -1
  let maxTopY = input.pallet.height

  columnItems.forEach((column) => {
    const placement = placementById.get(column.id)
    if (!placement) {
      return
    }

    const prepared = preparedSkus.find((item) => item.skuId === column.skuId)
    if (!prepared) {
      return
    }

    const remaining = remainingBySku[prepared.skuId] ?? 0
    if (remaining <= 0) {
      return
    }

    const stackCount = Math.min(prepared.stackPerColumn, remaining)
    if (stackCount <= 0) {
      return
    }

    totalBaseAreaUsed += placement.w * placement.h
    columnsBySku[prepared.skuId] = (columnsBySku[prepared.skuId] ?? 0) + 1

    for (let layerIndex = 0; layerIndex < stackCount; layerIndex += 1) {
      const x = -input.pallet.length / 2 + placement.x + placement.w / 2
      const z = -input.pallet.width / 2 + placement.y + placement.h / 2
      const y = input.pallet.height + layerIndex * prepared.sku.height + prepared.sku.height / 2

      boxes.push({
        x,
        y,
        z,
        length: placement.w,
        width: placement.h,
        height: prepared.sku.height,
        color: prepared.color,
        typeId: prepared.sku.id,
        skuId: prepared.skuId,
        skuName: prepared.skuName,
        label: prepared.skuId,
        rotated: placement.rotated,
        layer: layerIndex,
      })

      placedBySku[prepared.skuId] = (placedBySku[prepared.skuId] ?? 0) + 1
      unplacedBySku[prepared.skuId] = Math.max(0, (unplacedBySku[prepared.skuId] ?? 0) - 1)
      if (placement.rotated) {
        rotationsBySku[prepared.skuId] = (rotationsBySku[prepared.skuId] ?? 0) + 1
      }
      if (!layersBySku.has(prepared.skuId)) {
        layersBySku.set(prepared.skuId, new Set<number>())
      }
      layersBySku.get(prepared.skuId)?.add(layerIndex)

      maxLayerIndex = Math.max(maxLayerIndex, layerIndex)
      maxTopY = Math.max(maxTopY, y + prepared.sku.height / 2)
    }

    remainingBySku[prepared.skuId] = remaining - stackCount
  })

  Object.keys(remainingBySku).forEach((skuId) => {
    unplacedBySku[skuId] = remainingBySku[skuId]
    layersUsedBySku[skuId] = layersBySku.get(skuId)?.size ?? 0
  })

  const placedTotal = boxes.length
  const unplacedTotal = requestedTotal - placedTotal
  const layersUsed = maxLayerIndex >= 0 ? maxLayerIndex + 1 : 0
  const utilization =
    input.pallet.length > 0 && input.pallet.width > 0
      ? totalBaseAreaUsed / (input.pallet.length * input.pallet.width)
      : 0

  if (unplacedTotal > 0 && !columnsReduced && !limitedByVerticalRules) {
    warnings.push('Quedaron unidades sin ubicar por restricciones de espacio.')
  }

  try {
    assertNoMixedColumns(boxes)
  } catch (error) {
    return {
      ...emptyResult([
        error instanceof Error
          ? error.message
          : 'Se detecto mezcla de SKUs en columnas del solver no-mix.',
      ]),
      requestedTotal,
      unplaceableTotal,
      availableHeight,
      warnings,
    }
  }

  return {
    algorithm: 'heuristic',
    solverVariant: 'heuristic-columns',
    boxes,
    bySku: buildSummary(
      input,
      placedBySku,
      unplacedBySku,
      unplaceableBySku,
      rotationsBySku,
      layersBySku,
    ),
    placedBySku,
    unplacedBySku,
    columnsBySku,
    layersUsedBySku,
    requestedTotal,
    placedTotal,
    unplacedTotal,
    unplaceableTotal,
    totalPlaced: placedTotal,
    totalUnplaced: unplacedTotal,
    layersUsed,
    utilization,
    availableHeight,
    heightUsed: Math.max(0, maxTopY - input.pallet.height),
    heightFree: Math.max(0, availableHeight - Math.max(0, maxTopY - input.pallet.height)),
    errors: [],
    warnings,
  }
}
