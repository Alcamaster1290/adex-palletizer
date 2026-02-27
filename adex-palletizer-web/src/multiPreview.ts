import { MULTI_TYPE_COLORS } from './constants'
import { selectBestOrientation } from './solver'
import type {
  BoxInstance,
  MultiPreviewInput,
  MultiPreviewResult,
  MultiTypePlacementSummary,
  OrientationPlan,
} from './types'

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
  if (input.boxTypes.length === 0) {
    errors.push('Debe existir al menos un tipo de caja para generar la vista 3D.')
  }

  input.boxTypes.forEach((boxType, index) => {
    if (!isPositive(boxType.length)) {
      errors.push(`Tipo ${index + 1}: largo invalido.`)
    }
    if (!isPositive(boxType.width)) {
      errors.push(`Tipo ${index + 1}: ancho invalido.`)
    }
    if (!isPositive(boxType.height)) {
      errors.push(`Tipo ${index + 1}: alto invalido.`)
    }
    if (!Number.isInteger(boxType.units) || boxType.units < 1) {
      errors.push(`Tipo ${index + 1}: unidades debe ser entero mayor o igual a 1.`)
    }
  })

  return errors
}

function emptyResult(errors: string[]): MultiPreviewResult {
  return {
    boxes: [],
    byType: [],
    requestedTotal: 0,
    placedTotal: 0,
    overflowTotal: 0,
    availableHeight: 0,
    heightUsed: 0,
    heightFree: 0,
    errors,
  }
}

export function buildMultiPreview(input: MultiPreviewInput): MultiPreviewResult {
  const errors = validateInput(input)
  if (errors.length > 0) {
    return emptyResult(errors)
  }

  const availableHeight = Math.max(0, input.maxTotalHeight - input.pallet.height)
  if (input.maxTotalHeight <= input.pallet.height) {
    errors.push(
      'La altura maxima total debe ser mayor que la altura del pallet para apilar cajas.',
    )
  }

  let usedHeight = 0
  let placedTotal = 0
  let overflowTotal = 0
  let requestedTotal = 0

  const boxes: BoxInstance[] = []
  const byType: MultiTypePlacementSummary[] = []

  input.boxTypes.forEach((boxType, index) => {
    const requested = boxType.units
    requestedTotal += requested

    const planA = evaluateOrientation(
      'LxW',
      input.pallet.length,
      input.pallet.width,
      boxType.length,
      boxType.width,
      input.overhang,
    )

    const planB = input.allowRotation
      ? evaluateOrientation(
          'WxL',
          input.pallet.length,
          input.pallet.width,
          boxType.width,
          boxType.length,
          input.overhang,
        )
      : null

    const selected = selectBestOrientation(planA, planB)
    const remainingHeight = Math.max(0, availableHeight - usedHeight)

    let placed = 0
    let layersUsed = 0
    const color = MULTI_TYPE_COLORS[index % MULTI_TYPE_COLORS.length]

    if (selected.perLayer > 0 && remainingHeight >= boxType.height) {
      const layersCapacity = Math.floor(remainingHeight / boxType.height)
      const maxByHeight = layersCapacity * selected.perLayer
      placed = Math.min(requested, maxByHeight)
      layersUsed = placed > 0 ? Math.ceil(placed / selected.perLayer) : 0

      for (let unitIndex = 0; unitIndex < placed; unitIndex += 1) {
        const layerIndex = Math.floor(unitIndex / selected.perLayer)
        const indexInLayer = unitIndex % selected.perLayer
        const ix = indexInLayer % selected.nx
        const iy = Math.floor(indexInLayer / selected.nx)

        const x =
          -input.pallet.length / 2 +
          selected.boxFootprintL / 2 +
          ix * selected.boxFootprintL
        const z =
          -input.pallet.width / 2 +
          selected.boxFootprintW / 2 +
          iy * selected.boxFootprintW
        const y =
          input.pallet.height +
          usedHeight +
          boxType.height / 2 +
          layerIndex * boxType.height

        boxes.push({
          x,
          y,
          z,
          length: selected.boxFootprintL,
          width: selected.boxFootprintW,
          height: boxType.height,
          color,
          typeId: boxType.id,
        })
      }
    }

    const overflow = requested - placed
    usedHeight += layersUsed * boxType.height
    placedTotal += placed
    overflowTotal += overflow

    byType.push({
      typeId: boxType.id,
      requested,
      placed,
      overflow,
      layersUsed,
      orientation: selected.orientation,
      boxFootprintL: selected.boxFootprintL,
      boxFootprintW: selected.boxFootprintW,
      nx: selected.nx,
      ny: selected.ny,
      perLayer: selected.perLayer,
      color,
    })
  })

  return {
    boxes,
    byType,
    requestedTotal,
    placedTotal,
    overflowTotal,
    availableHeight,
    heightUsed: usedHeight,
    heightFree: Math.max(0, availableHeight - usedHeight),
    errors,
  }
}
