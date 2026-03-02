import { solveContainerLoading } from './containerSolver'
import { CONTAINER_CLEARANCE_MM } from './constants'
import type { ContainerInput } from './types'

function buildInput(overrides?: Partial<ContainerInput>): ContainerInput {
  return {
    preset: '20gp',
    container: { length: 5898, width: 2352, height: 2393 },
    pallet: { length: 1200, width: 1000, height: 1200 },
    allowRotation: true,
    clearance: CONTAINER_CLEARANCE_MM,
    ...overrides,
  }
}

describe('solveContainerLoading', () => {
  it('selecciona orientacion por mayor total de pallets con clearance en paredes y entre pallets', () => {
    const result = solveContainerLoading(buildInput())

    expect(result.selected.orientation).toBe('LxW')
    expect(result.selected.nx).toBe(4)
    expect(result.selected.ny).toBe(2)
    expect(result.totalPalletsBySpace).toBe(8)
    expect(result.totalPallets).toBe(8)
    expect(result.placements).toHaveLength(8)
  })

  it('garantiza margen a paredes y separacion minima entre pallets', () => {
    const input = buildInput()
    const result = solveContainerLoading(input)

    expect(result.errors).toHaveLength(0)
    expect(result.placements.length).toBeGreaterThan(0)

    const placementsWithBounds = result.placements.map((placement) => {
      const left = placement.x - placement.length / 2 + input.container.length / 2
      const right = placement.x + placement.length / 2 + input.container.length / 2
      const top = placement.z - placement.width / 2 + input.container.width / 2
      const bottom = placement.z + placement.width / 2 + input.container.width / 2

      expect(left).toBeGreaterThanOrEqual(input.clearance)
      expect(top).toBeGreaterThanOrEqual(input.clearance)
      expect(right).toBeLessThanOrEqual(input.container.length - input.clearance)
      expect(bottom).toBeLessThanOrEqual(input.container.width - input.clearance)

      return {
        x: placement.x,
        z: placement.z,
        left,
        right,
        top,
        bottom,
      }
    })

    const rows = new Map<string, Array<typeof placementsWithBounds[number]>>()
    placementsWithBounds.forEach((placement) => {
      const key = placement.z.toFixed(6)
      if (!rows.has(key)) {
        rows.set(key, [])
      }
      rows.get(key)?.push(placement)
    })

    rows.forEach((rowPlacements) => {
      const ordered = [...rowPlacements].sort((left, right) => left.left - right.left)
      for (let index = 0; index < ordered.length - 1; index += 1) {
        const gap = ordered[index + 1].left - ordered[index].right
        expect(gap).toBeGreaterThanOrEqual(input.clearance)
      }
    })

    const columns = new Map<string, Array<typeof placementsWithBounds[number]>>()
    placementsWithBounds.forEach((placement) => {
      const key = placement.x.toFixed(6)
      if (!columns.has(key)) {
        columns.set(key, [])
      }
      columns.get(key)?.push(placement)
    })

    columns.forEach((columnPlacements) => {
      const ordered = [...columnPlacements].sort((left, right) => left.top - right.top)
      for (let index = 0; index < ordered.length - 1; index += 1) {
        const gap = ordered[index + 1].top - ordered[index].bottom
        expect(gap).toBeGreaterThanOrEqual(input.clearance)
      }
    })
  })

  it('fuerza clearance minimo de 50 mm cuando llega un valor menor', () => {
    const input = buildInput({ clearance: 0 })
    const result = solveContainerLoading(input)

    expect(result.errors).toHaveLength(0)
    expect(result.selected.marginToWall).toBe(CONTAINER_CLEARANCE_MM)
    expect(result.selected.pitchLength).toBe(1200 + CONTAINER_CLEARANCE_MM)
    expect(result.selected.pitchWidth).toBe(1000 + CONTAINER_CLEARANCE_MM)
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

  it('si no cabe en altura marca warning y no ubica pallets sin descontar clearance vertical', () => {
    const result = solveContainerLoading(
      buildInput({
        pallet: { length: 1200, width: 1000, height: 2600 },
      }),
    )

    expect(result.heightFits).toBe(false)
    expect(result.totalPallets).toBe(0)
    expect(result.placements).toHaveLength(0)
    expect(result.availableHeight).toBe(2393)
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
