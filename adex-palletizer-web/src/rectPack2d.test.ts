import { rectPack2d } from './rectPack2d'
import type { RectPackPlacement } from './types'

function overlaps(a: RectPackPlacement, b: RectPackPlacement) {
  return !(
    a.x + a.w <= b.x ||
    b.x + b.w <= a.x ||
    a.y + a.h <= b.y ||
    b.y + b.h <= a.y
  )
}

describe('rectPack2d', () => {
  it('empaqueta 500x350 en bin 1200x1000 sin solapes y de forma determinista', () => {
    const items = Array.from({ length: 8 }, (_, index) => ({
      id: `item-${index + 1}`,
      w: 500,
      h: 350,
      canRotate: true,
    }))

    const runA = rectPack2d(1200, 1000, items)
    const runB = rectPack2d(1200, 1000, items)

    expect(runA.placements).toEqual(runB.placements)
    expect(runA.placements.length).toBeGreaterThan(0)
    expect(runA.stats.utilization).toBeGreaterThan(0)

    runA.placements.forEach((placement) => {
      expect(placement.x).toBeGreaterThanOrEqual(0)
      expect(placement.y).toBeGreaterThanOrEqual(0)
      expect(placement.x + placement.w).toBeLessThanOrEqual(1200)
      expect(placement.y + placement.h).toBeLessThanOrEqual(1000)
    })

    for (let i = 0; i < runA.placements.length; i += 1) {
      for (let j = i + 1; j < runA.placements.length; j += 1) {
        expect(overlaps(runA.placements[i], runA.placements[j])).toBe(false)
      }
    }
  })

  it('mixed orientation por item mejora colocacion frente a orientacion fija', () => {
    const fixedItems = Array.from({ length: 3 }, (_, index) => ({
      id: `f-${index + 1}`,
      w: 600,
      h: 400,
      canRotate: false,
    }))
    const mixedItems = Array.from({ length: 3 }, (_, index) => ({
      id: `m-${index + 1}`,
      w: 600,
      h: 400,
      canRotate: true,
    }))

    const fixed = rectPack2d(1000, 1000, fixedItems, { allowRotatePerItem: false })
    const mixed = rectPack2d(1000, 1000, mixedItems, { allowRotatePerItem: true })

    expect(fixed.placements.length).toBe(2)
    expect(mixed.placements.length).toBe(3)
    expect(mixed.stats.usedArea).toBeGreaterThan(fixed.stats.usedArea)
  })
})

