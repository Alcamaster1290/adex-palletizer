import { buildMultiPreview } from './multiPreview'
import type { MultiPreviewInput } from './types'

describe('buildMultiPreview', () => {
  it('genera preview multicaja para 2 SKUs y reporta totales', () => {
    const input: MultiPreviewInput = {
      pallet: { length: 1200, width: 1000, height: 150 },
      maxTotalHeight: 1200,
      overhang: 0,
      allowRotation: true,
      skus: [
        {
          id: 1,
          skuId: 'A',
          name: 'SKU A',
          length: 600,
          width: 400,
          height: 200,
          quantity: 6,
          allowRotation: true,
        },
        {
          id: 2,
          skuId: 'B',
          name: 'SKU B',
          length: 600,
          width: 400,
          height: 200,
          quantity: 4,
          allowRotation: true,
        },
      ],
    }

    const result = buildMultiPreview(input)

    expect(result.errors).toHaveLength(0)
    expect(result.placedTotal).toBe(10)
    expect(result.unplacedTotal).toBe(0)
    expect(result.layersUsed).toBeGreaterThanOrEqual(1)
    expect(result.boxes.length).toBe(10)
    expect(result.bySku).toHaveLength(2)
  })

  it('reporta unplaced cuando se agota el espacio por altura', () => {
    const input: MultiPreviewInput = {
      pallet: { length: 1200, width: 1000, height: 150 },
      maxTotalHeight: 550,
      overhang: 0,
      allowRotation: true,
      skus: [
        {
          id: 1,
          skuId: 'A',
          name: 'SKU A',
          length: 600,
          width: 400,
          height: 200,
          quantity: 20,
          allowRotation: true,
        },
      ],
    }

    const result = buildMultiPreview(input)

    expect(result.placedTotal).toBeLessThan(20)
    expect(result.unplacedTotal).toBeGreaterThan(0)
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('marca SKU como unplaceable cuando no cabe en base', () => {
    const input: MultiPreviewInput = {
      pallet: { length: 500, width: 300, height: 150 },
      maxTotalHeight: 1200,
      overhang: 0,
      allowRotation: true,
      skus: [
        {
          id: 1,
          skuId: 'BIG',
          name: 'SKU grande',
          length: 800,
          width: 700,
          height: 200,
          quantity: 3,
          allowRotation: true,
        },
      ],
    }

    const result = buildMultiPreview(input)

    expect(result.bySku[0].unplaceable).toBe(3)
    expect(result.bySku[0].placed).toBe(0)
    expect(result.unplaceableTotal).toBe(3)
  })
})
