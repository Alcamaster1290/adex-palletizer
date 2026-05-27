import { useState } from 'react'
import type { OrientationPlan, SingleAdvancedLayerPlacement2D } from '../types'
import {
  buildTopViewCells,
  buildTopViewDimensionLines,
  buildTopViewGeometry,
} from './topViewHelpers'
import { VisitorGate } from '../auth/VisitorGate'

interface TopViewLayerProps {
  palletLength: number
  palletWidth: number
  selected: OrientationPlan
  layers: number
  placements2D?: SingleAdvancedLayerPlacement2D[]
  technical?: boolean
  onTechnicalChange?: (next: boolean) => void
}

export function TopViewLayer({
  palletLength,
  palletWidth,
  selected,
  layers,
  placements2D = [],
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

  const hasAdvancedPlacements = placements2D.length > 0
  if (layers === 0 || (!hasAdvancedPlacements && selected.perLayer === 0)) {
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
  const topViewPlacements = hasAdvancedPlacements
    ? placements2D
    : buildTopViewCells(selected.nx, selected.ny).map((cell) => ({
        x: cell.ix * selected.boxFootprintL,
        y: cell.iy * selected.boxFootprintW,
        w: selected.boxFootprintL,
        h: selected.boxFootprintW,
        rotated: false,
      }))
  const occupiedLength = Math.min(
    palletLength,
    topViewPlacements.reduce((maxValue, placement) => Math.max(maxValue, placement.x + placement.w), 0),
  )
  const occupiedWidth = Math.min(
    palletWidth,
    topViewPlacements.reduce((maxValue, placement) => Math.max(maxValue, placement.y + placement.h), 0),
  )
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
          {hasAdvancedPlacements
            ? `Patron: ${topViewPlacements.length} cajas`
            : `Patron: ${selected.nx} x ${selected.ny}`}
        </span>
      </div>

      <VisitorGate feature="Vista técnica">
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
        {topViewPlacements.map((placement, index) => (
          <rect
            key={`top-placement-${index}`}
            x={geometry.offsetX + placement.x * geometry.scale}
            y={geometry.offsetY + placement.y * geometry.scale}
            width={placement.w * geometry.scale}
            height={placement.h * geometry.scale}
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
      </VisitorGate>
    </section>
  )
}
