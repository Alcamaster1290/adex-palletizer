import type { BoxSkinMode } from '../../types'
import { UserMenu } from './UserMenu'

interface HeaderProps {
  sislopeUrl: string
  importCalcUrl: string
  boxSkinMode: BoxSkinMode
  onBoxSkinModeChange: (mode: BoxSkinMode) => void
  onExportTradeCase?: () => void
  onOpenSislope?: () => void
  adminDashboardAvailable?: boolean
  onOpenAdminDashboard?: () => void
}

export function Header({
  sislopeUrl,
  importCalcUrl,
  boxSkinMode,
  onBoxSkinModeChange,
  onExportTradeCase,
  onOpenSislope,
  adminDashboardAvailable = false,
  onOpenAdminDashboard,
}: HeaderProps) {
  return (
    <header className="hero hero-header">
      <div className="hero-main hero-main-inline">
        <div className="hero-brand hero-brand-inline">
          <p className="eyebrow hero-kicker">ADEX</p>
          <div className="hero-title-block">
            <h1>Pallet Solver by Alvaro Caceres</h1>
            <p className="hero-subtitle">
              Paletizacion y contenedorizacion tecnica en una sola consola
            </p>
          </div>
        </div>

        <div className="hero-actions">
          <label className="field compact hero-select" htmlFor="global-box-skin-mode">
            <span>
              Visual 3D
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

          {onExportTradeCase && (
            <button
              type="button"
              className="btn-primary hero-link"
              onClick={onExportTradeCase}
              aria-label="Enviar caso a Costos de Importacion"
            >
              Enviar a Costos
            </button>
          )}

          <a
            className="btn-secondary hero-link"
            href={importCalcUrl}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="Abrir Calculadora de Costos de Importacion y Exportacion"
          >
            Costos Import/Export
          </a>

          {onOpenSislope ? (
            <button
              type="button"
              className="btn-secondary hero-link"
              onClick={onOpenSislope}
              aria-label="Abrir Sistema Logistico del Peru"
            >
              SisLoPe
            </button>
          ) : (
            <a
              className="btn-secondary hero-link"
              href={sislopeUrl}
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Abrir Sistema Logistico del Peru"
            >
              SisLoPe
            </a>
          )}

          <UserMenu
            adminDashboardAvailable={adminDashboardAvailable}
            onOpenAdminDashboard={onOpenAdminDashboard}
          />
        </div>
      </div>
    </header>
  )
}
