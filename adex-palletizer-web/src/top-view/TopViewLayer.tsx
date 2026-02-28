import { useRef } from 'react'
import { exportTopViewPng, exportTopViewSvg } from '../export/exportTopView'
import type { OrientationPlan } from '../types'
import { buildTopViewLayout } from './topviewDimensions'

interface TopViewLayerProps {
  palletLength: number
  palletWidth: number
  selected: OrientationPlan
  layers: number
  technical?: boolean
  onTechnicalChange?: (next: boolean) => void
}

export { buildTopViewCells, buildTopViewGeometry, buildTopViewLayout } from './topviewDimensions'

export function TopViewLayer({
  palletLength,
  palletWidth,
  selected,
  layers,
  technical = true,
  onTechnicalChange,
}: TopViewLayerProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)

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

  const layout = buildTopViewLayout(palletLength, palletWidth, selected)
  const markerStartId = 'top-view-arrow-start'
  const markerEndId = 'top-view-arrow-end'

  return (
    <section className="top-view-panel" data-testid="top-view-panel">
      <div className="top-view-title-row">
        <h3>Top View por capa</h3>
        <span>
          Patron: {selected.nx} x {selected.ny}
        </span>
      </div>

      <div className="top-view-toolbar">
        <label className="checkbox-row top-view-toggle" htmlFor="top-view-technical">
          <input
            id="top-view-technical"
            type="checkbox"
            checked={technical}
            onChange={(event) => onTechnicalChange?.(event.target.checked)}
          />
          <span>Modo tecnico</span>
        </label>
        <div className="button-row top-view-export-row">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => exportTopViewSvg(svgRef.current)}
          >
            Export TopView SVG
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              void exportTopViewPng(svgRef.current)
            }}
          >
            Export TopView PNG
          </button>
        </div>
      </div>

      <svg
        ref={svgRef}
        className="top-view-svg"
        viewBox={`0 0 ${layout.geometry.frameWidth} ${layout.geometry.frameHeight}`}
        role="img"
        aria-label="Vista superior del patron por capa"
        data-testid="top-view-svg"
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
          x={layout.geometry.offsetX}
          y={layout.geometry.offsetY}
          width={layout.geometry.drawLength}
          height={layout.geometry.drawWidth}
          className="top-view-pallet"
        />
        <rect
          x={layout.geometry.offsetX}
          y={layout.geometry.offsetY}
          width={layout.occupiedDrawLength}
          height={layout.occupiedDrawWidth}
          className="top-view-footprint"
        />

        {layout.cells.map((cell) => (
          <rect
            key={`top-cell-${cell.ix}-${cell.iy}`}
            x={layout.geometry.offsetX + cell.ix * selected.boxFootprintL * layout.geometry.scale}
            y={layout.geometry.offsetY + cell.iy * selected.boxFootprintW * layout.geometry.scale}
            width={selected.boxFootprintL * layout.geometry.scale}
            height={selected.boxFootprintW * layout.geometry.scale}
            className="top-view-box"
          />
        ))}

        {technical &&
          layout.dimensions.map((dimension) => (
            <g key={dimension.id}>
              <line
                className="top-view-dimension-extension"
                x1={dimension.ex1}
                y1={dimension.ey1}
                x2={dimension.ex2}
                y2={dimension.ey2}
              />
              <line
                className="top-view-dimension-extension"
                x1={dimension.ex3}
                y1={dimension.ey3}
                x2={dimension.ex4}
                y2={dimension.ey4}
              />
              <line
                className="top-view-dimension-line"
                x1={dimension.x1}
                y1={dimension.y1}
                x2={dimension.x2}
                y2={dimension.y2}
                markerStart={`url(#${markerStartId})`}
                markerEnd={`url(#${markerEndId})`}
              />
              <text
                x={dimension.labelX}
                y={dimension.labelY}
                className="top-view-dimension-text"
                textAnchor="middle"
                transform={
                  dimension.rotate
                    ? `rotate(${dimension.rotate} ${dimension.labelX} ${dimension.labelY})`
                    : undefined
                }
              >
                {dimension.label}
              </text>
            </g>
          ))}
      </svg>

      <div className="top-view-metrics" data-testid="top-view-metrics">
        <p>Footprint ocupado: {layout.occupiedLength} mm x {layout.occupiedWidth} mm</p>
        <p>Residual eje largo: {layout.residualLength} mm</p>
        <p>Residual eje ancho: {layout.residualWidth} mm</p>
      </div>
    </section>
  )
}
