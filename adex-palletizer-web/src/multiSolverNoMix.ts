import { rectPack2d } from './rectPack2d'
import type {
  BoxInstance,
  MultiPreviewInput,
  MultiPreviewResult,
  MultiSkuInput,
  MultiTypePlacementSummary,
  RectPackPlacement,
} from './types'

interface PreparedSkuContext {
  sku: MultiSkuInput
  skuId: string
  skuName: string
  color: string
  canRotate: boolean
  baseFits: boolean
  maxStack: number
  candidateHeights: number[]
  limitedByVerticalRules: boolean
  unplaceable: number
}

interface ColumnPlan {
  id: string
  sequence: number
  skuId: string
  skuName: string
  sku: MultiSkuInput
  color: string
  canRotate: boolean
  w: number
  h: number
  stackCount: number
  chosenHeight: number
}

interface PackedColumn {
  plan: ColumnPlan
  placement: RectPackPlacement
}

interface EvaluationScore {
  areaUsed: number
  placedUnits: number
  usedHeight: number
  placedColumns: number
  freeRectCount: number
}

interface EvaluationResult {
  score: EvaluationScore
  packedColumns: PackedColumn[]
  columnsReduced: boolean
  columnsBySku: Record<string, number>
}

interface HeightCandidate {
  skuId: string
  heights: Record<string, number>
  evaluation: EvaluationResult
}

const isPositive = (value: number) => Number.isFinite(value) && value > 0

function sanitize(value: string, fallback: string) {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : fallback
}

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

function uniqueDescending(values: number[]) {
  const unique = Array.from(new Set(values.filter((value) => value >= 1)))
  unique.sort((left, right) => right - left)
  return unique
}

function buildCandidateHeights(maxStack: number) {
  return uniqueDescending([1, 2, 3, 4, maxStack])
}

function compareScores(left: EvaluationScore, right: EvaluationScore) {
  if (left.areaUsed !== right.areaUsed) {
    return left.areaUsed - right.areaUsed
  }
  if (left.placedUnits !== right.placedUnits) {
    return left.placedUnits - right.placedUnits
  }
  if (left.usedHeight !== right.usedHeight) {
    return right.usedHeight - left.usedHeight
  }
  if (left.placedColumns !== right.placedColumns) {
    return left.placedColumns - right.placedColumns
  }
  if (left.freeRectCount !== right.freeRectCount) {
    return right.freeRectCount - left.freeRectCount
  }
  return 0
}

function nextLowerHeight(current: number, candidates: number[]) {
  const index = candidates.indexOf(current)
  if (index < 0 || index >= candidates.length - 1) {
    return current
  }
  return candidates[index + 1]
}

function clampHeight(height: number, maxStack: number) {
  return Math.max(1, Math.min(maxStack, height))
}

function buildColumnPlansForHeights(
  contexts: PreparedSkuContext[],
  heightsBySku: Record<string, number>,
) {
  const bySku = new Map<string, ColumnPlan[]>()
  const allPlans: ColumnPlan[] = []

  contexts.forEach((context) => {
    if (!context.baseFits || context.maxStack <= 0) {
      bySku.set(context.skuId, [])
      return
    }

    const chosenHeight = clampHeight(
      heightsBySku[context.skuId] ?? context.maxStack,
      context.maxStack,
    )
    const columnsNeeded = Math.ceil(context.sku.quantity / chosenHeight)
    const plans: ColumnPlan[] = []

    for (let index = 0; index < columnsNeeded; index += 1) {
      const remaining = context.sku.quantity - index * chosenHeight
      const stackCount = Math.min(chosenHeight, remaining)
      const plan: ColumnPlan = {
        id: `${context.skuId}::${index + 1}`,
        sequence: index,
        skuId: context.skuId,
        skuName: context.skuName,
        sku: context.sku,
        color: context.color,
        canRotate: context.canRotate,
        w: context.sku.length,
        h: context.sku.width,
        stackCount,
        chosenHeight,
      }
      plans.push(plan)
      allPlans.push(plan)
    }

    bySku.set(context.skuId, plans)
  })

  allPlans.sort((left, right) => {
    const leftArea = left.w * left.h
    const rightArea = right.w * right.h
    if (rightArea !== leftArea) {
      return rightArea - leftArea
    }
    if (right.stackCount !== left.stackCount) {
      return right.stackCount - left.stackCount
    }
    if (left.skuId !== right.skuId) {
      return left.skuId.localeCompare(right.skuId)
    }
    return left.sequence - right.sequence
  })

  return { bySku, allPlans }
}

function runColumnPacking(
  palletLength: number,
  palletWidth: number,
  plans: ColumnPlan[],
) {
  return rectPack2d(
    palletLength,
    palletWidth,
    plans.map((plan) => ({
      id: plan.id,
      skuId: plan.skuId,
      w: plan.w,
      h: plan.h,
      canRotate: plan.canRotate,
      color: plan.color,
    })),
  )
}

function buildPriorityByValue(
  contexts: PreparedSkuContext[],
  heightsBySku: Record<string, number>,
) {
  const ordered = [...contexts].filter((context) => context.baseFits && context.maxStack > 0)
  ordered.sort((left, right) => {
    const leftHeight = clampHeight(
      heightsBySku[left.skuId] ?? left.maxStack,
      left.maxStack,
    )
    const rightHeight = clampHeight(
      heightsBySku[right.skuId] ?? right.maxStack,
      right.maxStack,
    )
    const leftValue = leftHeight / (left.sku.length * left.sku.width)
    const rightValue = rightHeight / (right.sku.length * right.sku.width)
    if (rightValue !== leftValue) {
      return rightValue - leftValue
    }
    return left.skuId.localeCompare(right.skuId)
  })

  return {
    keepOrder: ordered.map((context) => context.skuId),
    removeOrder: [...ordered.map((context) => context.skuId)].reverse(),
  }
}

function evaluateHeights(
  contexts: PreparedSkuContext[],
  heightsBySku: Record<string, number>,
  palletLength: number,
  palletWidth: number,
): EvaluationResult {
  const { bySku } = buildColumnPlansForHeights(contexts, heightsBySku)
  const { removeOrder } = buildPriorityByValue(contexts, heightsBySku)

  let columnsReduced = false
  let plans = Array.from(bySku.values()).flat()
  let packResult = runColumnPacking(palletLength, palletWidth, plans)

  while (packResult.unplaced.length > 0) {
    let reduced = false
    for (const skuId of removeOrder) {
      const skuPlans = bySku.get(skuId)
      if (skuPlans && skuPlans.length > 0) {
        skuPlans.pop()
        columnsReduced = true
        reduced = true
        break
      }
    }

    if (!reduced) {
      break
    }

    plans = Array.from(bySku.values()).flat()
    packResult = runColumnPacking(palletLength, palletWidth, plans)
  }

  const planById = new Map<string, ColumnPlan>()
  plans.forEach((plan) => {
    planById.set(plan.id, plan)
  })

  const packedColumns: PackedColumn[] = []
  packResult.placements.forEach((placement) => {
    const plan = planById.get(placement.itemId)
    if (!plan) {
      return
    }
    packedColumns.push({ plan, placement })
  })

  packedColumns.sort((left, right) => {
    if (left.placement.y !== right.placement.y) {
      return left.placement.y - right.placement.y
    }
    if (left.placement.x !== right.placement.x) {
      return left.placement.x - right.placement.x
    }
    if (left.plan.skuId !== right.plan.skuId) {
      return left.plan.skuId.localeCompare(right.plan.skuId)
    }
    return left.plan.sequence - right.plan.sequence
  })

  const columnsBySku: Record<string, number> = {}
  let areaUsed = 0
  let placedUnits = 0
  let usedHeight = 0

  packedColumns.forEach(({ plan, placement }) => {
    areaUsed += placement.w * placement.h
    placedUnits += plan.stackCount
    usedHeight = Math.max(usedHeight, plan.stackCount * plan.sku.height)
    columnsBySku[plan.skuId] = (columnsBySku[plan.skuId] ?? 0) + 1
  })

  return {
    score: {
      areaUsed,
      placedUnits,
      usedHeight,
      placedColumns: packedColumns.length,
      freeRectCount: packResult.stats.freeRectCount,
    },
    packedColumns,
    columnsReduced,
    columnsBySku,
  }
}

function optimizeHeights(
  contexts: PreparedSkuContext[],
  palletLength: number,
  palletWidth: number,
) {
  const heights: Record<string, number> = {}
  contexts.forEach((context) => {
    if (context.maxStack > 0) {
      heights[context.skuId] = context.maxStack
    }
  })

  let best = evaluateHeights(contexts, heights, palletLength, palletWidth)

  while (true) {
    let bestCandidate: HeightCandidate | null = null

    for (const context of contexts) {
      if (context.maxStack <= 1 || context.candidateHeights.length <= 1) {
        continue
      }

      const current = heights[context.skuId] ?? context.maxStack
      const next = nextLowerHeight(current, context.candidateHeights)
      if (next === current) {
        continue
      }

      const trialHeights = {
        ...heights,
        [context.skuId]: next,
      }
      const trialEvaluation = evaluateHeights(
        contexts,
        trialHeights,
        palletLength,
        palletWidth,
      )

      if (compareScores(trialEvaluation.score, best.score) <= 0) {
        continue
      }

      if (!bestCandidate) {
        bestCandidate = {
          skuId: context.skuId,
          heights: trialHeights,
          evaluation: trialEvaluation,
        }
        continue
      }

      const candidateComparison = compareScores(
        trialEvaluation.score,
        bestCandidate.evaluation.score,
      )
      if (candidateComparison > 0) {
        bestCandidate = {
          skuId: context.skuId,
          heights: trialHeights,
          evaluation: trialEvaluation,
        }
        continue
      }

      if (candidateComparison === 0 && context.skuId.localeCompare(bestCandidate.skuId) < 0) {
        bestCandidate = {
          skuId: context.skuId,
          heights: trialHeights,
          evaluation: trialEvaluation,
        }
      }
    }

    const chosenCandidate = bestCandidate
    if (!chosenCandidate) {
      break
    }

    Object.assign(heights, chosenCandidate.heights)
    best = chosenCandidate.evaluation
  }

  return {
    heightsBySku: heights,
    evaluation: best,
  }
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
  const rotationsBySku: Record<string, number> = {}
  const layersBySku = new Map<string, Set<number>>()

  const contexts: PreparedSkuContext[] = []
  let requestedTotal = 0
  let unplaceableTotal = 0
  let verticalLimitsApplied = false

  input.skus.forEach((sku, index) => {
    const skuId = sanitize(sku.skuId, `SKU-${sku.id}`)
    const skuName = sanitize(sku.name, `SKU ${index + 1}`)
    const color = resolveSkuColor(sku.color)
    const baseFits = canFitInBase(sku, palletLength, palletWidth, input.allowRotation)
    const canRotate = input.allowRotation && sku.allowRotation

    requestedTotal += sku.quantity
    placedBySku[skuId] = 0
    unplacedBySku[skuId] = sku.quantity
    unplaceableBySku[skuId] = 0
    rotationsBySku[skuId] = 0

    if (!baseFits) {
      unplaceableBySku[skuId] = sku.quantity
      unplaceableTotal += sku.quantity
      warnings.push(`${skuId} no cabe por base y queda como no ubicable.`)
      contexts.push({
        sku,
        skuId,
        skuName,
        color,
        canRotate,
        baseFits: false,
        maxStack: 0,
        candidateHeights: [1],
        limitedByVerticalRules: false,
        unplaceable: sku.quantity,
      })
      return
    }

    const globalLayersForSku = Math.floor(availableHeight / sku.height)
    let maxStack = globalLayersForSku
    if (typeof sku.maxLayers === 'number') {
      maxStack = Math.min(maxStack, sku.maxLayers)
    }
    if (sku.noStack) {
      maxStack = Math.min(maxStack, 1)
    }

    if (maxStack <= 0) {
      unplaceableBySku[skuId] = sku.quantity
      unplaceableTotal += sku.quantity
      verticalLimitsApplied = true
      contexts.push({
        sku,
        skuId,
        skuName,
        color,
        canRotate,
        baseFits: true,
        maxStack: 0,
        candidateHeights: [1],
        limitedByVerticalRules: true,
        unplaceable: sku.quantity,
      })
      return
    }

    const limitedByVerticalRules =
      sku.noStack ||
      (typeof sku.maxLayers === 'number' && sku.maxLayers < globalLayersForSku)
    if (limitedByVerticalRules) {
      verticalLimitsApplied = true
    }

    contexts.push({
      sku,
      skuId,
      skuName,
      color,
      canRotate,
      baseFits: true,
      maxStack,
      candidateHeights: buildCandidateHeights(maxStack),
      limitedByVerticalRules,
      unplaceable: 0,
    })
  })

  const activeContexts = contexts.filter((context) => context.baseFits && context.maxStack > 0)
  const { evaluation } = optimizeHeights(activeContexts, palletLength, palletWidth)

  if (evaluation.columnsReduced) {
    warnings.push('Columns reduced because pallet area is insufficient.')
  }
  if (verticalLimitsApplied) {
    warnings.push('Vertical capacity limits applied (maxLayers/noStack).')
  }

  const boxes: BoxInstance[] = []
  let maxLayerIndex = -1
  let maxTopY = input.pallet.height

  evaluation.packedColumns.forEach(({ plan, placement }) => {
    for (let layerIndex = 0; layerIndex < plan.stackCount; layerIndex += 1) {
      const x = -input.pallet.length / 2 + placement.x + placement.w / 2
      const z = -input.pallet.width / 2 + placement.y + placement.h / 2
      const y = input.pallet.height + layerIndex * plan.sku.height + plan.sku.height / 2

      boxes.push({
        x,
        y,
        z,
        length: placement.w,
        width: placement.h,
        height: plan.sku.height,
        color: plan.color,
        typeId: plan.sku.id,
        skuId: plan.skuId,
        skuName: plan.skuName,
        label: plan.skuId,
        rotated: placement.rotated,
        layer: layerIndex,
      })

      placedBySku[plan.skuId] = (placedBySku[plan.skuId] ?? 0) + 1
      if (placement.rotated) {
        rotationsBySku[plan.skuId] = (rotationsBySku[plan.skuId] ?? 0) + 1
      }
      if (!layersBySku.has(plan.skuId)) {
        layersBySku.set(plan.skuId, new Set<number>())
      }
      layersBySku.get(plan.skuId)?.add(layerIndex)

      maxLayerIndex = Math.max(maxLayerIndex, layerIndex)
      maxTopY = Math.max(maxTopY, y + plan.sku.height / 2)
    }
  })

  const columnsBySku = evaluation.columnsBySku
  const layersUsedBySku: Record<string, number> = {}

  Object.keys(placedBySku).forEach((skuId) => {
    unplacedBySku[skuId] = Math.max(0, (unplacedBySku[skuId] ?? 0) - (placedBySku[skuId] ?? 0))
    layersUsedBySku[skuId] = layersBySku.get(skuId)?.size ?? 0
  })

  const placedTotal = boxes.length
  const unplacedTotal = requestedTotal - placedTotal
  const layersUsed = maxLayerIndex >= 0 ? maxLayerIndex + 1 : 0
  const utilization =
    input.pallet.length > 0 && input.pallet.width > 0
      ? evaluation.score.areaUsed / (input.pallet.length * input.pallet.width)
      : 0

  if (unplacedTotal > 0 && !evaluation.columnsReduced && !verticalLimitsApplied) {
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
