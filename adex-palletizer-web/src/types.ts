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

export type PackingMode = 'grid' | 'advanced'

export interface RectPackItemInput {
  id: string
  w: number
  h: number
  canRotate: boolean
  skuId?: string
  color?: string
}

export interface RectPackPlacement {
  itemId: string
  skuId?: string
  color?: string
  x: number
  y: number
  w: number
  h: number
  rotated: boolean
}

export interface RectPackConfig {
  heuristic?: 'bestShortSideFit'
  allowRotatePerItem?: boolean
}

export interface RectPackResult {
  placements: RectPackPlacement[]
  unplaced: RectPackItemInput[]
  stats: {
    usedArea: number
    utilization: number
    freeRectCount: number
  }
}

export interface SingleAdvancedLayerPlacement2D {
  x: number
  y: number
  w: number
  h: number
  rotated: boolean
}

export interface SingleAdvancedResult {
  perLayer: number
  layers: number
  totalBoxes: number
  totalHeight: number
  utilizationPerLayer: number
  utilizationGlobal: number
  usedAreaPerLayer: number
  freeAreaPerLayer: number
  residualLength: number
  residualWidth: number
  layerPlacements2D: SingleAdvancedLayerPlacement2D[]
  boxes: BoxInstance[]
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

export type LabelTemplateId = 'minimal' | 'export' | 'retail'

export type IsoPictogramId =
  | 'thisSideUp'
  | 'fragile'
  | 'keepDry'
  | 'keepAwayFromHeat'

export interface ShippingMarks {
  consignee: string
  destination: string
  product: string
  lot: string
  cartonNo: string
}

export interface SkuLabelConfig {
  skuId: string
  baseColor: string
  template: LabelTemplateId
  shippingMarks: ShippingMarks
  isoPictograms: IsoPictogramId[]
  logoDataUrl?: string
  gs1Text?: string
  frontTextureDataUrl: string
  updatedAt: string
}

export type SkuLabelsBySku = Record<string, SkuLabelConfig>

export interface ExportedPalletBoxPlacement {
  xMm: number
  yMm: number
  zMm: number
  lengthMm: number
  widthMm: number
  heightMm: number
  skuId?: string
  color?: string
}

export interface ExportedPalletLoad {
  palletLengthMm: number
  palletWidthMm: number
  palletHeightMm: number
  loadTotalHeightMm: number
  boxesPlacements: ExportedPalletBoxPlacement[]
  source: 'single' | 'multi'
  meta?: {
    nx?: number
    ny?: number
    layers?: number
    totalBoxes?: number
  }
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
  noMixedSkuStacking?: boolean
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
  solverVariant?: 'heuristic-ffd' | 'heuristic-columns'
  boxes: BoxInstance[]
  bySku: MultiTypePlacementSummary[]
  placedBySku: Record<string, number>
  unplacedBySku: Record<string, number>
  columnsBySku?: Record<string, number>
  layersUsedBySku?: Record<string, number>
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

export type ContainerPresetKey = '20gp' | '40gp' | '40hc' | 'custom'

export interface ContainerInput {
  preset: ContainerPresetKey
  container: DimensionsMM
  pallet: DimensionsMM
  allowRotation: boolean
  clearance: number
  rearClearance?: number
  allowAlternatingPattern?: boolean
  weightPerPalletKg?: number
  payloadMaxKg?: number
  allowStacking?: boolean
}

export interface ContainerOrientationPlan {
  orientation: Orientation
  palletFootprintL: number
  palletFootprintW: number
  pitchLength: number
  pitchWidth: number
  marginToWall: number
  nx: number
  ny: number
  perFloor: number
  occupiedLength: number
  occupiedWidth: number
  trailingResidualLength: number
  trailingResidualWidth: number
  utilizationArea: number
  residualLength: number
  residualWidth: number
}

export interface PalletPlacement {
  x: number
  y: number
  z: number
  length: number
  width: number
  height: number
  rotated: boolean
  index: number
  layer: number
}

export interface ContainerResult {
  selected: ContainerOrientationPlan
  candidates: ContainerOrientationPlan[]
  solverVariant: 'homogeneous' | 'alternating'
  patternLabel: string
  rowPattern?: Orientation[]
  wallClearanceMm: number
  rearClearanceMm: number
  palletGapMm: number
  floors: number
  totalPalletsBySpace: number
  totalPalletsByWeight: number | null
  totalPallets: number
  utilizationArea: number
  utilizationVolume: number
  heightFits: boolean
  availableHeight: number
  freeHeight: number
  weightTotalKg: number | null
  containerVolume: number
  loadVolume: number
  placements: PalletPlacement[]
  errors: string[]
  warnings: string[]
}
