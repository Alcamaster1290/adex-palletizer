import { useEffect, useRef } from 'react'
import type { ContainerInput, ContainerResult } from '../types'
import { buildContainerTopViewGeometry } from './containerTopViewDimensions'

interface ContainerTopViewProps {
  input: ContainerInput
  result: ContainerResult
  technical?: boolean
  onTechnicalChange?: (next: boolean) => void
  onSvgReady?: (svg: SVGSVGElement | null) => void
}

export function ContainerTopView({
  input,
  result,
  technical = true,
  onTechnicalChange,
  onSvgReady,
}: ContainerTopViewProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)

  useEffect(() => {
    if (onSvgReady) {
      onSvgReady(svgRef.current)
    }
  }, [onSvgReady, input, result, technical])

  if (result.totalPalletsBySpace === 0) {
    return (
      <section className="top-view-panel">
        <div className="top-view-title-row">
          <h3>Vista superior del contenedor</h3>
        </div>
        <p className="top-view-empty">
          Sin patron disponible: revisa dimensiones del contenedor y del pallet.
        </p>
      </section>
    )
  }

  const geometry = buildContainerTopViewGeometry(input, result)
  const markerStartId = 'container-top-view-arrow-start'
  const markerEndId = 'container-top-view-arrow-end'

  return (
    <section className="top-view-panel" data-testid="container-top-view-panel">
      <div className="top-view-title-row">
        <h3>Vista superior del contenedor</h3>
        <span>
          Patron: {result.selected.nx} x {result.selected.ny}
        </span>
      </div>

      <div className="top-view-toolbar">
        <label className="checkbox-row top-view-toggle" htmlFor="container-top-view-technical">
          <input
            id="container-top-view-technical"
            type="checkbox"
            checked={technical}
            onChange={(event) => onTechnicalChange?.(event.target.checked)}
          />
          <span>Modo tecnico</span>
        </label>
      </div>

      <svg
        ref={svgRef}
        className="top-view-svg"
        viewBox={`0 0 ${geometry.frameWidth} ${geometry.frameHeight}`}
        role="img"
        aria-label="Vista superior del plan de carga del contenedor"
        data-testid="container-top-view-svg"
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

        {result.placements.map((placement) => {
          const leftMm = placement.x - placement.length / 2 + input.container.length / 2
          const topMm = placement.z - placement.width / 2 + input.container.width / 2
          return (
            <rect
              key={`container-placement-${placement.index}`}
              x={geometry.offsetX + leftMm * geometry.scale}
              y={geometry.offsetY + topMm * geometry.scale}
              width={placement.length * geometry.scale}
              height={placement.width * geometry.scale}
              className="top-view-box"
            />
          )
        })}

        {technical &&
          geometry.dimensionLines.map((line) => (
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
        <p>
          Huella ocupada: {result.selected.occupiedLength} mm x {result.selected.occupiedWidth} mm
        </p>
        <p>Margen a pared: {result.selected.marginToWall} mm por lado</p>
        <p>Residual interno eje largo: {result.selected.trailingResidualLength} mm</p>
        <p>Residual interno eje ancho: {result.selected.trailingResidualWidth} mm</p>
      </div>
    </section>
  )
}
