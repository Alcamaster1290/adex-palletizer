import { rectPack2d } from './rectPack2d'
import type {
  ContainerInput,
  ContainerOrientationPlan,
  ContainerResult,
  PalletPlacement,
  RectPackItemInput,
} from './types'

interface ExpandedCatalogUnit {
  id: string
  palletTypeId: string
  name: string
  orderIndex: number
  length: number
  width: number
  height: number
  paddedLength: number
  paddedWidth: number
  color?: string
  weightPerPalletKg?: number
  loadVolumeMm3: number
}

interface ConsolidatedCandidate {
  placements: PalletPlacement[]
  occupiedFootprintAreaMm2: number
  loadVolumeMm3: number
  weightTotalKg: number | null
  orderedPlacedUnits: ExpandedCatalogUnit[]
}

const EMPTY_ORIENTATION: ContainerOrientationPlan = {
  orientation: 'LxW',
  palletFootprintL: 0,
  palletFootprintW: 0,
  pitchLength: 0,
  pitchWidth: 0,
  marginToWall: 0,
  nx: 0,
  ny: 0,
  perFloor: 0,
  occupiedLength: 0,
  occupiedWidth: 0,
  trailingResidualLength: 0,
  trailingResidualWidth: 0,
  utilizationArea: 0,
  residualLength: 0,
  residualWidth: 0,
}

function isPositive(value: number) {
  return Number.isFinite(value) && value > 0
}

function normalizeQuantity(quantity: number) {
  return Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0
}

function expandCatalog(
  input: ContainerInput,
  warnings: string[],
  errors: string[],
): ExpandedCatalogUnit[] {
  const gap = Math.max(0, input.clearance)
  const units: ExpandedCatalogUnit[] = []

  ;(input.pallets ?? []).forEach((entry, entryIndex) => {
    const quantity = normalizeQuantity(entry.quantity)
    if (quantity <= 0) {
      return
    }

    if (
      !isPositive(entry.pallet.length) ||
      !isPositive(entry.pallet.width) ||
      !isPositive(entry.pallet.height)
    ) {
      errors.push(`El pallet consolidado "${entry.name}" tiene dimensiones invalidas.`)
      return
    }

    if (entry.pallet.height > input.container.height) {
      warnings.push(
        `El pallet consolidado "${entry.name}" no cabe en altura y se omitio del calculo.`,
      )
      return
    }

    const loadVolumeMm3 = entry.load
      ? entry.load.palletLengthMm * entry.load.palletWidthMm * entry.load.loadTotalHeightMm
      : entry.pallet.length * entry.pallet.width * entry.pallet.height

    for (let unitIndex = 0; unitIndex < quantity; unitIndex += 1) {
      units.push({
        id: `${entry.id}::${unitIndex + 1}`,
        palletTypeId: entry.id,
        name: entry.name,
        orderIndex: entryIndex * 10_000 + unitIndex,
        length: entry.pallet.length,
        width: entry.pallet.width,
        height: entry.pallet.height,
        paddedLength: entry.pallet.length + gap,
        paddedWidth: entry.pallet.width + gap,
        color: entry.color,
        weightPerPalletKg: entry.weightPerPalletKg,
        loadVolumeMm3,
      })
    }
  })

  return units
}

function sumWeight(units: ExpandedCatalogUnit[]) {
  let hasWeight = false
  let total = 0

  units.forEach((unit) => {
    if (unit.weightPerPalletKg === undefined) {
      return
    }
    hasWeight = true
    total += unit.weightPerPalletKg
  })

  return hasWeight ? total : null
}

function buildPlacementsFromPacked(
  input: ContainerInput,
  unitsById: Map<string, ExpandedCatalogUnit>,
  packed: ReturnType<typeof rectPack2d>,
): ConsolidatedCandidate {
  const placements: PalletPlacement[] = []
  const orderedPlacedUnits: ExpandedCatalogUnit[] = []
  let occupiedFootprintAreaMm2 = 0
  let loadVolumeMm3 = 0

  packed.placements.forEach((placement, index) => {
    const unit = unitsById.get(placement.itemId)
    if (!unit) {
      return
    }

    const length = placement.rotated ? unit.width : unit.length
    const width = placement.rotated ? unit.length : unit.width

    placements.push({
      x: -input.container.length / 2 + placement.x + length / 2,
      y: unit.height / 2,
      z: -input.container.width / 2 + placement.y + width / 2,
      length,
      width,
      height: unit.height,
      palletTypeId: unit.palletTypeId,
      color: unit.color,
      label: unit.name,
      rotated: placement.rotated,
      index,
      layer: 0,
    })

    orderedPlacedUnits.push(unit)
    occupiedFootprintAreaMm2 += length * width
    loadVolumeMm3 += unit.loadVolumeMm3
  })

  return {
    placements,
    occupiedFootprintAreaMm2,
    loadVolumeMm3,
    weightTotalKg: sumWeight(orderedPlacedUnits),
    orderedPlacedUnits,
  }
}

function getPlacementSpan(
  placements: PalletPlacement[],
  containerLength: number,
  containerWidth: number,
) {
  if (placements.length === 0) {
    return {
      occupiedLength: 0,
      occupiedWidth: 0,
      maxRight: 0,
      maxBottom: 0,
    }
  }

  let minLeft = Number.POSITIVE_INFINITY
  let maxRight = Number.NEGATIVE_INFINITY
  let minTop = Number.POSITIVE_INFINITY
  let maxBottom = Number.NEGATIVE_INFINITY

  placements.forEach((placement) => {
    minLeft = Math.min(minLeft, placement.x - placement.length / 2 + containerLength / 2)
    maxRight = Math.max(maxRight, placement.x + placement.length / 2 + containerLength / 2)
    minTop = Math.min(minTop, placement.z - placement.width / 2 + containerWidth / 2)
    maxBottom = Math.max(maxBottom, placement.z + placement.width / 2 + containerWidth / 2)
  })

  return {
    occupiedLength: Math.max(0, maxRight - minLeft),
    occupiedWidth: Math.max(0, maxBottom - minTop),
    maxRight,
    maxBottom,
  }
}

function compareCandidates(
  left: ConsolidatedCandidate,
  right: ConsolidatedCandidate,
): ConsolidatedCandidate {
  if (right.placements.length > left.placements.length) {
    return right
  }

  if (
    right.placements.length === left.placements.length &&
    right.occupiedFootprintAreaMm2 > left.occupiedFootprintAreaMm2
  ) {
    return right
  }

  return left
}

function buildPackedItems(
  units: ExpandedCatalogUnit[],
  sortMode: 'area-asc' | 'area-desc' | 'added-order',
): RectPackItemInput[] {
  const ordered = [...units]

  ordered.sort((left, right) => {
    const leftArea = left.length * left.width
    const rightArea = right.length * right.width

    if (sortMode === 'area-asc' && leftArea !== rightArea) {
      return leftArea - rightArea
    }
    if (sortMode === 'area-desc' && leftArea !== rightArea) {
      return rightArea - leftArea
    }
    return left.orderIndex - right.orderIndex
  })

  return ordered.map((unit) => ({
    id: unit.id,
    w: unit.paddedLength,
    h: unit.paddedWidth,
    canRotate: true,
    skuId: unit.palletTypeId,
    color: unit.color,
  }))
}

function trimByPayload(
  candidate: ConsolidatedCandidate,
  payloadMaxKg: number | undefined,
  warnings: string[],
): ConsolidatedCandidate {
  if (!isPositive(payloadMaxKg ?? 0) || candidate.orderedPlacedUnits.length === 0) {
    return candidate
  }

  let runningWeight = 0
  let hasWeightData = false
  let cutoff = candidate.orderedPlacedUnits.length

  for (let index = 0; index < candidate.orderedPlacedUnits.length; index += 1) {
    const unit = candidate.orderedPlacedUnits[index]
    if (unit.weightPerPalletKg === undefined) {
      continue
    }

    hasWeightData = true
    runningWeight += unit.weightPerPalletKg
    if (runningWeight > (payloadMaxKg ?? 0)) {
      cutoff = index
      break
    }
  }

  if (!hasWeightData || cutoff === candidate.orderedPlacedUnits.length) {
    return candidate
  }

  warnings.push(
    'El limite de payload reduce la cantidad total de pallets del catalogo consolidado.',
  )

  const keptPlacements = candidate.placements.slice(0, cutoff).map((placement, index) => ({
    ...placement,
    index,
  }))
  const keptUnits = candidate.orderedPlacedUnits.slice(0, cutoff)
  return {
    placements: keptPlacements,
    occupiedFootprintAreaMm2: keptPlacements.reduce(
      (sum, placement) => sum + placement.length * placement.width,
      0,
    ),
    loadVolumeMm3: keptUnits.reduce((sum, unit) => sum + unit.loadVolumeMm3, 0),
    weightTotalKg: sumWeight(keptUnits),
    orderedPlacedUnits: keptUnits,
  }
}

export function solveContainerConsolidated(input: ContainerInput): ContainerResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!isPositive(input.container.length)) {
    errors.push('El largo interno del contenedor debe ser mayor a 0.')
  }
  if (!isPositive(input.container.width)) {
    errors.push('El ancho interno del contenedor debe ser mayor a 0.')
  }
  if (!isPositive(input.container.height)) {
    errors.push('El alto interno del contenedor debe ser mayor a 0.')
  }
  if (!Number.isFinite(input.clearance) || input.clearance < 0) {
    errors.push('La separacion entre pallets debe ser mayor o igual a 0.')
  }
  if (input.payloadMaxKg !== undefined && !isPositive(input.payloadMaxKg)) {
    errors.push('El payload maximo debe ser mayor a 0.')
  }

  const units = expandCatalog(input, warnings, errors)
  if (errors.length > 0) {
    return {
      selected: { ...EMPTY_ORIENTATION },
      candidates: [{ ...EMPTY_ORIENTATION }],
      solverVariant: 'consolidated',
      patternLabel: 'Catalogo consolidado invalido',
      rowPattern: [],
      wallClearanceMm: 0,
      rearClearanceMm: 0,
      palletGapMm: Math.max(0, input.clearance),
      floors: 1,
      totalPalletsBySpace: 0,
      totalPalletsByWeight: null,
      totalPallets: 0,
      utilizationArea: 0,
      utilizationVolume: 0,
      heightFits: false,
      availableHeight: 0,
      freeHeight: 0,
      weightTotalKg: null,
      containerVolume: 0,
      loadVolume: 0,
      placements: [],
      errors,
      warnings,
    }
  }

  if (units.length === 0) {
    warnings.push('No hay pallets agregados al catalogo consolidado.')
    return {
      selected: { ...EMPTY_ORIENTATION },
      candidates: [{ ...EMPTY_ORIENTATION }],
      solverVariant: 'consolidated',
      patternLabel: 'Catalogo consolidado vacio',
      rowPattern: [],
      wallClearanceMm: 0,
      rearClearanceMm: 0,
      palletGapMm: Math.max(0, input.clearance),
      floors: 1,
      totalPalletsBySpace: 0,
      totalPalletsByWeight: null,
      totalPallets: 0,
      utilizationArea: 0,
      utilizationVolume: 0,
      heightFits: true,
      availableHeight: input.container.height,
      freeHeight: input.container.height,
      weightTotalKg: null,
      containerVolume: input.container.length * input.container.width * input.container.height,
      loadVolume: 0,
      placements: [],
      errors,
      warnings,
    }
  }

  const gap = Math.max(0, input.clearance)
  const binWidth = Math.max(1, Math.round(input.container.length + gap))
  const binHeight = Math.max(1, Math.round(input.container.width + gap))
  const unitsById = new Map(units.map((unit) => [unit.id, unit]))

  const candidates = [
    buildPackedItems(units, 'area-asc'),
    buildPackedItems(units, 'area-desc'),
    buildPackedItems(units, 'added-order'),
  ]

  let bestCandidate: ConsolidatedCandidate = {
    placements: [],
    occupiedFootprintAreaMm2: 0,
    loadVolumeMm3: 0,
    weightTotalKg: null,
    orderedPlacedUnits: [],
  }

  candidates.forEach((items) => {
    const packed = rectPack2d(binWidth, binHeight, items, {
      allowRotatePerItem: input.allowRotation,
    })
    const candidate = buildPlacementsFromPacked(input, unitsById, packed)
    bestCandidate = compareCandidates(bestCandidate, candidate)
  })

  if (bestCandidate.placements.length < units.length) {
    warnings.push('No todo el catalogo consolidado cabe dentro del contenedor.')
  }

  const trimmed = trimByPayload(bestCandidate, input.payloadMaxKg, warnings)
  const span = getPlacementSpan(trimmed.placements, input.container.length, input.container.width)
  const maxPlacedHeight =
    trimmed.placements.length > 0
      ? Math.max(...trimmed.placements.map((placement) => placement.height))
      : 0
  const availableHeight = input.container.height
  const heightFits = maxPlacedHeight <= availableHeight
  const freeHeight = Math.max(0, availableHeight - maxPlacedHeight)

  const containerArea = input.container.length * input.container.width
  const containerVolume = containerArea * input.container.height
  const occupiedBlockArea = span.occupiedLength * span.occupiedWidth
  const utilizationArea = containerArea > 0 ? occupiedBlockArea / containerArea : 0
  const utilizationVolume =
    containerVolume > 0 ? trimmed.loadVolumeMm3 / containerVolume : 0

  return {
    selected: {
      ...EMPTY_ORIENTATION,
      perFloor: trimmed.placements.length,
      occupiedLength: span.occupiedLength,
      occupiedWidth: span.occupiedWidth,
      trailingResidualLength: Math.max(0, input.container.length - span.maxRight),
      trailingResidualWidth: Math.max(0, input.container.width - span.maxBottom),
      utilizationArea,
    },
    candidates: [{ ...EMPTY_ORIENTATION }],
    solverVariant: 'consolidated',
    patternLabel: 'Consolidado por catalogo',
    rowPattern: [],
    wallClearanceMm: 0,
    rearClearanceMm: 0,
    palletGapMm: gap,
    floors: 1,
    totalPalletsBySpace: bestCandidate.placements.length,
    totalPalletsByWeight:
      input.payloadMaxKg !== undefined ? trimmed.placements.length : null,
    totalPallets: heightFits ? trimmed.placements.length : 0,
    utilizationArea,
    utilizationVolume: heightFits ? utilizationVolume : 0,
    heightFits,
    availableHeight,
    freeHeight,
    weightTotalKg: trimmed.weightTotalKg,
    containerVolume,
    loadVolume: heightFits ? trimmed.loadVolumeMm3 : 0,
    placements: heightFits ? trimmed.placements : [],
    errors,
    warnings: !heightFits
      ? [...warnings, 'Uno o mas pallets consolidados no caben en altura.']
      : warnings,
  }
}
