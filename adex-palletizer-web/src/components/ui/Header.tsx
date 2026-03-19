import type { BoxSkinMode } from '../../types'
import { UserMenu } from './UserMenu'

interface HeaderProps {
  sislopeUrl: string
  boxSkinMode: BoxSkinMode
  onBoxSkinModeChange: (mode: BoxSkinMode) => void
}

export function Header({ sislopeUrl, boxSkinMode, onBoxSkinModeChange }: HeaderProps) {
  return (
    <header className="hero hero-header">
      <div className="hero-main">
        <div className="hero-brand">
          <p className="eyebrow">ADEX PALETIZACION Y CONTENERIZACION</p>
          <h1>Pallet Solver by Alvaro Caceres</h1>
          <p>
            Resolver unitarizacion y contenedorizacion con visualizacion tecnica 2D/3D,
            escenarios y enlaces compartibles.
          </p>
        </div>

        <div className="hero-actions">
          <label className="field compact hero-select" htmlFor="global-box-skin-mode">
            <span>
              Skin 3D global
              <strong>visual</strong>
            </span>
            <select
              id="global-box-skin-mode"
              value={boxSkinMode}
              onChange={(event) => onBoxSkinModeChange(event.target.value as BoxSkinMode)}
            >
              <option value="box">Caja tecnica</option>
              <option value="sack">Saco warehouse</option>
            </select>
          </label>

          <a
            className="btn-secondary hero-link"
            href={sislopeUrl}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="Abrir Sistema Logistico del Peru"
          >
            Abrir Sistema Logistico del Peru
          </a>

          <UserMenu />
        </div>
      </div>
    </header>
  )
}
