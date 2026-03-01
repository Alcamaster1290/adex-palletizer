import { useState } from 'react'
import type { OrientationPlan } from '../types'

interface TopViewLayerProps {
  palletLength: number
  palletWidth: number
  selected: OrientationPlan
  layers: number
  technical?: boolean
  onTechnicalChange?: (next: boolean) => void
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

interface TopViewDimensionLine {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
  ex1: number
  ey1: number
  ex2: number
  ey2: number
  ex3: number
  ey3: number
  ex4: number
  ey4: number
  label: string
  labelX: number
  labelY: number
  rotate?: number
}

const FRAME_WIDTH = 640
const FRAME_HEIGHT = 430
const PADDING = 20
const DIMENSION_BAND = 56

const mmFormatter = new Intl.NumberFormat('es-ES', {
  maximumFractionDigits: 0,
})

function formatMm(value: number) {
  return `${mmFormatter.format(value)} mm`
}

function buildHorizontalDimension(
  id: string,
  startX: number,
  endX: number,
  referenceY: number,
  lineY: number,
  label: string,
): TopViewDimensionLine {
  return {
    id,
    x1: startX,
    y1: lineY,
    x2: endX,
    y2: lineY,
    ex1: startX,
    ey1: referenceY,
    ex2: startX,
    ey2: lineY,
    ex3: endX,
    ey3: referenceY,
    ex4: endX,
    ey4: lineY,
    label,
    labelX: (startX + endX) / 2,
    labelY: lineY - 6,
  }
}

function buildVerticalDimension(
  id: string,
  startY: number,
  endY: number,
  referenceX: number,
  lineX: number,
  label: string,
): TopViewDimensionLine {
  return {
    id,
    x1: lineX,
    y1: startY,
    x2: lineX,
    y2: endY,
    ex1: referenceX,
    ey1: startY,
    ex2: lineX,
    ey2: startY,
    ex3: referenceX,
    ey3: endY,
    ex4: lineX,
    ey4: endY,
    label,
    labelX: lineX + 12,
    labelY: (startY + endY) / 2,
    rotate: -90,
  }
}

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
  const drawAreaWidth = FRAME_WIDTH - (PADDING + DIMENSION_BAND) * 2
  const drawAreaHeight = FRAME_HEIGHT - (PADDING + DIMENSION_BAND) * 2
  const scale = Math.min(drawAreaWidth / palletLength, drawAreaHeight / palletWidth)
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

export function buildTopViewDimensionLines(
  geometry: TopViewGeometry,
  palletLength: number,
  palletWidth: number,
  occupiedLength: number,
  occupiedWidth: number,
  residualLength: number,
  residualWidth: number,
): TopViewDimensionLine[] {
  const palletLeft = geometry.offsetX
  const palletTop = geometry.offsetY
  const palletRight = geometry.offsetX + geometry.drawLength
  const palletBottom = geometry.offsetY + geometry.drawWidth
  const occupiedRight = geometry.offsetX + occupiedLength * geometry.scale
  const occupiedBottom = geometry.offsetY + occupiedWidth * geometry.scale

  const lines: TopViewDimensionLine[] = [
    buildHorizontalDimension(
      'single-total-length',
      palletLeft,
      palletRight,
      palletTop,
      palletTop - 24,
      formatMm(palletLength),
    ),
    buildVerticalDimension(
      'single-total-width',
      palletTop,
      palletBottom,
      palletLeft,
      palletLeft - 24,
      formatMm(palletWidth),
    ),
    buildHorizontalDimension(
      'single-occupied-length',
      palletLeft,
      occupiedRight,
      palletBottom,
      palletBottom + 24,
      formatMm(occupiedLength),
    ),
    buildVerticalDimension(
      'single-occupied-width',
      palletTop,
      occupiedBottom,
      palletRight,
      palletRight + 24,
      formatMm(occupiedWidth),
    ),
  ]

  if (residualLength > 0) {
    lines.push(
      buildHorizontalDimension(
        'single-residual-length',
        occupiedRight,
        palletRight,
        palletBottom,
        palletBottom + 43,
        formatMm(residualLength),
      ),
    )
  }

  if (residualWidth > 0) {
    lines.push(
      buildVerticalDimension(
        'single-residual-width',
        occupiedBottom,
        palletBottom,
        palletRight,
        palletRight + 43,
        formatMm(residualWidth),
      ),
    )
  }

  return lines
}

export function TopViewLayer({
  palletLength,
  palletWidth,
  selected,
  layers,
  technical,
  onTechnicalChange,
}: TopViewLayerProps) {
  const [localTechnical, setLocalTechnical] = useState(true)
  const isTechnical = technical ?? localTechnical

  const setTechnical = (next: boolean) => {
    if (onTechnicalChange) {
      onTechnicalChange(next)
      return
    }
    setLocalTechnical(next)
  }

  if (layers === 0 || selected.perLayer === 0) {
    return (
      <section className="top-view-panel">
        <div className="top-view-title-row">
          <h3>Vista superior por capa</h3>
        </div>
        <p className="top-view-empty">
          Sin patron disponible: revisa dimensiones o altura maxima.
        </p>
      </section>
    )
  }

  const geometry = buildTopViewGeometry(palletLength, palletWidth)
  const cells = buildTopViewCells(selected.nx, selected.ny)
  const occupiedLength = Math.min(palletLength, selected.nx * selected.boxFootprintL)
  const occupiedWidth = Math.min(palletWidth, selected.ny * selected.boxFootprintW)
  const residualLength = Math.max(0, palletLength - occupiedLength)
  const residualWidth = Math.max(0, palletWidth - occupiedWidth)
  const dimensions = buildTopViewDimensionLines(
    geometry,
    palletLength,
    palletWidth,
    occupiedLength,
    occupiedWidth,
    residualLength,
    residualWidth,
  )

  const markerStartId = 'single-top-view-arrow-start'
  const markerEndId = 'single-top-view-arrow-end'

  return (
    <section className="top-view-panel" data-testid="single-top-view-panel">
      <div className="top-view-title-row">
        <h3>Vista superior por capa</h3>
        <span>
          Patron: {selected.nx} x {selected.ny}
        </span>
      </div>

      <div className="top-view-toolbar">
        <label className="checkbox-row top-view-toggle" htmlFor="single-top-view-technical">
          <input
            id="single-top-view-technical"
            type="checkbox"
            checked={isTechnical}
            onChange={(event) => setTechnical(event.target.checked)}
          />
          <span>Modo tecnico</span>
        </label>
      </div>

      <svg
        className="top-view-svg"
        viewBox={`0 0 ${geometry.frameWidth} ${geometry.frameHeight}`}
        role="img"
        aria-label="Vista superior del patron por capa"
      >
        <defs>
          <marker
            id={markerStartId}
            markerWidth="6"
            markerHeight="6"
            refX="5.5"
            refY="3"
            orient="auto"
          >
            <path d="M6,3 L0,6 L1.4,3 L0,0 Z" className="top-view-arrow-head" />
          </marker>
          <marker
            id={markerEndId}
            markerWidth="6"
            markerHeight="6"
            refX="0.5"
            refY="3"
            orient="auto"
          >
            <path d="M0,3 L6,6 L4.6,3 L6,0 Z" className="top-view-arrow-head" />
          </marker>
        </defs>

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

        {isTechnical &&
          dimensions.map((line) => (
            <g key={line.id}>
              <line
                className="top-view-dimension-extension"
                x1={line.ex1}
                y1={line.ey1}
                x2={line.ex2}
                y2={line.ey2}
              />
              <line
                className="top-view-dimension-extension"
                x1={line.ex3}
                y1={line.ey3}
                x2={line.ex4}
                y2={line.ey4}
              />
              <line
                className="top-view-dimension-line"
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                markerStart={`url(#${markerStartId})`}
                markerEnd={`url(#${markerEndId})`}
              />
              <text
                x={line.labelX}
                y={line.labelY}
                className="top-view-dimension-text"
                textAnchor="middle"
                transform={
                  line.rotate ? `rotate(${line.rotate} ${line.labelX} ${line.labelY})` : undefined
                }
              >
                {line.label}
              </text>
            </g>
          ))}
      </svg>

      <div className="top-view-metrics">
        <p>Residual eje largo: {residualLength} mm</p>
        <p>Residual eje ancho: {residualWidth} mm</p>
      </div>
    </section>
  )
}
