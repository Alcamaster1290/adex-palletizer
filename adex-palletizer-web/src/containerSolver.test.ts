import { solveContainerLoading } from './containerSolver'
import { CONTAINER_CLEARANCE_MM } from './constants'
import type { ContainerInput, PalletPlacement } from './types'

function buildInput(overrides?: Partial<ContainerInput>): ContainerInput {
  return {
    preset: '20gp',
    container: { length: 5898, width: 2352, height: 2393 },
    pallet: { length: 1200, width: 1000, height: 1200 },
    allowRotation: true,
    allowAlternatingPattern: true,
    clearance: CONTAINER_CLEARANCE_MM,
    rearClearance: 0,
    ...overrides,
  }
}

function extractBounds(input: ContainerInput, placement: PalletPlacement) {
  const left = placement.x - placement.length / 2 + input.container.length / 2
  const right = placement.x + placement.length / 2 + input.container.length / 2
  const top = placement.z - placement.width / 2 + input.container.width / 2
  const bottom = placement.z + placement.width / 2 + input.container.width / 2
  return { left, right, top, bottom }
}

describe('solveContainerLoading', () => {
  it('elige alternado por filas cuando mejora el total frente a homogéneo', () => {
    const baseline = solveContainerLoading(
      buildInput({
        allowAlternatingPattern: false,
      }),
    )
    const alternating = solveContainerLoading(
      buildInput({
        allowAlternatingPattern: true,
      }),
    )

    expect(alternating.solverVariant).toBe('alternating')
    expect(alternating.totalPalletsBySpace).toBeGreaterThan(baseline.totalPalletsBySpace)
    expect(alternating.patternLabel.toLowerCase()).toContain('alternado')
  })

  it("mejora sobre 8 pallets con Euro 1200x800 en 20' GP y holgura 0", () => {
    const result = solveContainerLoading(
      buildInput({
        pallet: { length: 1200, width: 800, height: 1200 },
        clearance: 0,
        rearClearance: 0,
        allowAlternatingPattern: true,
      }),
    )

    expect(result.errors).toHaveLength(0)
    expect(result.totalPalletsBySpace).toBeGreaterThan(8)
  })

  it('con holgura 50 no supera el total obtenido con holgura 0 para el mismo caso Euro', () => {
    const withoutClearance = solveContainerLoading(
      buildInput({
        pallet: { length: 1200, width: 800, height: 1200 },
        clearance: 0,
        rearClearance: 0,
        allowAlternatingPattern: true,
      }),
    )
    const withClearance = solveContainerLoading(
      buildInput({
        pallet: { length: 1200, width: 800, height: 1200 },
        clearance: 50,
        rearClearance: 50,
        allowAlternatingPattern: true,
      }),
    )

    expect(withClearance.totalPalletsBySpace).toBeLessThanOrEqual(
      withoutClearance.totalPalletsBySpace,
    )
  })

  it('respeta holguras de pared frontal/puerta/laterales y gap entre pallets', () => {
    const input = buildInput({
      container: { length: 5898, width: 2352, height: 2393 },
      pallet: { length: 1200, width: 1000, height: 1200 },
      clearance: 50,
      allowAlternatingPattern: true,
    })
    const result = solveContainerLoading(input)
    expect(result.errors).toHaveLength(0)
    expect(result.placements.length).toBeGreaterThan(0)

    const placementsWithBounds = result.placements.map((placement) => {
      const bounds = extractBounds(input, placement)
      expect(bounds.left).toBeGreaterThanOrEqual(0)
      expect(bounds.top).toBeGreaterThanOrEqual(0)
      expect(bounds.right).toBeLessThanOrEqual(input.container.length)
      expect(bounds.bottom).toBeLessThanOrEqual(input.container.width)
      return { ...placement, ...bounds }
    })

    const rowGroups = new Map<string, Array<typeof placementsWithBounds[number]>>()
    placementsWithBounds.forEach((placement) => {
      const key = placement.top.toFixed(3)
      if (!rowGroups.has(key)) {
        rowGroups.set(key, [])
      }
      rowGroups.get(key)?.push(placement)
    })

    rowGroups.forEach((row) => {
      const ordered = [...row].sort((left, right) => left.left - right.left)
      for (let index = 0; index < ordered.length - 1; index += 1) {
        const gap = ordered[index + 1].left - ordered[index].right
        expect(gap).toBeGreaterThanOrEqual(input.clearance)
      }
    })

    for (let i = 0; i < placementsWithBounds.length; i += 1) {
      for (let j = i + 1; j < placementsWithBounds.length; j += 1) {
        const a = placementsWithBounds[i]
        const b = placementsWithBounds[j]
        const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left)
        const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
        expect(overlapX <= 0 || overlapY <= 0).toBe(true)
      }
    }
  })

  it('si alternado está desactivado mantiene variante homogénea', () => {
    const result = solveContainerLoading(
      buildInput({
        allowAlternatingPattern: false,
      }),
    )

    expect(result.solverVariant).toBe('homogeneous')
    expect(result.patternLabel.toLowerCase()).toContain('homogeneo')
  })

  it('si no cabe en altura devuelve cero pallets y warning', () => {
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

  it('respeta payload cuando hay peso por pallet', () => {
    const result = solveContainerLoading(
      buildInput({
        weightPerPalletKg: 900,
        payloadMaxKg: 4000,
      }),
    )

    expect(result.totalPalletsByWeight).toBe(4)
    expect(result.totalPallets).toBeLessThanOrEqual(4)
    expect(result.warnings.join(' ')).toMatch(/payload/i)
  })
})
