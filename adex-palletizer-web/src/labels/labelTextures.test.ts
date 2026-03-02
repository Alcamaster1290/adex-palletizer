import { resolveSkuTextureDataUrl } from './labelTextures'
import type { SkuLabelsBySku } from '../types'

describe('labelTextures mapping', () => {
  it('resuelve dataURL por skuId de forma determinista', () => {
    const labelsBySku: SkuLabelsBySku = {
      'SKU-1': {
        skuId: 'SKU-1',
        baseColor: '#2f8f9d',
        template: 'export',
        shippingMarks: {
          consignee: 'A',
          destination: 'B',
          product: 'C',
          lot: 'D',
          cartonNo: 'E',
        },
        isoPictograms: ['fragile'],
        frontTextureDataUrl: 'data:image/png;base64,AAA',
        updatedAt: '2026-03-02T00:00:00.000Z',
      },
    }

    expect(resolveSkuTextureDataUrl(labelsBySku, 'SKU-1')).toBe(
      'data:image/png;base64,AAA',
    )
    expect(resolveSkuTextureDataUrl(labelsBySku, 'SKU-404')).toBeNull()
    expect(resolveSkuTextureDataUrl(labelsBySku, undefined, 'SKU-1')).toBe(
      'data:image/png;base64,AAA',
    )
  })
})
