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
}

export interface MultiBoxTypeInput {
  id: number
  length: number
  width: number
  height: number
  units: number
}

export interface MultiPreviewInput {
  pallet: PalletInput
  maxTotalHeight: number
  allowRotation: boolean
  overhang: number
  boxTypes: MultiBoxTypeInput[]
}

export interface MultiTypePlacementSummary {
  typeId: number
  requested: number
  placed: number
  overflow: number
  layersUsed: number
  orientation: Orientation
  boxFootprintL: number
  boxFootprintW: number
  nx: number
  ny: number
  perLayer: number
  color: string
}

export interface MultiPreviewResult {
  boxes: BoxInstance[]
  byType: MultiTypePlacementSummary[]
  requestedTotal: number
  placedTotal: number
  overflowTotal: number
  availableHeight: number
  heightUsed: number
  heightFree: number
  errors: string[]
}
