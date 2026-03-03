import { solveAlternatingByRows } from './containerSolverAlternating'
import type {
  ContainerInput,
  ContainerOrientationPlan,
  ContainerResult,
  PalletPlacement,
} from './types'

const isPositive = (value: number) => Number.isFinite(value) && value > 0
const isNonNegative = (value: number) => Number.isFinite(value) && value >= 0

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

function evaluateHomogeneousOrientation(
  orientation: ContainerOrientationPlan['orientation'],
  containerL: number,
  containerW: number,
  palletL: number,
  palletW: number,
  frontClearance: number,
  rearClearance: number,
  sideClearance: number,
  gap: number,
): ContainerOrientationPlan {
  const effectiveLength = Math.max(0, containerL - frontClearance - rearClearance)
  const effectiveWidth = Math.max(0, containerW - 2 * sideClearance)
  const pitchLength = palletL + gap
  const pitchWidth = palletW + gap
  const nx = Math.max(0, Math.floor((effectiveLength + gap) / pitchLength))
  const ny = Math.max(0, Math.floor((effectiveWidth + gap) / pitchWidth))
  const perFloor = nx * ny
  const occupiedLength = nx > 0 ? nx * palletL + (nx - 1) * gap : 0
  const occupiedWidth = ny > 0 ? ny * palletW + (ny - 1) * gap : 0
  const trailingResidualLength = Math.max(0, effectiveLength - occupiedLength)
  const trailingResidualWidth = Math.max(0, effectiveWidth - occupiedWidth)
  const containerArea = containerL * containerW
  const usedArea = occupiedLength * occupiedWidth
  const utilizationArea = containerArea > 0 ? usedArea / containerArea : 0
  const residualLength = Math.max(0, containerL - occupiedLength)
  const residualWidth = Math.max(0, containerW - occupiedWidth)

  return {
    orientation,
    palletFootprintL: palletL,
    palletFootprintW: palletW,
    pitchLength,
    pitchWidth,
    marginToWall: sideClearance,
    nx,
    ny,
    perFloor,
    occupiedLength,
    occupiedWidth,
    trailingResidualLength,
    trailingResidualWidth,
    utilizationArea,
    residualLength,
    residualWidth,
  }
}

function selectBestOrientation(
  planA: ContainerOrientationPlan,
  planB: ContainerOrientationPlan | null,
): ContainerOrientationPlan {
  if (planB === null) {
    return planA
  }

  if (planB.perFloor > planA.perFloor) {
    return planB
  }

  if (planB.perFloor === planA.perFloor && planB.utilizationArea > planA.utilizationArea) {
    return planB
  }

  return planA
}

function buildHomogeneousPlacements(
  input: ContainerInput,
  selected: ContainerOrientationPlan,
  totalPallets: number,
  frontClearance: number,
  sideClearance: number,
): PalletPlacement[] {
  if (totalPallets <= 0 || selected.perFloor <= 0) {
    return []
  }

  const placements: PalletPlacement[] = []
  const maxToPlace = Math.min(totalPallets, selected.perFloor)
  const startX = frontClearance
  const startZ = sideClearance + selected.trailingResidualWidth / 2
  let placed = 0

  for (let iy = 0; iy < selected.ny; iy += 1) {
    for (let ix = 0; ix < selected.nx; ix += 1) {
      if (placed >= maxToPlace) {
        return placements
      }

      const x =
        -input.container.length / 2 +
        startX +
        selected.palletFootprintL / 2 +
        ix * selected.pitchLength
      const z =
        -input.container.width / 2 +
        startZ +
        selected.palletFootprintW / 2 +
        iy * selected.pitchWidth
      const y = input.pallet.height / 2

      placements.push({
        x,
        y,
        z,
        length: selected.palletFootprintL,
        width: selected.palletFootprintW,
        height: input.pallet.height,
        rotated: selected.orientation === 'WxL',
        index: placed,
        layer: 0,
      })
      placed += 1
    }
  }

  return placements
}

function trimPlacements(placements: PalletPlacement[], count: number): PalletPlacement[] {
  return placements.slice(0, Math.max(0, count)).map((placement, index) => ({
    ...placement,
    index,
  }))
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
      minLeft: 0,
      maxRight: 0,
      minTop: 0,
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
    minLeft,
    maxRight,
    minTop,
    maxBottom,
  }
}

function emptyResult(errors: string[]): ContainerResult {
  return {
    selected: { ...EMPTY_ORIENTATION },
    candidates: [{ ...EMPTY_ORIENTATION }],
    solverVariant: 'homogeneous',
    patternLabel: 'Sin patron',
    rowPattern: [],
    wallClearanceMm: 0,
    rearClearanceMm: 0,
    palletGapMm: 0,
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
    warnings: [],
  }
}

export function solveContainerLoading(input: ContainerInput): ContainerResult {
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
  if (!isPositive(input.pallet.length)) {
    errors.push('El largo del pallet de carga debe ser mayor a 0.')
  }
  if (!isPositive(input.pallet.width)) {
    errors.push('El ancho del pallet de carga debe ser mayor a 0.')
  }
  if (!isPositive(input.pallet.height)) {
    errors.push('El alto del pallet de carga debe ser mayor a 0.')
  }
  if (!isNonNegative(input.clearance)) {
    errors.push('La separacion entre pallets debe ser mayor o igual a 0.')
  }

  const rearClearanceRaw = input.rearClearance ?? input.clearance
  if (!isNonNegative(rearClearanceRaw)) {
    errors.push('La holgura de puerta debe ser mayor o igual a 0.')
  }

  if (input.weightPerPalletKg !== undefined && !isPositive(input.weightPerPalletKg)) {
    errors.push('El peso por pallet debe ser mayor a 0.')
  }
  if (input.payloadMaxKg !== undefined && !isPositive(input.payloadMaxKg)) {
    errors.push('El payload maximo debe ser mayor a 0.')
  }

  if (errors.length > 0) {
    return emptyResult(errors)
  }

  const wallClearance = 0
  const rearClearance = 0
  const palletGap = Math.max(0, input.clearance)
  const frontClearance = 0
  const sideClearance = 0
  const allowAlternating = input.allowAlternatingPattern !== false

  const planA = evaluateHomogeneousOrientation(
    'LxW',
    input.container.length,
    input.container.width,
    input.pallet.length,
    input.pallet.width,
    frontClearance,
    rearClearance,
    sideClearance,
    palletGap,
  )
  const planB = input.allowRotation
    ? evaluateHomogeneousOrientation(
        'WxL',
        input.container.length,
        input.container.width,
        input.pallet.width,
        input.pallet.length,
        frontClearance,
        rearClearance,
        sideClearance,
        palletGap,
      )
    : null

  const selectedHomogeneous = selectBestOrientation(planA, planB)
  const candidates = planB ? [planA, planB] : [planA]

  const homogeneousPlacements = buildHomogeneousPlacements(
    input,
    selectedHomogeneous,
    selectedHomogeneous.perFloor,
    frontClearance,
    sideClearance,
  )

  const alternating = allowAlternating
    ? solveAlternatingByRows(
        input,
        frontClearance,
        rearClearance,
        sideClearance,
        palletGap,
      )
    : null

  const useAlternating =
    alternating !== null &&
    (alternating.totalPalletsBySpace > selectedHomogeneous.perFloor ||
      (alternating.totalPalletsBySpace === selectedHomogeneous.perFloor &&
        alternating.utilizationArea > selectedHomogeneous.utilizationArea))

  const selected = useAlternating ? alternating.selected : selectedHomogeneous
  const solverVariant: ContainerResult['solverVariant'] = useAlternating
    ? 'alternating'
    : 'homogeneous'
  const patternLabel = useAlternating
    ? alternating.patternLabel
    : `Homogeneo ${selectedHomogeneous.orientation}`
  const rowPattern = useAlternating ? alternating.rowPattern : [selectedHomogeneous.orientation]
  const totalPalletsBySpace = useAlternating
    ? alternating.totalPalletsBySpace
    : selectedHomogeneous.perFloor

  if (totalPalletsBySpace === 0) {
    warnings.push('No hay espacio util en planta para ubicar pallets.')
  }

  const availableHeight = input.container.height
  const heightFits = input.pallet.height <= availableHeight
  if (!heightFits) {
    warnings.push('El pallet de carga no cabe en altura dentro del contenedor.')
  }

  let totalPalletsByWeight: number | null = null
  if (
    input.weightPerPalletKg !== undefined &&
    input.payloadMaxKg !== undefined &&
    input.weightPerPalletKg > 0
  ) {
    totalPalletsByWeight = Math.max(0, Math.floor(input.payloadMaxKg / input.weightPerPalletKg))
  }

  let totalPallets = totalPalletsBySpace
  if (totalPalletsByWeight !== null) {
    if (totalPalletsByWeight < totalPalletsBySpace) {
      warnings.push('El limite de payload reduce la cantidad total de pallets.')
    }
    totalPallets = Math.min(totalPalletsBySpace, totalPalletsByWeight)
  }
  if (!heightFits) {
    totalPallets = 0
  }

  const placementsBySpace = useAlternating
    ? (alternating?.placements ?? [])
    : homogeneousPlacements
  const placements = trimPlacements(placementsBySpace, totalPallets)
  const span = getPlacementSpan(placements, input.container.length, input.container.width)
  const hasPlaced = placements.length > 0

  const containerArea = input.container.length * input.container.width
  const areaUsedForResult = span.occupiedLength * span.occupiedWidth
  const utilizationArea = containerArea > 0 ? areaUsedForResult / containerArea : 0

  const containerVolume = containerArea * input.container.height
  const loadVolume = totalPallets * input.pallet.length * input.pallet.width * input.pallet.height
  const utilizationVolume = containerVolume > 0 ? loadVolume / containerVolume : 0
  const weightTotalKg =
    input.weightPerPalletKg !== undefined ? input.weightPerPalletKg * totalPallets : null

  return {
    selected: {
      ...selected,
      occupiedLength: hasPlaced ? span.occupiedLength : selected.occupiedLength,
      occupiedWidth: hasPlaced ? span.occupiedWidth : selected.occupiedWidth,
      trailingResidualLength: hasPlaced
        ? Math.max(0, input.container.length - span.maxRight)
        : selected.trailingResidualLength,
      trailingResidualWidth: hasPlaced
        ? Math.max(0, input.container.width - span.maxBottom)
        : selected.trailingResidualWidth,
      utilizationArea,
    },
    candidates,
    solverVariant,
    patternLabel,
    rowPattern,
    wallClearanceMm: wallClearance,
    rearClearanceMm: rearClearance,
    palletGapMm: palletGap,
    floors: 1,
    totalPalletsBySpace,
    totalPalletsByWeight,
    totalPallets,
    utilizationArea,
    utilizationVolume,
    heightFits,
    availableHeight,
    freeHeight: Math.max(0, availableHeight - input.pallet.height),
    weightTotalKg,
    containerVolume,
    loadVolume,
    placements,
    errors,
    warnings,
  }
}
