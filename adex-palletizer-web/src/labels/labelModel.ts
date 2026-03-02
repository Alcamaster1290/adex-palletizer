import type {
  IsoPictogramId,
  LabelTemplateId,
  ShippingMarks,
  SkuLabelConfig,
} from '../types'

export const SINGLE_BOX_SKU_ID = 'SINGLE-BOX'
export const LABEL_TEXTURE_SIZE = 1024

export const LABEL_TEMPLATE_OPTIONS: Array<{
  id: LabelTemplateId
  label: string
}> = [
  { id: 'minimal', label: 'Minimal' },
  { id: 'export', label: 'Export' },
  { id: 'retail', label: 'Retail' },
]

export const ISO_PICTOGRAM_OPTIONS: Array<{
  id: IsoPictogramId
  label: string
}> = [
  { id: 'thisSideUp', label: 'This Side Up' },
  { id: 'fragile', label: 'Fragile' },
  { id: 'keepDry', label: 'Keep Dry' },
  { id: 'keepAwayFromHeat', label: 'Keep Away From Heat' },
]

export const DEFAULT_ISO_PICTOGRAMS: IsoPictogramId[] = [
  'thisSideUp',
  'fragile',
  'keepDry',
  'keepAwayFromHeat',
]

export const DEFAULT_SHIPPING_MARKS: ShippingMarks = {
  consignee: 'ADEX TRAINING',
  destination: 'LIMA, PE',
  product: 'MASTER CARTON',
  lot: 'LOT-001',
  cartonNo: '1 / 1',
}

function normalizeHexColor(rawColor: string | undefined) {
  if (!rawColor) {
    return '#2f8f9d'
  }
  if (/^#[0-9a-fA-F]{6}$/.test(rawColor)) {
    return rawColor
  }
  if (/^[0-9a-fA-F]{6}$/.test(rawColor)) {
    return `#${rawColor}`
  }
  return '#2f8f9d'
}

export function createDefaultLabelConfig(
  skuId: string,
  color?: string,
): Omit<SkuLabelConfig, 'frontTextureDataUrl' | 'updatedAt'> {
  return {
    skuId,
    baseColor: normalizeHexColor(color),
    template: 'export',
    shippingMarks: { ...DEFAULT_SHIPPING_MARKS, product: skuId },
    isoPictograms: [...DEFAULT_ISO_PICTOGRAMS],
    gs1Text: '',
  }
}

export function normalizeLabelSkuId(rawSkuId: string, fallback = SINGLE_BOX_SKU_ID) {
  const trimmed = rawSkuId.trim()
  return trimmed.length > 0 ? trimmed : fallback
}

export function normalizeBaseColor(rawColor: string) {
  return normalizeHexColor(rawColor)
}
