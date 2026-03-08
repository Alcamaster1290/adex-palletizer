import { buildBoxInstances, selectBestOrientation, solvePalletization } from './solver'
import type { OrientationPlan, SolverInput } from './types'

describe('solvePalletization', () => {
  it('cumple el caso de aceptacion especificado', () => {
    const input: SolverInput = {
      pallet: { length: 1200, width: 1000, height: 150 },
      box: { length: 500, width: 350, height: 450 },
      maxTotalHeight: 1200,
      allowRotation: true,
      overhang: 0,
    }

    const result = solvePalletization(input)

    expect(result.selected.nx).toBe(3)
    expect(result.selected.ny).toBe(2)
    expect(result.selected.perLayer).toBe(6)
    expect(result.layers).toBe(2)
    expect(result.totalBoxes).toBe(12)
    expect(result.totalHeight).toBe(1050)
  })

  it('si allowRotation es false solo usa orientacion LxW', () => {
    const input: SolverInput = {
      pallet: { length: 1200, width: 1000, height: 150 },
      box: { length: 700, width: 300, height: 200 },
      maxTotalHeight: 900,
      allowRotation: false,
      overhang: 0,
    }

    const result = solvePalletization(input)

    expect(result.selected.orientation).toBe('LxW')
    expect(result.selected.perLayer).toBe(3)
  })

  it('en empate de perLayer elige mayor utilizacion', () => {
    const planA: OrientationPlan = {
      orientation: 'LxW',
      boxFootprintL: 500,
      boxFootprintW: 300,
      nx: 2,
      ny: 2,
      perLayer: 4,
      utilization: 0.6,
      areaUsed: 600000,
      areaFree: 400000,
      residualLength: 200,
      residualWidth: 100,
    }
    const planB: OrientationPlan = {
      orientation: 'WxL',
      boxFootprintL: 300,
      boxFootprintW: 500,
      nx: 2,
      ny: 2,
      perLayer: 4,
      utilization: 0.65,
      areaUsed: 650000,
      areaFree: 350000,
      residualLength: 100,
      residualWidth: 50,
    }

    const selected = selectBestOrientation(planA, planB)

    expect(selected.orientation).toBe('WxL')
    expect(selected.utilization).toBe(0.65)
  })

  it('en empate total mantiene orientacion A para asegurar determinismo', () => {
    const planA: OrientationPlan = {
      orientation: 'LxW',
      boxFootprintL: 600,
      boxFootprintW: 400,
      nx: 2,
      ny: 2,
      perLayer: 4,
      utilization: 0.8,
      areaUsed: 800000,
      areaFree: 200000,
      residualLength: 0,
      residualWidth: 100,
    }
    const planB: OrientationPlan = {
      orientation: 'WxL',
      boxFootprintL: 400,
      boxFootprintW: 600,
      nx: 2,
      ny: 2,
      perLayer: 4,
      utilization: 0.8,
      areaUsed: 800000,
      areaFree: 200000,
      residualLength: 100,
      residualWidth: 0,
    }

    const selected = selectBestOrientation(planA, planB)

    expect(selected).toBe(planA)
  })

  it('si maxTotalHeight es menor o igual al pallet, retorna layers 0 y error', () => {
    const input: SolverInput = {
      pallet: { length: 1200, width: 1000, height: 150 },
      box: { length: 500, width: 350, height: 450 },
      maxTotalHeight: 150,
      allowRotation: true,
      overhang: 0,
    }

    const result = solvePalletization(input)

    expect(result.layers).toBe(0)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('inputs invalidos retornan valores seguros y errores', () => {
    const input: SolverInput = {
      pallet: { length: 1200, width: 1000, height: 0 },
      box: { length: -500, width: 350, height: 450 },
      maxTotalHeight: 1200,
      allowRotation: true,
      overhang: -1,
    }

    const result = solvePalletization(input)

    expect(result.selected.perLayer).toBe(0)
    expect(result.layers).toBe(0)
    expect(result.totalBoxes).toBe(0)
    expect(result.totalHeight).toBe(0)
    expect(result.volumeUtilization).toBe(0)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('calcula metricas extendidas de area y altura libre', () => {
    const input: SolverInput = {
      pallet: { length: 1200, width: 1000, height: 150 },
      box: { length: 500, width: 350, height: 450 },
      maxTotalHeight: 1200,
      allowRotation: true,
      overhang: 0,
    }

    const result = solvePalletization(input)

    expect(result.palletArea).toBe(1200000)
    expect(result.usedArea).toBe(1050000)
    expect(result.freeArea).toBe(150000)
    expect(result.availableHeight).toBe(1050)
    expect(result.freeHeight).toBe(150)
    expect(result.candidates.length).toBe(2)
  })

  it('buildBoxInstances respeta conteo y posiciones base del solver single', () => {
    const input: SolverInput = {
      pallet: { length: 1200, width: 1000, height: 150 },
      box: { length: 500, width: 350, height: 450 },
      maxTotalHeight: 1200,
      allowRotation: true,
      overhang: 0,
    }

    const result = solvePalletization(input)
    const boxes = buildBoxInstances(input, result)

    expect(boxes).toHaveLength(12)
    expect(boxes[0]).toEqual({
      x: -425,
      y: 375,
      z: -250,
      length: 350,
      width: 500,
      height: 450,
      layer: 0,
    })
    expect(boxes[11]).toEqual({
      x: 275,
      y: 825,
      z: 250,
      length: 350,
      width: 500,
      height: 450,
      layer: 1,
    })
  })
})
