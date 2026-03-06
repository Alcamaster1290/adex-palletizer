import {
  buildTopViewCells,
  buildTopViewDimensionLines,
  buildTopViewGeometry,
} from './topViewHelpers'

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
      geometry.frameWidth - geometry.padding * 2,
    )
    expect(geometry.drawWidth).toBeLessThanOrEqual(
      geometry.frameHeight - geometry.padding * 2,
    )
    expect(geometry.offsetX).toBeGreaterThanOrEqual(0)
    expect(geometry.offsetY).toBeGreaterThanOrEqual(0)
  })

  it('genera cotas tecnicas para total y residual cuando aplica', () => {
    const geometry = buildTopViewGeometry(1200, 1000)
    const lines = buildTopViewDimensionLines(
      geometry,
      1200,
      1000,
      1000,
      800,
      200,
      200,
    )

    expect(lines.some((line) => line.id === 'single-total-length')).toBe(true)
    expect(lines.some((line) => line.id === 'single-total-width')).toBe(true)
    expect(lines.some((line) => line.id === 'single-residual-length')).toBe(true)
    expect(lines.some((line) => line.id === 'single-residual-width')).toBe(true)
  })
})
