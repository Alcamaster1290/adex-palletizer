import { rectPack2d } from './rectPack2d'
import type {
  BoxInstance,
  SingleAdvancedLayerPlacement2D,
  SingleAdvancedResult,
  SolverInput,
} from './types'

const EMPTY_RESULT: SingleAdvancedResult = {
  perLayer: 0,
  layers: 0,
  totalBoxes: 0,
  totalHeight: 0,
  utilizationPerLayer: 0,
  utilizationGlobal: 0,
  usedAreaPerLayer: 0,
  freeAreaPerLayer: 0,
  residualLength: 0,
  residualWidth: 0,
  layerPlacements2D: [],
  boxes: [],
}

function isValidInput(input: SolverInput) {
  return (
    Number.isFinite(input.pallet.length) &&
    input.pallet.length > 0 &&
    Number.isFinite(input.pallet.width) &&
    input.pallet.width > 0 &&
    Number.isFinite(input.pallet.height) &&
    input.pallet.height > 0 &&
    Number.isFinite(input.box.length) &&
    input.box.length > 0 &&
    Number.isFinite(input.box.width) &&
    input.box.width > 0 &&
    Number.isFinite(input.box.height) &&
    input.box.height > 0 &&
    Number.isFinite(input.maxTotalHeight) &&
    input.maxTotalHeight > 0 &&
    Number.isFinite(input.overhang) &&
    input.overhang >= 0
  )
}

export function solveSingleAdvancedPacking(input: SolverInput): SingleAdvancedResult {
  if (!isValidInput(input)) {
    return { ...EMPTY_RESULT }
  }

  const available = input.maxTotalHeight - input.pallet.height
  if (available <= 0) {
    return {
      ...EMPTY_RESULT,
      totalHeight: input.pallet.height,
    }
  }

  const layers = Math.max(0, Math.floor(available / input.box.height))
  if (layers === 0) {
    return {
      ...EMPTY_RESULT,
      layers: 0,
      totalHeight: input.pallet.height,
    }
  }

  const binWidth = input.pallet.length + input.overhang
  const binHeight = input.pallet.width + input.overhang
  const boxArea = input.box.length * input.box.width
  const maxByArea = Math.max(0, Math.floor((binWidth * binHeight) / boxArea))

  if (maxByArea === 0) {
    return {
      ...EMPTY_RESULT,
      layers,
      totalHeight: input.pallet.height + layers * input.box.height,
    }
  }

  const layerItems = Array.from({ length: maxByArea }, (_, index) => ({
    id: `single-layer-${index + 1}`,
    w: input.box.length,
    h: input.box.width,
    canRotate: input.allowRotation,
  }))

  const packedLayer = rectPack2d(binWidth, binHeight, layerItems, {
    allowRotatePerItem: true,
  })

  const layerPlacements2D: SingleAdvancedLayerPlacement2D[] = packedLayer.placements.map(
    (placement) => ({
      x: placement.x,
      y: placement.y,
      w: placement.w,
      h: placement.h,
      rotated: placement.rotated,
    }),
  )

  const perLayer = layerPlacements2D.length
  const totalBoxes = perLayer * layers
  const totalHeight = input.pallet.height + layers * input.box.height
  const palletArea = input.pallet.length * input.pallet.width
  const usedAreaPerLayer = layerPlacements2D.reduce(
    (sum, placement) => sum + placement.w * placement.h,
    0,
  )
  const freeAreaPerLayer = Math.max(0, palletArea - usedAreaPerLayer)
  const utilizationPerLayer = palletArea > 0 ? usedAreaPerLayer / palletArea : 0
  const utilizationGlobal = utilizationPerLayer

  const occupiedLength = layerPlacements2D.reduce(
    (maxValue, placement) => Math.max(maxValue, placement.x + placement.w),
    0,
  )
  const occupiedWidth = layerPlacements2D.reduce(
    (maxValue, placement) => Math.max(maxValue, placement.y + placement.h),
    0,
  )

  const residualLength = Math.max(0, input.pallet.length - occupiedLength)
  const residualWidth = Math.max(0, input.pallet.width - occupiedWidth)

  const boxes: BoxInstance[] = []
  for (let layer = 0; layer < layers; layer += 1) {
    layerPlacements2D.forEach((placement) => {
      boxes.push({
        x: -input.pallet.length / 2 + placement.x + placement.w / 2,
        y: input.pallet.height + input.box.height / 2 + layer * input.box.height,
        z: -input.pallet.width / 2 + placement.y + placement.h / 2,
        length: placement.w,
        width: placement.h,
        height: input.box.height,
        rotated: placement.rotated,
        layer,
      })
    })
  }

  return {
    perLayer,
    layers,
    totalBoxes,
    totalHeight,
    utilizationPerLayer,
    utilizationGlobal,
    usedAreaPerLayer,
    freeAreaPerLayer,
    residualLength,
    residualWidth,
    layerPlacements2D,
    boxes,
  }
}

