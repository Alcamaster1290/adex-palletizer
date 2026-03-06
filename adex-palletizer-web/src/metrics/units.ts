import type { ContainerInput, ContainerResult, SolverInput } from '../types'

export interface SingleDerivedMetrics {
  palletAreaMm2: number
  usedAreaPerLayerMm2: number
  freeAreaPerLayerMm2: number
  palletBaseVolumeMm3: number
  totalBoxesVolumeMm3: number
  totalUnitizedVolumeMm3: number
}

export interface ContainerDerivedMetrics {
  containerAreaMm2: number
  occupiedFootprintAreaMm2: number
  occupiedBlockAreaMm2: number
  freeAreaMm2: number
  containerVolumeMm3: number
  loadVolumeMm3: number
  freeVolumeMm3: number
}

const MM2_PER_M2 = 1_000_000
const MM3_PER_M3 = 1_000_000_000

const integerFormatter = new Intl.NumberFormat('es-ES', {
  maximumFractionDigits: 0,
})

const decimalFormatter = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function normalizeNonNegative(value: number) {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, value)
}

export function areaMm2ToM2(valueMm2: number) {
  return normalizeNonNegative(valueMm2) / MM2_PER_M2
}

export function volumeMm3ToM3(valueMm3: number) {
  return normalizeNonNegative(valueMm3) / MM3_PER_M3
}

export function formatAreaMm2(valueMm2: number) {
  return `${integerFormatter.format(Math.round(normalizeNonNegative(valueMm2)))} mm²`
}

export function formatVolumeMm3(valueMm3: number) {
  return `${integerFormatter.format(Math.round(normalizeNonNegative(valueMm3)))} mm³`
}

export function formatAreaM2FromMm2(valueMm2: number) {
  return `${decimalFormatter.format(areaMm2ToM2(valueMm2))} m²`
}

export function formatVolumeM3FromMm3(valueMm3: number) {
  return `${decimalFormatter.format(volumeMm3ToM3(valueMm3))} m³`
}

export function formatAreaDualFromMm2(valueMm2: number) {
  return `${formatAreaM2FromMm2(valueMm2)} (${formatAreaMm2(valueMm2)})`
}

export function formatVolumeDualFromMm3(valueMm3: number) {
  return `${formatVolumeM3FromMm3(valueMm3)} (${formatVolumeMm3(valueMm3)})`
}

export function buildSingleDerivedMetrics(
  input: SolverInput,
  usedAreaPerLayerMm2: number,
  freeAreaPerLayerMm2: number,
  totalBoxesVolumeMm3: number,
): SingleDerivedMetrics {
  const palletAreaMm2 = normalizeNonNegative(input.pallet.length * input.pallet.width)
  const palletBaseVolumeMm3 = normalizeNonNegative(
    input.pallet.length * input.pallet.width * input.pallet.height,
  )
  const safeBoxesVolumeMm3 = normalizeNonNegative(totalBoxesVolumeMm3)

  return {
    palletAreaMm2,
    usedAreaPerLayerMm2: normalizeNonNegative(usedAreaPerLayerMm2),
    freeAreaPerLayerMm2: normalizeNonNegative(freeAreaPerLayerMm2),
    palletBaseVolumeMm3,
    totalBoxesVolumeMm3: safeBoxesVolumeMm3,
    totalUnitizedVolumeMm3: palletBaseVolumeMm3 + safeBoxesVolumeMm3,
  }
}

export function buildContainerDerivedMetrics(
  input: ContainerInput,
  result: ContainerResult,
): ContainerDerivedMetrics {
  const containerAreaMm2 = normalizeNonNegative(input.container.length * input.container.width)
  const occupiedFootprintAreaMm2 = normalizeNonNegative(
    result.placements.reduce(
      (sum, placement) => sum + placement.length * placement.width,
      0,
    ),
  )
  const occupiedBlockAreaMm2 = normalizeNonNegative(
    result.selected.occupiedLength * result.selected.occupiedWidth,
  )
  const freeAreaMm2 = Math.max(0, containerAreaMm2 - occupiedFootprintAreaMm2)
  const containerVolumeMm3 = normalizeNonNegative(result.containerVolume)
  const loadVolumeMm3 = normalizeNonNegative(result.loadVolume)
  const freeVolumeMm3 = Math.max(0, containerVolumeMm3 - loadVolumeMm3)

  return {
    containerAreaMm2,
    occupiedFootprintAreaMm2,
    occupiedBlockAreaMm2,
    freeAreaMm2,
    containerVolumeMm3,
    loadVolumeMm3,
    freeVolumeMm3,
  }
}
