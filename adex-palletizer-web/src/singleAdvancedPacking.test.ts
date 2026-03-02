import { solvePalletization } from './solver'
import { solveSingleAdvancedPacking } from './singleAdvancedPacking'
import type { SolverInput } from './types'

describe('solveSingleAdvancedPacking', () => {
  it('mantiene no regresion del caso Grid de aceptacion', () => {
    const input: SolverInput = {
      pallet: { length: 1200, width: 1000, height: 150 },
      box: { length: 500, width: 350, height: 450 },
      maxTotalHeight: 1200,
      allowRotation: true,
      overhang: 0,
    }

    const grid = solvePalletization(input)

    expect(grid.selected.nx).toBe(3)
    expect(grid.selected.ny).toBe(2)
    expect(grid.selected.perLayer).toBe(6)
    expect(grid.layers).toBe(2)
    expect(grid.totalBoxes).toBe(12)
    expect(grid.totalHeight).toBe(1050)
  })

  it('en caso mixto produce total >= Grid', () => {
    const input: SolverInput = {
      pallet: { length: 1000, width: 1000, height: 150 },
      box: { length: 600, width: 400, height: 200 },
      maxTotalHeight: 550,
      allowRotation: true,
      overhang: 0,
    }

    const grid = solvePalletization(input)
    const advanced = solveSingleAdvancedPacking(input)

    expect(grid.totalBoxes).toBe(4)
    expect(advanced.perLayer).toBe(3)
    expect(advanced.totalBoxes).toBe(6)
    expect(advanced.totalBoxes).toBeGreaterThanOrEqual(grid.totalBoxes)
    expect(advanced.boxes.length).toBe(advanced.totalBoxes)
  })
})

