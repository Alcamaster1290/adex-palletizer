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

  it('aumenta huellas para SKU unico qty=10 cuando mejora ocupacion de area', () => {
    const input: MultiPreviewInput = {
      pallet: { length: 1200, width: 1000, height: 150 },
      maxTotalHeight: 650,
      overhang: 0,
      allowRotation: true,
      noMixedSkuStacking: true,
      skus: [
        {
          id: 1,
          skuId: 'ORG',
          name: 'Naranja',
          length: 600,
          width: 400,
          height: 100,
          quantity: 10,
          allowRotation: true,
        },
      ],
    }

    const result = solveMultiHeuristicNoMix(input)
    const palletArea = input.pallet.length * input.pallet.width
    const usedArea = Math.round(result.utilization * palletArea)
    const baselineHighColumns = 2
    const baselineHighArea = baselineHighColumns * 600 * 400

    expect(result.errors).toHaveLength(0)
    expect(result.columnsBySku?.ORG ?? 0).toBeGreaterThanOrEqual(3)
    expect(usedArea).toBeGreaterThanOrEqual(baselineHighArea)
    expect(result.placedBySku.ORG).toBe(10)
    expect(() => assertNoMixedColumns(result.boxes)).not.toThrow()
  })

  it('en el caso default multi noMix evita quedarse en 4 huellas y llena mejor el pallet', () => {
    const input: MultiPreviewInput = {
      pallet: { length: 1200, width: 1000, height: 150 },
      maxTotalHeight: 1200,
      overhang: 0,
      allowRotation: true,
      noMixedSkuStacking: true,
      skus: [
        {
          id: 1,
          skuId: 'SKU-1',
          name: 'Caja A',
          length: 600,
          width: 400,
          height: 200,
          quantity: 8,
          allowRotation: true,
        },
        {
          id: 2,
          skuId: 'SKU-2',
          name: 'Caja B',
          length: 600,
          width: 400,
          height: 200,
          quantity: 10,
          allowRotation: true,
        },
      ],
    }

    const result = solveMultiHeuristicNoMix(input)
    const columnsTotal = Object.values(result.columnsBySku ?? {}).reduce(
      (sum, value) => sum + value,
      0,
    )

    expect(result.errors).toHaveLength(0)
    expect(result.placedTotal).toBe(18)
    expect(columnsTotal).toBeGreaterThanOrEqual(5)
    expect(result.columnsBySku?.['SKU-2'] ?? 0).toBeGreaterThanOrEqual(3)
    expect(result.utilization).toBeGreaterThanOrEqual(0.99)
    expect(() => assertNoMixedColumns(result.boxes)).not.toThrow()
  })

  it('en caso de 2 SKUs mejora huellas del SKU de mayor qty sin mezclar columnas', () => {
    const input: MultiPreviewInput = {
      pallet: { length: 1200, width: 1000, height: 150 },
      maxTotalHeight: 650,
      overhang: 0,
      allowRotation: true,
      noMixedSkuStacking: true,
      skus: [
        {
          id: 1,
          skuId: 'SKU1',
          name: 'SKU 1',
          length: 600,
          width: 400,
          height: 100,
          quantity: 3,
          allowRotation: true,
        },
        {
          id: 2,
          skuId: 'SKU2',
          name: 'SKU 2',
          length: 600,
          width: 400,
          height: 100,
          quantity: 10,
          allowRotation: true,
        },
      ],
    }

    const result = solveMultiHeuristicNoMix(input)

    expect(result.errors).toHaveLength(0)
    expect(result.columnsBySku?.SKU2 ?? 0).toBeGreaterThanOrEqual(3)
    expect(() => assertNoMixedColumns(result.boxes)).not.toThrow()
  })

  it('usa rotacion por columna cuando mejora el encaje', () => {
    const rotOn: MultiPreviewInput = {
      pallet: { length: 1000, width: 1000, height: 150 },
      maxTotalHeight: 350,
      overhang: 0,
      allowRotation: true,
      noMixedSkuStacking: true,
      skus: [
        {
          id: 1,
          skuId: 'ROT',
          name: 'Rotable',
          length: 600,
          width: 400,
          height: 200,
          quantity: 3,
          allowRotation: true,
        },
      ],
    }

    const rotOff: MultiPreviewInput = {
      ...rotOn,
      allowRotation: false,
      skus: [
        {
          ...rotOn.skus[0],
          allowRotation: false,
        },
      ],
    }

    const withRotation = solveMultiHeuristicNoMix(rotOn)
    const withoutRotation = solveMultiHeuristicNoMix(rotOff)

    expect(withRotation.placedTotal).toBeGreaterThan(withoutRotation.placedTotal)
    expect((withRotation.bySku.find((item) => item.skuId === 'ROT')?.rotationsUsed ?? 0)).toBeGreaterThan(0)
  })
})
