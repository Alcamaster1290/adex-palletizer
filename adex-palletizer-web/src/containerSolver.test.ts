import { solveContainerLoading } from './containerSolver'
import type { ContainerInput } from './types'

function buildInput(overrides?: Partial<ContainerInput>): ContainerInput {
  return {
    preset: '20gp',
    container: { length: 5898, width: 2352, height: 2393 },
    pallet: { length: 1200, width: 1000, height: 1200 },
    allowRotation: true,
    clearance: 0,
    ...overrides,
  }
}

describe('solveContainerLoading', () => {
  it('selecciona orientacion por mayor total de pallets', () => {
    const result = solveContainerLoading(buildInput())

    expect(result.selected.orientation).toBe('LxW')
    expect(result.selected.nx).toBe(4)
    expect(result.selected.ny).toBe(2)
    expect(result.totalPalletsBySpace).toBe(8)
    expect(result.totalPallets).toBe(8)
    expect(result.placements).toHaveLength(8)
  })

  it('respeta el limite de payload cuando hay peso por pallet', () => {
    const result = solveContainerLoading(
      buildInput({
        weightPerPalletKg: 900,
        payloadMaxKg: 4000,
      }),
    )

    expect(result.totalPalletsBySpace).toBe(8)
    expect(result.totalPalletsByWeight).toBe(4)
    expect(result.totalPallets).toBe(4)
    expect(result.weightTotalKg).toBe(3600)
    expect(result.warnings.join(' ')).toMatch(/payload/i)
  })

  it('si no cabe en altura marca warning y no ubica pallets', () => {
    const result = solveContainerLoading(
      buildInput({
        pallet: { length: 1200, width: 1000, height: 2600 },
      }),
    )

    expect(result.heightFits).toBe(false)
    expect(result.totalPallets).toBe(0)
    expect(result.placements).toHaveLength(0)
    expect(result.warnings.join(' ')).toMatch(/altura/i)
  })

  it('si rotacion esta deshabilitada solo evalua orientacion LxW', () => {
    const result = solveContainerLoading(
      buildInput({
        allowRotation: false,
      }),
    )

    expect(result.candidates).toHaveLength(1)
    expect(result.selected.orientation).toBe('LxW')
  })

  it('con empate mantiene orientacion A para asegurar determinismo', () => {
    const result = solveContainerLoading(
      buildInput({
        container: { length: 2500, width: 2500, height: 2400 },
        pallet: { length: 1000, width: 1000, height: 1000 },
      }),
    )

    expect(result.selected.perFloor).toBe(4)
    expect(result.selected.orientation).toBe('LxW')
  })
})
