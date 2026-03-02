import type { SkuLabelConfig, SkuLabelsBySku } from '../types'

export const SKU_LABELS_STORAGE_KEY = 'adexPalletizer.skuLabels.v1'

function isShippingMarks(value: unknown) {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.consignee === 'string' &&
    typeof candidate.destination === 'string' &&
    typeof candidate.product === 'string' &&
    typeof candidate.lot === 'string' &&
    typeof candidate.cartonNo === 'string'
  )
}

function isSkuLabelConfig(value: unknown): value is SkuLabelConfig {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.skuId === 'string' &&
    typeof candidate.baseColor === 'string' &&
    typeof candidate.template === 'string' &&
    isShippingMarks(candidate.shippingMarks) &&
    Array.isArray(candidate.isoPictograms) &&
    typeof candidate.frontTextureDataUrl === 'string' &&
    typeof candidate.updatedAt === 'string'
  )
}

function sanitizeLabelMap(value: unknown): SkuLabelsBySku {
  if (!value || typeof value !== 'object') {
    return {}
  }

  const candidate = value as Record<string, unknown>
  const next: SkuLabelsBySku = {}
  Object.entries(candidate).forEach(([skuId, config]) => {
    if (isSkuLabelConfig(config) && config.skuId === skuId) {
      next[skuId] = config
    }
  })
  return next
}

export function loadSkuLabels(): SkuLabelsBySku {
  if (typeof window === 'undefined') {
    return {}
  }

  try {
    const raw = window.localStorage.getItem(SKU_LABELS_STORAGE_KEY)
    if (!raw) {
      return {}
    }
    const parsed = JSON.parse(raw) as unknown
    return sanitizeLabelMap(parsed)
  } catch {
    return {}
  }
}

export function saveSkuLabels(labelsBySku: SkuLabelsBySku) {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(SKU_LABELS_STORAGE_KEY, JSON.stringify(labelsBySku))
}

export function upsertSkuLabel(
  labelsBySku: SkuLabelsBySku,
  nextLabel: SkuLabelConfig,
): SkuLabelsBySku {
  return {
    ...labelsBySku,
    [nextLabel.skuId]: nextLabel,
  }
}

export function deleteSkuLabel(
  labelsBySku: SkuLabelsBySku,
  skuId: string,
): SkuLabelsBySku {
  const next = { ...labelsBySku }
  delete next[skuId]
  return next
}
