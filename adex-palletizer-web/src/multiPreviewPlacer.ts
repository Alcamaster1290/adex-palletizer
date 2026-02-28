import { MULTI_TYPE_COLORS } from './constants'
import type {
  BoxInstance,
  MultiPreviewInput,
  MultiPreviewResult,
  MultiSkuInput,
  MultiTypePlacementSummary,
} from './types'

const isPositive = (value: number) => Number.isFinite(value) && value > 0
const isNonNegative = (value: number) => Number.isFinite(value) && value >= 0

interface OrientationChoice {
  length: number
  width: number
  rotated: boolean
}

interface PlacementState {
  layer: number
  cursorX: number
  cursorY: number
  rowDepth: number
}

interface CandidateFit {
  step: 0 | 1 | 2 | 3
  choice: OrientationChoice | null
}

function sanitizeSkuString(value: string, fallback: string) {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : fallback
}

function resolveSkuColor(sku: MultiSkuInput, index: number) {
  const trimmed = sku.color?.trim()
  if (trimmed && /^#?[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  }

  return MULTI_TYPE_COLORS[index % MULTI_TYPE_COLORS.length]
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
  if (!isNonNegative(input.overhang)) {
    errors.push('El overhang no puede ser negativo.')
  }
  if (input.skus.length === 0) {
    errors.push('Debe existir al menos un SKU para generar la vista multicaja.')
  }

  input.skus.forEach((sku, index) => {
    if (!isPositive(sku.length)) {
      errors.push(`SKU ${index + 1}: largo invalido.`)
    }
    if (!isPositive(sku.width)) {
      errors.push(`SKU ${index + 1}: ancho invalido.`)
    }
    if (!isPositive(sku.height)) {
      errors.push(`SKU ${index + 1}: alto invalido.`)
    }
    if (!Number.isInteger(sku.quantity) || sku.quantity < 1) {
      errors.push(`SKU ${index + 1}: quantity debe ser entero mayor o igual a 1.`)
    }
  })

  return errors
}

function emptyResult(errors: string[]): MultiPreviewResult {
  return {
    algorithm: 'preview',
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

function buildOrientationChoices(sku: MultiSkuInput, globalAllowRotation: boolean) {
  const choices: OrientationChoice[] = [
    {
      length: sku.length,
      width: sku.width,
      rotated: false,
    },
  ]

  if (globalAllowRotation && sku.allowRotation && sku.length !== sku.width) {
    choices.push({
      length: sku.width,
      width: sku.length,
      rotated: true,
    })
  }

  return choices
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

function evaluateCandidate(
  choice: OrientationChoice,
  state: PlacementState,
  palletLength: number,
  palletWidth: number,
) {
  const fitsCurrent =
    state.cursorX + choice.length <= palletLength &&
    state.cursorY + choice.width <= palletWidth
  if (fitsCurrent) {
    return 0 as const
  }

  const nextRowY = state.cursorY + state.rowDepth
  const fitsNextRow =
    choice.length <= palletLength && nextRowY + choice.width <= palletWidth
  if (fitsNextRow) {
    return 1 as const
  }

  const fitsFreshLayer =
    choice.length <= palletLength && choice.width <= palletWidth
  if (fitsFreshLayer) {
    return 2 as const
  }

  return 3 as const
}

function chooseOrientationForState(
  sku: MultiSkuInput,
  state: PlacementState,
  palletLength: number,
  palletWidth: number,
  globalAllowRotation: boolean,
  layersMax: number,
): CandidateFit {
  const choices = buildOrientationChoices(sku, globalAllowRotation)

  let bestStep: 0 | 1 | 2 | 3 = 3
  let bestChoice: OrientationChoice | null = null

  choices.forEach((choice) => {
    const step = evaluateCandidate(choice, state, palletLength, palletWidth)
    const targetLayer = step === 2 ? state.layer + 1 : state.layer
    if (step < 3 && targetLayer >= layersMax) {
      return
    }
    if (step < 3 && !isLayerAllowed(sku, targetLayer)) {
      return
    }

    if (step < bestStep) {
      bestStep = step
      bestChoice = choice
      return
    }

    if (
      step === bestStep &&
      bestChoice !== null &&
      bestChoice.rotated &&
      !choice.rotated
    ) {
      bestChoice = choice
    }
  })

  return {
    step: bestStep,
    choice: bestChoice,
  }
}

function createPlacement(
  input: MultiPreviewInput,
  sku: MultiSkuInput,
  choice: OrientationChoice,
  color: string,
  state: PlacementState,
  layerStep: number,
): BoxInstance {
  const x = -input.pallet.length / 2 + choice.length / 2 + state.cursorX
  const z = -input.pallet.width / 2 + choice.width / 2 + state.cursorY
  const y = input.pallet.height + state.layer * layerStep + sku.height / 2

  return {
    x,
    y,
    z,
    length: choice.length,
    width: choice.width,
    height: sku.height,
    color,
    typeId: sku.id,
    skuId: sanitizeSkuString(sku.skuId, `SKU-${sku.id}`),
    skuName: sanitizeSkuString(sku.name, `SKU ${sku.id}`),
    label: sanitizeSkuString(sku.skuId, `SKU-${sku.id}`),
    rotated: choice.rotated,
    layer: state.layer,
  }
}

export function buildMultiPreviewPlacement(
  input: MultiPreviewInput,
): MultiPreviewResult {
  const errors = validateInput(input)
  if (errors.length > 0) {
    return emptyResult(errors)
  }

  const warnings: string[] = []
  const availableHeight = Math.max(0, input.maxTotalHeight - input.pallet.height)
  if (input.maxTotalHeight <= input.pallet.height) {
    warnings.push(
      'La altura maxima total es menor o igual a la altura del pallet. No hay capas disponibles.',
    )
  }

  const effectivePalletLength = input.pallet.length + input.overhang
  const effectivePalletWidth = input.pallet.width + input.overhang

  const layerStep = Math.max(
    1,
    input.skus.reduce((maxHeight, sku) => Math.max(maxHeight, sku.height), 0),
  )
  const layersMax = Math.max(0, Math.floor(availableHeight / layerStep))

  const state: PlacementState = {
    layer: 0,
    cursorX: 0,
    cursorY: 0,
    rowDepth: 0,
  }

  const boxes: BoxInstance[] = []
  const bySku: MultiTypePlacementSummary[] = []
  const placedBySku: Record<string, number> = {}
  const unplacedBySku: Record<string, number> = {}
  let placedTotal = 0
  let requestedTotal = 0
  let unplaceableTotal = 0
  let totalAreaUsed = 0

  input.skus.forEach((sku, skuIndex) => {
    const requested = sku.quantity
    requestedTotal += requested

    let placed = 0
    let unplaceable = 0
    let rotationsUsed = 0
    const usedLayers = new Set<number>()
    const color = resolveSkuColor(sku, skuIndex)

    const choices = buildOrientationChoices(sku, input.allowRotation)
    const canFitInPallet = choices.some(
      (choice) =>
        choice.length <= effectivePalletLength &&
        choice.width <= effectivePalletWidth,
    )

    if (!canFitInPallet) {
      unplaceable = requested
      unplaceableTotal += requested
      warnings.push(
        `${sanitizeSkuString(sku.skuId, `SKU-${sku.id}`)} no cabe por base en el pallet.`,
      )
    } else {
      for (let unit = 0; unit < requested; unit += 1) {
        const candidate = chooseOrientationForState(
          sku,
          state,
          effectivePalletLength,
          effectivePalletWidth,
          input.allowRotation,
          layersMax,
        )

        if (candidate.choice === null || candidate.step === 3) {
          break
        }

        if (candidate.step === 1) {
          state.cursorX = 0
          state.cursorY += state.rowDepth
          state.rowDepth = 0
        }

        if (candidate.step === 2) {
          state.layer += 1
          state.cursorX = 0
          state.cursorY = 0
          state.rowDepth = 0
        }

        if (state.layer >= layersMax) {
          break
        }

        const placement = createPlacement(
          input,
          sku,
          candidate.choice,
          color,
          state,
          layerStep,
        )
        boxes.push(placement)

        placed += 1
        placedTotal += 1
        totalAreaUsed += candidate.choice.length * candidate.choice.width
        if (candidate.choice.rotated) {
          rotationsUsed += 1
        }
        usedLayers.add(state.layer)

        state.cursorX += candidate.choice.length
        state.rowDepth = Math.max(state.rowDepth, candidate.choice.width)
      }
    }

    const unplaced = requested - placed
    const summarySkuId = sanitizeSkuString(sku.skuId, `SKU-${sku.id}`)
    placedBySku[summarySkuId] = placed
    unplacedBySku[summarySkuId] = unplaced

    bySku.push({
      id: sku.id,
      skuId: summarySkuId,
      name: sanitizeSkuString(sku.name, `SKU ${sku.id}`),
      requested,
      placed,
      unplaced,
      unplaceable,
      layersUsed: usedLayers.size,
      rotationsUsed,
      color,
    })

    if (unplaced > 0 && (sku.noStack || typeof sku.maxLayers === 'number')) {
      const skuName = sanitizeSkuString(sku.skuId, `SKU-${sku.id}`)
      if (sku.noStack) {
        warnings.push(`${skuName}: restriccion noStack impidio ubicar ${unplaced} unidades.`)
      } else {
        warnings.push(`${skuName}: maxLayers limito el apilamiento y quedaron ${unplaced} unidades.`)
      }
    }
  })

  const unplacedTotal = requestedTotal - placedTotal
  if (unplacedTotal > 0 && !warnings.some((warning) => warning.includes('No hay'))) {
    warnings.push('No hay mas espacio disponible para ubicar todas las unidades solicitadas.')
  }

  const layersUsed = boxes.length > 0 ? Math.max(...boxes.map((box) => box.layer ?? 0)) + 1 : 0
  const heightUsed = layersUsed * layerStep
  const palletArea = input.pallet.length * input.pallet.width
  const utilization =
    layersUsed > 0 && palletArea > 0
      ? totalAreaUsed / (palletArea * layersUsed)
      : 0

  return {
    algorithm: 'preview',
    boxes,
    bySku,
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
    heightUsed,
    heightFree: Math.max(0, availableHeight - heightUsed),
    errors,
    warnings,
  }
}
