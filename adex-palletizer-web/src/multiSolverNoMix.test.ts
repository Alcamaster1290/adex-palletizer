import { solveMultiHeuristicNoMix } from './multiSolverNoMix'
import { assertNoMixedColumns } from './multiSolverNoMix'
import { solveMultiHeuristic } from './multiSolver'
import type { MultiPreviewInput } from './types'

function columnKey(x: number, z: number) {
  return `${x.toFixed(3)}|${z.toFixed(3)}`
}

describe('solveMultiHeuristicNoMix', () => {
  it('nunca mezcla SKU en una misma columna (x,z)', () => {
    const input: MultiPreviewInput = {
      pallet: { length: 1200, width: 1000, height: 150 },
      maxTotalHeight: 550,
      overhang: 0,
      allowRotation: true,
      noMixedSkuStacking: true,
      skus: [
        {
          id: 1,
          skuId: 'A',
          name: 'SKU A',
          length: 600,
          width: 500,
          height: 200,
          quantity: 1,
          allowRotation: true,
        },
        {
          id: 2,
          skuId: 'B',
          name: 'SKU B',
          length: 600,
          width: 500,
          height: 200,
          quantity: 10,
          allowRotation: true,
        },
      ],
    }

    const result = solveMultiHeuristicNoMix(input)
    const skuByColumn = new Map<string, string>()

    expect(result.errors).toHaveLength(0)
    expect(result.algorithm).toBe('heuristic')
    expect(result.solverVariant).toBe('heuristic-columns')
    expect(result.boxes.length).toBeGreaterThan(0)

    result.boxes.forEach((box) => {
      const key = columnKey(box.x, box.z)
      const current = skuByColumn.get(key)
      if (!current) {
        skuByColumn.set(key, box.skuId ?? '')
        return
      }
      expect(box.skuId).toBe(current)
    })

    expect(() => assertNoMixedColumns(result.boxes)).not.toThrow()
  })

  it('detecta mezcla de columnas en un caso donde el solver FFD por capas reutiliza huella', () => {
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
          width: 500,
          height: 200,
          quantity: 1,
          allowRotation: true,
        },
        {
          id: 2,
          skuId: 'B',
          name: 'SKU B',
          length: 600,
          width: 500,
          height: 200,
          quantity: 10,
          allowRotation: true,
        },
      ],
    }

    const ffd = solveMultiHeuristic(input)
    expect(() => assertNoMixedColumns(ffd.boxes)).toThrow()

    const noMix = solveMultiHeuristicNoMix({
      ...input,
      noMixedSkuStacking: true,
    })
    expect(() => assertNoMixedColumns(noMix.boxes)).not.toThrow()
  })

  it('respeta noStack: el SKU no aparece en capas superiores', () => {
    const input: MultiPreviewInput = {
      pallet: { length: 1200, width: 1000, height: 150 },
      maxTotalHeight: 750,
      overhang: 0,
      allowRotation: true,
      noMixedSkuStacking: true,
      skus: [
        {
          id: 1,
          skuId: 'NST',
          name: 'No stack',
          length: 600,
          width: 500,
          height: 200,
          quantity: 8,
          allowRotation: true,
          noStack: true,
        },
      ],
    }

    const result = solveMultiHeuristicNoMix(input)
    const skuBoxes = result.boxes.filter((box) => box.skuId === 'NST')

    expect(skuBoxes.length).toBeGreaterThan(0)
    expect(skuBoxes.every((box) => (box.layer ?? 0) === 0)).toBe(true)
  })

  it('respeta maxLayers=1: no excede una caja por columna para ese SKU', () => {
    const input: MultiPreviewInput = {
      pallet: { length: 1200, width: 1000, height: 150 },
      maxTotalHeight: 950,
      overhang: 0,
      allowRotation: true,
      noMixedSkuStacking: true,
      skus: [
        {
          id: 1,
          skuId: 'ML1',
          name: 'Max layer 1',
          length: 600,
          width: 500,
          height: 200,
          quantity: 8,
          allowRotation: true,
          maxLayers: 1,
        },
      ],
    }

    const result = solveMultiHeuristicNoMix(input)
    const countByColumn = new Map<string, number>()

    result.boxes
      .filter((box) => box.skuId === 'ML1')
      .forEach((box) => {
        const key = columnKey(box.x, box.z)
        countByColumn.set(key, (countByColumn.get(key) ?? 0) + 1)
      })

    expect(countByColumn.size).toBeGreaterThan(0)
    expect(Array.from(countByColumn.values()).every((count) => count <= 1)).toBe(true)
  })

  it('es determinista para la misma entrada', () => {
    const input: MultiPreviewInput = {
      pallet: { length: 1200, width: 1000, height: 150 },
      maxTotalHeight: 950,
      overhang: 0,
      allowRotation: true,
      noMixedSkuStacking: true,
      skus: [
        {
          id: 1,
          skuId: 'A',
          name: 'A',
          length: 600,
          width: 500,
          height: 200,
          quantity: 6,
          allowRotation: true,
        },
        {
          id: 2,
          skuId: 'B',
          name: 'B',
          length: 600,
          width: 500,
          height: 200,
          quantity: 6,
          allowRotation: true,
        },
      ],
    }

    const first = solveMultiHeuristicNoMix(input)
    const second = solveMultiHeuristicNoMix(input)

    expect(second.boxes).toEqual(first.boxes)
    expect(second.columnsBySku).toEqual(first.columnsBySku)
    expect(second.bySku).toEqual(first.bySku)
  })
})
