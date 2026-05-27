import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from './AuthContext'

interface VisitorGateModalProps {
  feature: string
  onClose: () => void
  onRegister: () => void
}

export function VisitorGateModal({ feature, onClose, onRegister }: VisitorGateModalProps) {
  return createPortal(
    <div
      className="vg-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Función de cuenta registrada"
      onClick={onClose}
    >
      <div className="vg-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="vg-close" onClick={onClose} aria-label="Cerrar">
          ✕
        </button>
        <span className="vg-icon" aria-hidden="true">🔒</span>
        <h2 className="vg-title">Solo para cuentas registradas</h2>
        <p className="vg-body">
          <strong>{feature}</strong> requiere una cuenta activa. El registro es gratuito y
          tarda menos de 1 minuto.
        </p>
        <ul className="vg-perks">
          <li>Vista técnica con cotas y dimensiones reales</li>
          <li>Exportación JSON y PNG de planes de palletizado</li>
          <li>Historial de cálculos y escenarios guardados</li>
        </ul>
        <div className="vg-actions">
          <button type="button" className="btn-primary" onClick={onRegister}>
            Crear cuenta gratis
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Seguir explorando
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

interface VisitorGateProps {
  feature: string
  children: React.ReactNode
}

export function VisitorGate({ feature, children }: VisitorGateProps) {
  const auth = useAuth()
  const [open, setOpen] = useState(false)

  if (auth.user.role !== 'visitor') {
    return <>{children}</>
  }

  return (
    <>
      <div className="vg-wrap">
        <div className="vg-blur" aria-hidden="true">
          {children}
        </div>
        <button
          type="button"
          className="vg-overlay"
          onClick={() => setOpen(true)}
        >
          <span className="vg-overlay-cta">
            <span className="vg-lock" aria-hidden="true">🔒</span>
            <span>Solo cuentas registradas</span>
          </span>
        </button>
      </div>

      {open && (
        <VisitorGateModal
          feature={feature}
          onClose={() => setOpen(false)}
          onRegister={() => auth.registerRedirect()}
        />
      )}
    </>
  )
}
