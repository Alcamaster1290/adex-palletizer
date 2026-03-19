import { useEffect, useRef, useState } from 'react'
import { ChevronDown, LogOut, User, UserCircle } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext'

export function UserMenu() {
  const { user, logout, logoutPending } = useAuth()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  const handleLogout = async () => {
    setOpen(false)
    await logout()
  }

  return (
    <div ref={containerRef} className="user-menu">
      <button
        type="button"
        className={`user-menu-button ${open ? 'open' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Abrir menu de usuario"
        onClick={() => setOpen((current) => !current)}
      >
        <UserCircle className="user-menu-icon" aria-hidden="true" />
        <ChevronDown className="user-menu-chevron" aria-hidden="true" />
      </button>

      {open && (
        <div className="user-menu-dropdown" role="menu" aria-label="Menu de usuario">
          <div className="user-menu-identity" role="presentation">
            <User className="user-menu-identity-icon" aria-hidden="true" />
            <div>
              <strong>{user.username}</strong>
              <span>{user.role}</span>
            </div>
          </div>

          <button type="button" className="user-menu-item" role="menuitem" disabled>
            Mi perfil
          </button>

          <button
            type="button"
            className="user-menu-item danger"
            role="menuitem"
            disabled={logoutPending}
            onClick={() => {
              void handleLogout()
            }}
          >
            <LogOut className="user-menu-item-icon" aria-hidden="true" />
            {logoutPending ? 'Cerrando sesion...' : 'Cerrar sesion'}
          </button>
        </div>
      )}
    </div>
  )
}
