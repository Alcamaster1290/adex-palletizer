import { describe, expect, it } from 'vitest'
import {
  buildExportedPalletLoadFromMulti,
  buildExportedPalletLoadFromSingle,
} from './containerPalletLoad'
import { buildMultiPreview } from './multiPreview'
import { solvePalletization } from './solver'
import type { MultiPreviewInput, SolverInput } from './types'

describe('containerPalletLoad', () => {
  it('buildExportedPalletLoadFromSingle devuelve altura total mayor al pallet y placements', () => {
    const input: SolverInput = {
      pallet: { length: 1200, width: 1000, height: 150 },
      box: { length: 500, width: 350, height: 450 },
      maxTotalHeight: 1200,
      allowRotation: true,
      overhang: 0,
    }
    const result = solvePalletization(input)

    const load = buildExportedPalletLoadFromSingle(input, result)

    expect(load.source).toBe('single')
    expect(load.loadTotalHeightMm).toBeGreaterThan(load.palletHeightMm)
    expect(load.boxesPlacements.length).toBeGreaterThan(0)
    expect(load.meta?.totalBoxes).toBe(result.totalBoxes)
  })

  it('buildExportedPalletLoadFromMulti calcula altura total desde boxes', () => {
    const input: MultiPreviewInput = {
      pallet: { length: 1200, width: 1000, height: 150 },
      maxTotalHeight: 1200,
      allowRotation: true,
      overhang: 0,
      skus: [
        {
          id: 1,
          skuId: 'SKU-1',
          name: 'Caja 1',
          length: 600,
          width: 400,
          height: 200,
          quantity: 8,
          allowRotation: true,
          color: '#2f8f9d',
          noStack: false,
        },
      ],
    }
    const result = buildMultiPreview(input)

    const load = buildExportedPalletLoadFromMulti(input, result)
    const expectedTop = Math.max(
      0,
      ...load.boxesPlacements.map((box) => box.yMm + box.heightMm / 2),
    )

    expect(load.source).toBe('multi')
    expect(load.boxesPlacements.length).toBeGreaterThan(0)
    expect(load.loadTotalHeightMm).toBe(input.pallet.height + expectedTop)
  })
})
