import { solveContainerLoading } from './containerSolver'
import type { ContainerInput, ContainerPalletCatalogEntry, ExportedPalletLoad } from './types'

function buildLoad(
  source: 'single' | 'multi',
  palletLengthMm: number,
  palletWidthMm: number,
  palletHeightMm: number,
  loadTotalHeightMm: number,
): ExportedPalletLoad {
  return {
    palletLengthMm,
    palletWidthMm,
    palletHeightMm,
    loadTotalHeightMm,
    boxesPlacements: [],
    source,
    meta: {
      totalBoxes: 0,
    },
  }
}

function buildEntry(
  id: string,
  overrides?: Partial<ContainerPalletCatalogEntry>,
): ContainerPalletCatalogEntry {
  return {
    id,
    name: id,
    source: 'single',
    quantity: 1,
    pallet: { length: 1200, width: 1000, height: 1150 },
    weightPerPalletKg: 800,
    load: buildLoad('single', 1200, 1000, 150, 1150),
    color: '#b88752',
    ...overrides,
  }
}

function buildInput(pallets: ContainerPalletCatalogEntry[], overrides?: Partial<ContainerInput>): ContainerInput {
  return {
    preset: '20gp',
    container: { length: 5898, width: 2352, height: 2393 },
    pallet: { length: 1200, width: 1000, height: 1150 },
    pallets,
    allowRotation: true,
    clearance: 50,
    rearClearance: 0,
    allowAlternatingPattern: true,
    ...overrides,
  }
}

function extractBounds(input: ContainerInput, placement: { x: number; z: number; length: number; width: number }) {
  const left = placement.x - placement.length / 2 + input.container.length / 2
  const right = placement.x + placement.length / 2 + input.container.length / 2
  const top = placement.z - placement.width / 2 + input.container.width / 2
  const bottom = placement.z + placement.width / 2 + input.container.width / 2
  return { left, right, top, bottom }
}

describe('solveContainerLoading consolidated mode', () => {
  it('usa solver consolidado y no excede el inventario agregado', () => {
    const input = buildInput([
      buildEntry('single-a', { quantity: 2 }),
      buildEntry('multi-b', {
        source: 'multi',
        quantity: 3,
        pallet: { length: 1200, width: 800, height: 1090 },
        load: buildLoad('multi', 1200, 800, 150, 1090),
        color: '#e67e22',
      }),
    ])

    const result = solveContainerLoading(input)

    expect(result.solverVariant).toBe('consolidated')
    expect(result.totalPallets).toBeLessThanOrEqual(5)
    expect(result.placements.every((placement) => placement.palletTypeId)).toBe(true)
    expect(result.placements.some((placement) => placement.palletTypeId === 'single-a')).toBe(true)
    expect(result.placements.some((placement) => placement.palletTypeId === 'multi-b')).toBe(true)
  })

  it('respeta gap entre pallets y no genera solapes en catalogo mixto', () => {
    const input = buildInput([
      buildEntry('single-a', { quantity: 2 }),
      buildEntry('multi-b', {
        source: 'multi',
        quantity: 3,
        pallet: { length: 1200, width: 800, height: 1090 },
        load: buildLoad('multi', 1200, 800, 150, 1090),
      }),
    ])

    const result = solveContainerLoading(input)
    const placements = result.placements.map((placement) => ({
      ...placement,
      ...extractBounds(input, placement),
    }))

    for (let i = 0; i < placements.length; i += 1) {
      for (let j = i + 1; j < placements.length; j += 1) {
        const a = placements[i]
        const b = placements[j]
        const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left)
        const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
        expect(overlapX <= 0 || overlapY <= 0).toBe(true)
      }
    }

    const rows = new Map<string, typeof placements>()
    placements.forEach((placement) => {
      const key = placement.top.toFixed(3)
      if (!rows.has(key)) {
        rows.set(key, [])
      }
      rows.get(key)?.push(placement)
    })

    rows.forEach((row) => {
      const ordered = [...row].sort((left, right) => left.left - right.left)
      for (let index = 0; index < ordered.length - 1; index += 1) {
        const gap = ordered[index + 1].left - ordered[index].right
        expect(gap).toBeGreaterThanOrEqual(input.clearance)
      }
    })
  })

  it('recorta placements cuando el payload no alcanza para el catalogo agregado', () => {
    const input = buildInput(
      [
        buildEntry('single-a', { quantity: 2, weightPerPalletKg: 900 }),
        buildEntry('single-b', { quantity: 2, weightPerPalletKg: 900 }),
      ],
      { payloadMaxKg: 1500 },
    )

    const result = solveContainerLoading(input)

    expect(result.totalPalletsBySpace).toBeGreaterThan(result.totalPallets)
    expect(result.totalPallets).toBe(1)
    expect(result.warnings.join(' ')).toMatch(/payload/i)
  })
})
