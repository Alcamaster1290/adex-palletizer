import type {
  BoxInstance,
  OrientationPlan,
  SolverInput,
  SolverResult,
} from './types'

const EMPTY_ORIENTATION: OrientationPlan = {
  orientation: 'LxW',
  boxFootprintL: 0,
  boxFootprintW: 0,
  nx: 0,
  ny: 0,
  perLayer: 0,
  utilization: 0,
  areaUsed: 0,
  areaFree: 0,
  residualLength: 0,
  residualWidth: 0,
}

const isPositive = (value: number) => Number.isFinite(value) && value > 0
const isNonNegative = (value: number) => Number.isFinite(value) && value >= 0

function evaluateOrientation(
  orientation: OrientationPlan['orientation'],
  palletL: number,
  palletW: number,
  boxL: number,
  boxW: number,
  overhang: number,
): OrientationPlan {
  const nx = Math.max(0, Math.floor((palletL + overhang) / boxL))
  const ny = Math.max(0, Math.floor((palletW + overhang) / boxW))
  const perLayer = nx * ny
  const areaUsed = (nx * boxL) * (ny * boxW)
  const palletArea = palletL * palletW
  const utilization = areaUsed / palletArea
  const areaFree = Math.max(0, palletArea - areaUsed)
  const residualLength = Math.max(0, palletL - nx * boxL)
  const residualWidth = Math.max(0, palletW - ny * boxW)

  return {
    orientation,
    boxFootprintL: boxL,
    boxFootprintW: boxW,
    nx,
    ny,
    perLayer,
    utilization,
    areaUsed,
    areaFree,
    residualLength,
    residualWidth,
  }
}

export function selectBestOrientation(
  planA: OrientationPlan,
  planB: OrientationPlan | null,
): OrientationPlan {
  if (planB === null) {
    return planA
  }

  if (planB.perLayer > planA.perLayer) {
    return planB
  }

  if (planB.perLayer === planA.perLayer && planB.utilization > planA.utilization) {
    return planB
  }

  return planA
}

export function solvePalletization(input: SolverInput): SolverResult {
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
  if (!isPositive(input.box.length)) {
    errors.push('El largo de la caja debe ser mayor a 0.')
  }
  if (!isPositive(input.box.width)) {
    errors.push('El ancho de la caja debe ser mayor a 0.')
  }
  if (!isPositive(input.box.height)) {
    errors.push('El alto de la caja debe ser mayor a 0.')
  }
  if (!isPositive(input.maxTotalHeight)) {
    errors.push('La altura total m\u00e1xima debe ser mayor a 0.')
  }
  if (!isNonNegative(input.overhang)) {
    errors.push('El overhang no puede ser negativo.')
  }

  if (errors.length > 0) {
    return {
      selected: { ...EMPTY_ORIENTATION },
      candidates: [{ ...EMPTY_ORIENTATION }],
      layers: 0,
      totalBoxes: 0,
      totalHeight: 0,
      availableHeight: 0,
      freeHeight: 0,
      palletArea: 0,
      usedArea: 0,
      freeArea: 0,
      totalBoxVolume: 0,
      maxLoadVolume: 0,
      volumeUtilization: 0,
      errors,
    }
  }

  const planA = evaluateOrientation(
    'LxW',
    input.pallet.length,
    input.pallet.width,
    input.box.length,
    input.box.width,
    input.overhang,
  )

  const planB = input.allowRotation
    ? evaluateOrientation(
        'WxL',
        input.pallet.length,
        input.pallet.width,
        input.box.width,
        input.box.length,
        input.overhang,
      )
    : null

  const selected = selectBestOrientation(planA, planB)
  const candidates = planB ? [planA, planB] : [planA]

  const available = input.maxTotalHeight - input.pallet.height
  let layers = 0

  if (available <= 0) {
    errors.push(
      'La altura m\u00e1xima total debe ser mayor que la altura del pallet para apilar cajas.',
    )
  } else {
    layers = Math.max(0, Math.floor(available / input.box.height))
  }

  const totalBoxes = selected.perLayer * layers
  const totalHeight = input.pallet.height + layers * input.box.height
  const availableHeight = Math.max(0, available)
  const freeHeight = Math.max(0, availableHeight - layers * input.box.height)
  const palletArea = input.pallet.length * input.pallet.width
  const usedArea = selected.areaUsed
  const freeArea = Math.max(0, palletArea - usedArea)
  const totalBoxVolume =
    totalBoxes * input.box.length * input.box.width * input.box.height
  const maxLoadVolume = palletArea * availableHeight
  const volumeUtilization =
    maxLoadVolume > 0 ? totalBoxVolume / maxLoadVolume : 0

  return {
    selected,
    candidates,
    layers,
    totalBoxes,
    totalHeight,
    availableHeight,
    freeHeight,
    palletArea,
    usedArea,
    freeArea,
    totalBoxVolume,
    maxLoadVolume,
    volumeUtilization,
    errors,
  }
}

export function buildBoxInstances(
  input: SolverInput,
  result: SolverResult,
): BoxInstance[] {
  if (result.layers === 0 || result.selected.perLayer === 0) {
    return []
  }

  const boxes: BoxInstance[] = []
  const { nx, ny, boxFootprintL, boxFootprintW } = result.selected

  for (let layer = 0; layer < result.layers; layer += 1) {
    for (let ix = 0; ix < nx; ix += 1) {
      for (let iy = 0; iy < ny; iy += 1) {
        const x = -input.pallet.length / 2 + boxFootprintL / 2 + ix * boxFootprintL
        const z = -input.pallet.width / 2 + boxFootprintW / 2 + iy * boxFootprintW
        const y =
          input.pallet.height + input.box.height / 2 + layer * input.box.height

        boxes.push({
          x,
          y,
          z,
          length: boxFootprintL,
          width: boxFootprintW,
          height: input.box.height,
        })
      }
    }
  }

  return boxes
}
