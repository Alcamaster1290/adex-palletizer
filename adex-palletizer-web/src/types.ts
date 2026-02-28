export interface DimensionsMM {
  length: number
  width: number
  height: number
}

export type PalletInput = DimensionsMM
export type BoxInput = DimensionsMM

export interface SolverInput {
  pallet: PalletInput
  box: BoxInput
  maxTotalHeight: number
  allowRotation: boolean
  overhang: number
}

export type Orientation = 'LxW' | 'WxL'

export interface OrientationPlan {
  orientation: Orientation
  boxFootprintL: number
  boxFootprintW: number
  nx: number
  ny: number
  perLayer: number
  utilization: number
  areaUsed: number
  areaFree: number
  residualLength: number
  residualWidth: number
}

export interface SolverResult {
  selected: OrientationPlan
  candidates: OrientationPlan[]
  layers: number
  totalBoxes: number
  totalHeight: number
  availableHeight: number
  freeHeight: number
  palletArea: number
  usedArea: number
  freeArea: number
  totalBoxVolume: number
  maxLoadVolume: number
  volumeUtilization: number
  errors: string[]
}

export interface BoxInstance {
  x: number
  y: number
  z: number
  length: number
  width: number
  height: number
  color?: string
  typeId?: number
  skuId?: string
  skuName?: string
  label?: string
  rotated?: boolean
  layer?: number
}

export interface MultiBoxTypeInput {
  id: number
  length: number
  width: number
  height: number
  units: number
}

export interface MultiSkuInput {
  id: number
  skuId: string
  name: string
  length: number
  width: number
  height: number
  quantity: number
  allowRotation: boolean
  color?: string
  maxLayers?: number
  noStack?: boolean
}

export interface MultiPreviewInput {
  pallet: PalletInput
  maxTotalHeight: number
  allowRotation: boolean
  overhang: number
  skus: MultiSkuInput[]
}

export interface MultiTypePlacementSummary {
  id: number
  skuId: string
  name: string
  requested: number
  placed: number
  unplaced: number
  unplaceable: number
  layersUsed: number
  rotationsUsed: number
  color: string
}

export interface MultiPreviewResult {
  algorithm: 'preview' | 'heuristic'
  boxes: BoxInstance[]
  bySku: MultiTypePlacementSummary[]
  placedBySku: Record<string, number>
  unplacedBySku: Record<string, number>
  requestedTotal: number
  placedTotal: number
  unplacedTotal: number
  unplaceableTotal: number
  totalPlaced: number
  totalUnplaced: number
  layersUsed: number
  utilization: number
  availableHeight: number
  heightUsed: number
  heightFree: number
  errors: string[]
  warnings: string[]
}
