import {
  deleteSkuLabel,
  loadSkuLabels,
  saveSkuLabels,
  SKU_LABELS_STORAGE_KEY,
  upsertSkuLabel,
} from './labelStorage'
import type { SkuLabelConfig } from '../types'

function createLabel(skuId: string): SkuLabelConfig {
  return {
    skuId,
    baseColor: '#b88752',
    template: 'export',
    shippingMarks: {
      consignee: 'A',
      destination: 'B',
      product: 'C',
      lot: 'D',
      cartonNo: 'E',
    },
    isoPictograms: ['fragile'],
    frontTextureDataUrl: 'data:image/png;base64,abc',
    updatedAt: '2026-03-02T00:00:00.000Z',
  }
}

describe('labelStorage', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('guarda y carga etiquetas por SKU', () => {
    const map = {
      'SKU-1': createLabel('SKU-1'),
    }
    saveSkuLabels(map)

    const loaded = loadSkuLabels()
    expect(loaded['SKU-1']?.skuId).toBe('SKU-1')
  })

  it('tolera payload invalido y retorna mapa vacio', () => {
    window.localStorage.setItem(SKU_LABELS_STORAGE_KEY, '{"broken": true}')
    const loaded = loadSkuLabels()
    expect(Object.keys(loaded)).toHaveLength(0)
  })

  it('upsert y delete son deterministas', () => {
    const empty = {}
    const afterUpsert = upsertSkuLabel(empty, createLabel('SKU-2'))
    expect(afterUpsert['SKU-2']).toBeDefined()

    const afterDelete = deleteSkuLabel(afterUpsert, 'SKU-2')
    expect(afterDelete['SKU-2']).toBeUndefined()
  })
})
