import type { OrientationPlan } from '../types'
import {
  buildTopViewCells,
  buildTopViewGeometry,
  buildTopViewLayout,
} from './topviewDimensions'

function createPlan(
  boxFootprintL: number,
  boxFootprintW: number,
  nx: number,
  ny: number,
): OrientationPlan {
  const usedLength = nx * boxFootprintL
  const usedWidth = ny * boxFootprintW
  return {
    orientation: 'LxW',
    boxFootprintL,
    boxFootprintW,
    nx,
    ny,
    perLayer: nx * ny,
    utilization: 0,
    areaUsed: usedLength * usedWidth,
    areaFree: 0,
    residualLength: 0,
    residualWidth: 0,
  }
}

describe('TopViewLayer helpers', () => {
  it('construye la grilla de celdas en orden determinista', () => {
    const cells = buildTopViewCells(3, 2)

    expect(cells).toHaveLength(6)
    expect(cells[0]).toEqual({ ix: 0, iy: 0 })
    expect(cells[5]).toEqual({ ix: 2, iy: 1 })
  })

  it('calcula geometria dentro del marco SVG', () => {
    const geometry = buildTopViewGeometry(1200, 1000)

    expect(geometry.drawLength).toBeLessThanOrEqual(
      geometry.frameWidth - (geometry.padding + geometry.dimensionBand) * 2,
    )
    expect(geometry.drawWidth).toBeLessThanOrEqual(
      geometry.frameHeight - (geometry.padding + geometry.dimensionBand) * 2,
    )
    expect(geometry.offsetX).toBeGreaterThanOrEqual(0)
    expect(geometry.offsetY).toBeGreaterThanOrEqual(0)
  })

  it('genera layout correcto para preset American 1200x1000', () => {
    const layout = buildTopViewLayout(1200, 1000, createPlan(600, 400, 2, 2))

    expect(layout.cells).toHaveLength(4)
    expect(layout.occupiedLength).toBe(1200)
    expect(layout.occupiedWidth).toBe(800)
    expect(layout.residualLength).toBe(0)
    expect(layout.residualWidth).toBe(200)
  })

  it('genera layout correcto para preset Euro 1200x800', () => {
    const layout = buildTopViewLayout(1200, 800, createPlan(600, 400, 2, 2))

    expect(layout.cells).toHaveLength(4)
    expect(layout.occupiedLength).toBe(1200)
    expect(layout.occupiedWidth).toBe(800)
    expect(layout.residualLength).toBe(0)
    expect(layout.residualWidth).toBe(0)
  })

  it('genera layout correcto para Custom 1300x900', () => {
    const layout = buildTopViewLayout(1300, 900, createPlan(600, 400, 2, 2))

    expect(layout.cells).toHaveLength(4)
    expect(layout.occupiedLength).toBe(1200)
    expect(layout.occupiedWidth).toBe(800)
    expect(layout.residualLength).toBe(100)
    expect(layout.residualWidth).toBe(100)
  })
})
