import type {
  BoxInstance,
  MultiPreviewInput,
  MultiPreviewResult,
  MultiSkuInput,
  MultiTypePlacementSummary,
} from './types'

interface FreeRect {
  x: number
  y: number
  width: number
  height: number
}

interface UnitItem {
  sku: MultiSkuInput
  skuId: string
  skuName: string
  color: string
  volume: number
  footprint: number
}

interface PlacementChoice {
  rectIndex: number
  length: number
  width: number
  rotated: boolean
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

function buildGuillotineSplit(rect: FreeRect, length: number, width: number) {
  const right: FreeRect = {
    x: rect.x + length,
    y: rect.y,
    width: rect.width - length,
    height: rect.height,
  }
  const bottom: FreeRect = {
    x: rect.x,
    y: rect.y + width,
    width: length,
    height: rect.height - width,
  }

  return [right, bottom].filter((candidate) => candidate.width > 0 && candidate.height > 0)
}

function pruneFreeRects(freeRects: FreeRect[]) {
  return freeRects.filter((rect, index) => {
    for (let otherIndex = 0; otherIndex < freeRects.length; otherIndex += 1) {
      if (index === otherIndex) {
        continue
      }

      const other = freeRects[otherIndex]
      const contained =
        rect.x >= other.x &&
        rect.y >= other.y &&
        rect.x + rect.width <= other.x + other.width &&
        rect.y + rect.height <= other.y + other.height

      if (contained) {
        return false
      }
    }

    return true
  })
}

function findFirstFit(
  unit: UnitItem,
  freeRects: FreeRect[],
  globalAllowRotation: boolean,
): PlacementChoice | null {
  const options = getOrientationOptions(unit.sku, globalAllowRotation)

  for (let rectIndex = 0; rectIndex < freeRects.length; rectIndex += 1) {
    const rect = freeRects[rectIndex]

    for (const option of options) {
      if (option.length <= rect.width && option.width <= rect.height) {
        return {
          rectIndex,
          length: option.length,
          width: option.width,
          rotated: option.rotated,
        }
      }
    }
  }

  return null
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
      color: sku.color ?? '#2f8f9d',
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

  input.skus.forEach((sku, index) => {
    const skuId = sanitize(sku.skuId, `SKU-${sku.id}`)
    const skuName = sanitize(sku.name, `SKU ${index + 1}`)
    const quantity = sku.quantity
    const color = sku.color && /^#?[0-9a-fA-F]{6}$/.test(sku.color)
      ? sku.color.startsWith('#')
        ? sku.color
        : `#${sku.color}`
      : '#2f8f9d'

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
      pendingUnits.push({
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
    return right.volume - left.volume
  })

  const boxes: BoxInstance[] = []
  let totalAreaUsed = 0

  for (let layerIndex = 0; layerIndex < layersMax; layerIndex += 1) {
    if (pendingUnits.length === 0) {
      break
    }

    let freeRects: FreeRect[] = [
      { x: 0, y: 0, width: palletLength, height: palletWidth },
    ]
    let placedInLayer = 0

    for (let unitIndex = 0; unitIndex < pendingUnits.length; ) {
      const unit = pendingUnits[unitIndex]
      if (!isLayerAllowed(unit.sku, layerIndex)) {
        unitIndex += 1
        continue
      }

      const fit = findFirstFit(unit, freeRects, input.allowRotation)
      if (!fit) {
        unitIndex += 1
        continue
      }

      const targetRect = freeRects[fit.rectIndex]
      const x = -input.pallet.length / 2 + fit.length / 2 + targetRect.x
      const z = -input.pallet.width / 2 + fit.width / 2 + targetRect.y
      const y = input.pallet.height + layerIndex * layerStep + unit.sku.height / 2

      boxes.push({
        x,
        y,
        z,
        length: fit.length,
        width: fit.width,
        height: unit.sku.height,
        color: unit.color,
        typeId: unit.sku.id,
        skuId: unit.skuId,
        skuName: unit.skuName,
        label: unit.skuId,
        rotated: fit.rotated,
        layer: layerIndex,
      })

      placedBySku[unit.skuId] = (placedBySku[unit.skuId] ?? 0) + 1
      unplacedBySku[unit.skuId] = Math.max(0, (unplacedBySku[unit.skuId] ?? 0) - 1)
      if (fit.rotated) {
        rotationsBySku[unit.skuId] = (rotationsBySku[unit.skuId] ?? 0) + 1
      }
      if (!layersBySku.has(unit.skuId)) {
        layersBySku.set(unit.skuId, new Set<number>())
      }
      layersBySku.get(unit.skuId)?.add(layerIndex)

      totalAreaUsed += fit.length * fit.width
      placedInLayer += 1

      const nextFree = buildGuillotineSplit(targetRect, fit.length, fit.width)
      freeRects.splice(fit.rectIndex, 1, ...nextFree)
      freeRects = pruneFreeRects(freeRects)

      pendingUnits.splice(unitIndex, 1)
    }

    if (placedInLayer === 0) {
      break
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
