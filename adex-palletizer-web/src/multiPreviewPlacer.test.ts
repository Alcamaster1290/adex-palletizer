import { buildMultiPreviewPlacement } from './multiPreviewPlacer'
import type { MultiPreviewInput } from './types'

describe('buildMultiPreviewPlacement', () => {
  it('coloca SKUs en orden y llena filas, columnas y capas de forma determinista', () => {
    const input: MultiPreviewInput = {
      pallet: { length: 1200, width: 1000, height: 150 },
      maxTotalHeight: 1200,
      overhang: 0,
      allowRotation: false,
      skus: [
        {
          id: 1,
          skuId: 'SKU-1',
          name: 'Producto 1',
          length: 600,
          width: 400,
          height: 200,
          quantity: 3,
          allowRotation: false,
        },
        {
          id: 2,
          skuId: 'SKU-2',
          name: 'Producto 2',
          length: 600,
          width: 400,
          height: 200,
          quantity: 2,
          allowRotation: false,
        },
      ],
    }

    const result = buildMultiPreviewPlacement(input)

    expect(result.errors).toHaveLength(0)
    expect(result.placedTotal).toBe(5)
    expect(result.unplacedTotal).toBe(0)

    const firstIds = result.boxes.slice(0, 3).map((box) => box.skuId)
    const nextIds = result.boxes.slice(3, 5).map((box) => box.skuId)

    expect(firstIds.every((id) => id === 'SKU-1')).toBe(true)
    expect(nextIds.every((id) => id === 'SKU-2')).toBe(true)
  })
})
