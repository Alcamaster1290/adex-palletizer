import type { OrientationPlan } from '../types'

interface TopViewLayerProps {
  palletLength: number
  palletWidth: number
  selected: OrientationPlan
  layers: number
}

interface TopViewCell {
  ix: number
  iy: number
}

interface TopViewGeometry {
  frameWidth: number
  frameHeight: number
  padding: number
  scale: number
  drawLength: number
  drawWidth: number
  offsetX: number
  offsetY: number
}

const FRAME_WIDTH = 420
const FRAME_HEIGHT = 280
const PADDING = 24

export function buildTopViewCells(nx: number, ny: number): TopViewCell[] {
  const cells: TopViewCell[] = []
  for (let ix = 0; ix < nx; ix += 1) {
    for (let iy = 0; iy < ny; iy += 1) {
      cells.push({ ix, iy })
    }
  }
  return cells
}

export function buildTopViewGeometry(
  palletLength: number,
  palletWidth: number,
): TopViewGeometry {
  const scale = Math.min(
    (FRAME_WIDTH - PADDING * 2) / palletLength,
    (FRAME_HEIGHT - PADDING * 2) / palletWidth,
  )
  const drawLength = palletLength * scale
  const drawWidth = palletWidth * scale
  const offsetX = (FRAME_WIDTH - drawLength) / 2
  const offsetY = (FRAME_HEIGHT - drawWidth) / 2

  return {
    frameWidth: FRAME_WIDTH,
    frameHeight: FRAME_HEIGHT,
    padding: PADDING,
    scale,
    drawLength,
    drawWidth,
    offsetX,
    offsetY,
  }
}

export function TopViewLayer({
  palletLength,
  palletWidth,
  selected,
  layers,
}: TopViewLayerProps) {
  if (layers === 0 || selected.perLayer === 0) {
    return (
      <section className="top-view-panel">
        <div className="top-view-title-row">
          <h3>Top View por capa</h3>
        </div>
        <p className="top-view-empty">
          Sin patron disponible: revisa dimensiones o altura maxima.
        </p>
      </section>
    )
  }

  const geometry = buildTopViewGeometry(palletLength, palletWidth)
  const cells = buildTopViewCells(selected.nx, selected.ny)

  return (
    <section className="top-view-panel">
      <div className="top-view-title-row">
        <h3>Top View por capa</h3>
        <span>
          Patron: {selected.nx} x {selected.ny}
        </span>
      </div>

      <svg
        className="top-view-svg"
        viewBox={`0 0 ${geometry.frameWidth} ${geometry.frameHeight}`}
        role="img"
        aria-label="Vista superior del patron por capa"
      >
        <rect
          x={geometry.offsetX}
          y={geometry.offsetY}
          width={geometry.drawLength}
          height={geometry.drawWidth}
          className="top-view-pallet"
        />
        {cells.map((cell) => (
          <rect
            key={`top-cell-${cell.ix}-${cell.iy}`}
            x={geometry.offsetX + cell.ix * selected.boxFootprintL * geometry.scale}
            y={geometry.offsetY + cell.iy * selected.boxFootprintW * geometry.scale}
            width={selected.boxFootprintL * geometry.scale}
            height={selected.boxFootprintW * geometry.scale}
            className="top-view-box"
          />
        ))}
      </svg>

      <div className="top-view-metrics">
        <p>Residual eje largo: {selected.residualLength} mm</p>
        <p>Residual eje ancho: {selected.residualWidth} mm</p>
      </div>
    </section>
  )
}
