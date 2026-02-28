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
  nx: 0,
  ny: 0,
  perFloor: 0,
  utilizationArea: 0,
  residualLength: 0,
  residualWidth: 0,
}

function evaluateOrientation(
  orientation: ContainerOrientationPlan['orientation'],
  containerL: number,
  containerW: number,
  palletL: number,
  palletW: number,
  clearance: number,
): ContainerOrientationPlan {
  const effectiveLength = Math.max(0, containerL - clearance)
  const effectiveWidth = Math.max(0, containerW - clearance)
  const nx = Math.max(0, Math.floor(effectiveLength / palletL))
  const ny = Math.max(0, Math.floor(effectiveWidth / palletW))
  const perFloor = nx * ny
  const containerArea = containerL * containerW
  const usedArea = (nx * palletL) * (ny * palletW)
  const utilizationArea = containerArea > 0 ? usedArea / containerArea : 0
  const residualLength = Math.max(0, effectiveLength - nx * palletL)
  const residualWidth = Math.max(0, effectiveWidth - ny * palletW)

  return {
    orientation,
    palletFootprintL: palletL,
    palletFootprintW: palletW,
    nx,
    ny,
    perFloor,
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

function emptyResult(errors: string[]): ContainerResult {
  return {
    selected: { ...EMPTY_ORIENTATION },
    candidates: [{ ...EMPTY_ORIENTATION }],
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

function buildPalletPlacements(
  input: ContainerInput,
  selected: ContainerOrientationPlan,
  totalPallets: number,
): PalletPlacement[] {
  if (totalPallets <= 0 || selected.perFloor <= 0) {
    return []
  }

  const placements: PalletPlacement[] = []
  const maxToPlace = Math.min(totalPallets, selected.perFloor)
  let placed = 0

  for (let iy = 0; iy < selected.ny; iy += 1) {
    for (let ix = 0; ix < selected.nx; ix += 1) {
      if (placed >= maxToPlace) {
        return placements
      }

      const x =
        -input.container.length / 2 +
        selected.palletFootprintL / 2 +
        ix * selected.palletFootprintL
      const z =
        -input.container.width / 2 +
        selected.palletFootprintW / 2 +
        iy * selected.palletFootprintW
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
    errors.push('El clearance debe ser mayor o igual a 0.')
  }
  if (
    input.weightPerPalletKg !== undefined &&
    !isPositive(input.weightPerPalletKg)
  ) {
    errors.push('El peso por pallet debe ser mayor a 0.')
  }
  if (input.payloadMaxKg !== undefined && !isPositive(input.payloadMaxKg)) {
    errors.push('El payload maximo debe ser mayor a 0.')
  }

  if (errors.length > 0) {
    return emptyResult(errors)
  }

  const planA = evaluateOrientation(
    'LxW',
    input.container.length,
    input.container.width,
    input.pallet.length,
    input.pallet.width,
    input.clearance,
  )
  const planB = input.allowRotation
    ? evaluateOrientation(
        'WxL',
        input.container.length,
        input.container.width,
        input.pallet.width,
        input.pallet.length,
        input.clearance,
      )
    : null

  const selected = selectBestOrientation(planA, planB)
  const candidates = planB ? [planA, planB] : [planA]
  const availableHeight = Math.max(0, input.container.height - input.clearance)
  const heightFits = input.pallet.height <= availableHeight

  if (!heightFits) {
    warnings.push(
      'El pallet de carga no cabe en altura dentro del contenedor con el clearance configurado.',
    )
  }

  const totalPalletsBySpace = selected.perFloor
  if (totalPalletsBySpace === 0) {
    warnings.push('No hay espacio util en planta para ubicar pallets.')
  }

  let totalPalletsByWeight: number | null = null
  if (
    input.weightPerPalletKg !== undefined &&
    input.payloadMaxKg !== undefined &&
    input.weightPerPalletKg > 0
  ) {
    totalPalletsByWeight = Math.max(
      0,
      Math.floor(input.payloadMaxKg / input.weightPerPalletKg),
    )
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

  const containerArea = input.container.length * input.container.width
  const palletFootprintArea = selected.palletFootprintL * selected.palletFootprintW
  const utilizationArea =
    containerArea > 0 ? (totalPallets * palletFootprintArea) / containerArea : 0

  const containerVolume =
    input.container.length * input.container.width * input.container.height
  const loadVolume =
    totalPallets * input.pallet.length * input.pallet.width * input.pallet.height
  const utilizationVolume = containerVolume > 0 ? loadVolume / containerVolume : 0

  const weightTotalKg =
    input.weightPerPalletKg !== undefined
      ? input.weightPerPalletKg * totalPallets
      : null

  const placements = buildPalletPlacements(input, selected, totalPallets)

  return {
    selected,
    candidates,
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
