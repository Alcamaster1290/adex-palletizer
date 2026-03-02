import { solveMultiHeuristic } from './multiSolver'
import type { MultiPreviewInput } from './types'

describe('solveMultiHeuristic', () => {
  it('coloca todos los SKUs cuando hay espacio suficiente', () => {
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
          quantity: 8,
          allowRotation: true,
        },
      ],
    }

    const result = solveMultiHeuristic(input)

    expect(result.errors).toHaveLength(0)
    expect(result.totalPlaced).toBe(8)
    expect(result.totalUnplaced).toBe(0)
    expect(result.boxes).toHaveLength(8)
  })

  it('deja unidades como unplaced cuando no alcanza espacio', () => {
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
          quantity: 12,
          allowRotation: true,
        },
      ],
    }

    const result = solveMultiHeuristic(input)

    expect(result.totalPlaced).toBeLessThan(12)
    expect(result.totalUnplaced).toBeGreaterThan(0)
    expect(result.unplacedBySku.A).toBeGreaterThan(0)
  })

  it('con 2 SKUs mantiene o mejora baseline de colocacion del heuristico anterior', () => {
    const input: MultiPreviewInput = {
      pallet: { length: 1200, width: 1000, height: 150 },
      maxTotalHeight: 350,
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
          quantity: 3,
          allowRotation: true,
        },
        {
          id: 2,
          skuId: 'B',
          name: 'SKU B',
          length: 600,
          width: 400,
          height: 200,
          quantity: 3,
          allowRotation: true,
        },
      ],
    }

    const previousBaseline = 4
    const result = solveMultiHeuristic(input)

    expect(result.totalPlaced).toBeGreaterThanOrEqual(previousBaseline)
  })

  it('mantiene contrato de salida esperado', () => {
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
          quantity: 4,
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

    const result = solveMultiHeuristic(input)

    expect(result).toMatchObject({
      algorithm: 'heuristic',
      totalPlaced: expect.any(Number),
      totalUnplaced: expect.any(Number),
      layersUsed: expect.any(Number),
      utilization: expect.any(Number),
      placedBySku: expect.any(Object),
      unplacedBySku: expect.any(Object),
    })

    if (result.boxes.length > 0) {
      expect(result.boxes[0]).toMatchObject({
        skuId: expect.any(String),
        x: expect.any(Number),
        y: expect.any(Number),
        z: expect.any(Number),
        length: expect.any(Number),
        width: expect.any(Number),
        height: expect.any(Number),
        rotated: expect.any(Boolean),
      })
    }
  })

  it('respeta noStack: el SKU no aparece en capas superiores', () => {
    const input: MultiPreviewInput = {
      pallet: { length: 1200, width: 1000, height: 150 },
      maxTotalHeight: 1200,
      overhang: 0,
      allowRotation: true,
      skus: [
        {
          id: 1,
          skuId: 'NST',
          name: 'No stack',
          length: 600,
          width: 400,
          height: 200,
          quantity: 10,
          allowRotation: true,
          noStack: true,
        },
      ],
    }

    const result = solveMultiHeuristic(input)
    const noStackBoxes = result.boxes.filter((box) => box.skuId === 'NST')

    expect(noStackBoxes.length).toBeGreaterThan(0)
    expect(noStackBoxes.every((box) => (box.layer ?? 0) === 0)).toBe(true)
  })

  it('respeta maxLayers por SKU', () => {
    const input: MultiPreviewInput = {
      pallet: { length: 1200, width: 1000, height: 150 },
      maxTotalHeight: 1200,
      overhang: 0,
      allowRotation: true,
      skus: [
        {
          id: 1,
          skuId: 'MAX2',
          name: 'Max 2 layers',
          length: 600,
          width: 400,
          height: 200,
          quantity: 20,
          allowRotation: true,
          maxLayers: 2,
        },
      ],
    }

    const result = solveMultiHeuristic(input)
    const skuBoxes = result.boxes.filter((box) => box.skuId === 'MAX2')

    expect(skuBoxes.length).toBeGreaterThan(0)
    expect(skuBoxes.every((box) => (box.layer ?? 0) < 2)).toBe(true)
  })
})
