import type {
  BoxInstance,
  MultiPreviewInput,
  MultiPreviewResult,
  MultiSkuInput,
  MultiTypePlacementSummary,
} from './types'
import { rectPack2d } from './rectPack2d'

interface UnitItem {
  unitId: string
  unitIndex: number
  sku: MultiSkuInput
  skuId: string
  skuName: string
  color: string
  volume: number
  footprint: number
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
    solverVariant: 'heuristic-ffd',
    boxes: [],
    bySku: [],
    placedBySku: {},
    unplacedBySku: {},
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

function getOrientationOptions(sku: MultiSkuInput, globalAllowRotation: boolean) {
  const options = [
    {
      length: sku.length,
      width: sku.width,
      rotated: false,
    },
  ]

  if (globalAllowRotation && sku.allowRotation && sku.length !== sku.width) {
    options.push({
      length: sku.width,
      width: sku.length,
      rotated: true,
    })
  }

  return options
}

function canFitInBase(
  sku: MultiSkuInput,
  palletLength: number,
  palletWidth: number,
  globalAllowRotation: boolean,
) {
  return getOrientationOptions(sku, globalAllowRotation).some(
    (option) => option.length <= palletLength && option.width <= palletWidth,
  )
}

function isLayerAllowed(sku: MultiSkuInput, layerIndex: number) {
  if (sku.noStack && layerIndex > 0) {
    return false
  }

  if (typeof sku.maxLayers === 'number' && layerIndex >= sku.maxLayers) {
    return false
  }

  return true
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
      color: sku.color ?? '#b88752',
    }
  })
}

export function solveMultiHeuristic(input: MultiPreviewInput): MultiPreviewResult {
  const errors = validateInput(input)
  if (errors.length > 0) {
    return emptyResult(errors)
  }

  const warnings: string[] = []
  const availableHeight = Math.max(0, input.maxTotalHeight - input.pallet.height)
  const layerStep = Math.max(
    1,
    input.skus.reduce((maxHeight, sku) => Math.max(maxHeight, sku.height), 0),
  )
  const layersMax = Math.max(0, Math.floor(availableHeight / layerStep))

  const palletLength = input.pallet.length + input.overhang
  const palletWidth = input.pallet.width + input.overhang

  const pendingUnits: UnitItem[] = []
  const placedBySku: Record<string, number> = {}
  const unplacedBySku: Record<string, number> = {}
  const unplaceableBySku: Record<string, number> = {}
  const rotationsBySku: Record<string, number> = {}
  const layersBySku = new Map<string, Set<number>>()

  let requestedTotal = 0
  let unplaceableTotal = 0

  let unitCounter = 0
  input.skus.forEach((sku, index) => {
    const skuId = sanitize(sku.skuId, `SKU-${sku.id}`)
    const skuName = sanitize(sku.name, `SKU ${index + 1}`)
    const quantity = sku.quantity
    const color = sku.color && /^#?[0-9a-fA-F]{6}$/.test(sku.color)
      ? sku.color.startsWith('#')
        ? sku.color
        : `#${sku.color}`
      : '#b88752'

    requestedTotal += quantity

    if (!canFitInBase(sku, palletLength, palletWidth, input.allowRotation)) {
      unplaceableBySku[skuId] = quantity
      unplacedBySku[skuId] = quantity
      placedBySku[skuId] = 0
      rotationsBySku[skuId] = 0
      unplaceableTotal += quantity
      warnings.push(`${skuId} no cabe por base y queda como no ubicable.`)
      return
    }

    for (let count = 0; count < quantity; count += 1) {
      unitCounter += 1
      pendingUnits.push({
        unitId: `${skuId}-${unitCounter}`,
        unitIndex: unitCounter,
        sku,
        skuId,
        skuName,
        color,
        volume: sku.length * sku.width * sku.height,
        footprint: sku.length * sku.width,
      })
    }

    placedBySku[skuId] = 0
    unplacedBySku[skuId] = quantity
    rotationsBySku[skuId] = 0
  })

  pendingUnits.sort((left, right) => {
    if (right.footprint !== left.footprint) {
      return right.footprint - left.footprint
    }
    if (right.sku.height !== left.sku.height) {
      return right.sku.height - left.sku.height
    }
    if (right.volume !== left.volume) {
      return right.volume - left.volume
    }
    if (left.skuId !== right.skuId) {
      return left.skuId.localeCompare(right.skuId)
    }
    return left.unitIndex - right.unitIndex
  })

  const boxes: BoxInstance[] = []
  let totalAreaUsed = 0

  for (let layerIndex = 0; layerIndex < layersMax; layerIndex += 1) {
    if (pendingUnits.length === 0) {
      break
    }

    const eligibleUnits = pendingUnits.filter((unit) => isLayerAllowed(unit.sku, layerIndex))
    if (eligibleUnits.length === 0) {
      break
    }

    const unitById = new Map(eligibleUnits.map((unit) => [unit.unitId, unit]))
    const packResult = rectPack2d(
      palletLength,
      palletWidth,
      eligibleUnits.map((unit) => ({
        id: unit.unitId,
        w: unit.sku.length,
        h: unit.sku.width,
        canRotate: input.allowRotation && unit.sku.allowRotation,
        skuId: unit.skuId,
        color: unit.color,
      })),
    )

    if (packResult.placements.length === 0) {
      break
    }

    const placedIds = new Set<string>()

    packResult.placements.forEach((placement) => {
      const unit = unitById.get(placement.itemId)
      if (!unit) {
        return
      }

      const x = -input.pallet.length / 2 + placement.x + placement.w / 2
      const z = -input.pallet.width / 2 + placement.y + placement.h / 2
      const y = input.pallet.height + layerIndex * layerStep + unit.sku.height / 2

      boxes.push({
        x,
        y,
        z,
        length: placement.w,
        width: placement.h,
        height: unit.sku.height,
        color: unit.color,
        typeId: unit.sku.id,
        skuId: unit.skuId,
        skuName: unit.skuName,
        label: unit.skuId,
        rotated: placement.rotated,
        layer: layerIndex,
      })

      placedBySku[unit.skuId] = (placedBySku[unit.skuId] ?? 0) + 1
      unplacedBySku[unit.skuId] = Math.max(0, (unplacedBySku[unit.skuId] ?? 0) - 1)
      if (placement.rotated) {
        rotationsBySku[unit.skuId] = (rotationsBySku[unit.skuId] ?? 0) + 1
      }
      if (!layersBySku.has(unit.skuId)) {
        layersBySku.set(unit.skuId, new Set<number>())
      }
      layersBySku.get(unit.skuId)?.add(layerIndex)

      totalAreaUsed += placement.w * placement.h
      placedIds.add(unit.unitId)
    })

    if (placedIds.size === 0) {
      break
    }

    for (let index = pendingUnits.length - 1; index >= 0; index -= 1) {
      if (placedIds.has(pendingUnits[index].unitId)) {
        pendingUnits.splice(index, 1)
      }
    }
  }

  const placedTotal = boxes.length
  const unplacedTotal = requestedTotal - placedTotal
  const layersUsed = boxes.length > 0 ? Math.max(...boxes.map((box) => box.layer ?? 0)) + 1 : 0
  const utilization =
    layersUsed > 0
      ? totalAreaUsed / (input.pallet.length * input.pallet.width * layersUsed)
      : 0

  if (unplacedTotal > 0) {
    warnings.push('Quedaron unidades sin ubicar con la heuristica first-fit decreasing.')
  }

  input.skus.forEach((sku) => {
    const skuId = sanitize(sku.skuId, `SKU-${sku.id}`)
    const remaining = unplacedBySku[skuId] ?? 0
    if (remaining <= 0) {
      return
    }

    if (sku.noStack) {
      warnings.push(`${skuId}: noStack activo, solo se permite capa 0.`)
    } else if (typeof sku.maxLayers === 'number') {
      warnings.push(`${skuId}: maxLayers=${sku.maxLayers} limito el apilamiento.`)
    }
  })

  return {
    algorithm: 'heuristic',
    solverVariant: 'heuristic-ffd',
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
    requestedTotal,
    placedTotal,
    unplacedTotal,
    unplaceableTotal,
    totalPlaced: placedTotal,
    totalUnplaced: unplacedTotal,
    layersUsed,
    utilization,
    availableHeight,
    heightUsed: layersUsed * layerStep,
    heightFree: Math.max(0, availableHeight - layersUsed * layerStep),
    errors: [],
    warnings,
  }
}
