import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { AuthProvider, type AuthContextValue } from './AuthContext'
import { VisitorGate, VisitorGateModal } from './VisitorGate'
import type { AuthUser } from './authApi'

function makeAuth(role: string, overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  const user: AuthUser = {
    id: role === 'visitor' ? 'visitor' : 'user-1',
    username: role === 'visitor' ? 'visitante' : 'admin',
    email: role === 'visitor' ? '' : 'admin@test.com',
    role,
    status: 'active',
    mustChangePassword: false,
  }
  return {
    user,
    accessToken: role === 'visitor' ? null : 'token',
    modules: [],
    canAccessModule: () => role !== 'visitor',
    logout: vi.fn().mockResolvedValue(undefined),
    logoutPending: false,
    registerRedirect: vi.fn(),
    ...overrides,
  }
}

describe('VisitorGate', () => {
  it('renderiza hijos normalmente para usuarios no visitantes', () => {
    render(
      <AuthProvider value={makeAuth('admin')}>
        <VisitorGate feature="Vista técnica">
          <div data-testid="contenido-protegido">contenido técnico</div>
        </VisitorGate>
      </AuthProvider>,
    )

    expect(screen.getByTestId('contenido-protegido')).toBeInTheDocument()
    expect(screen.queryByText('Solo cuentas registradas')).not.toBeInTheDocument()
  })

  it('muestra overlay de bloqueo para visitantes', () => {
    render(
      <AuthProvider value={makeAuth('visitor')}>
        <VisitorGate feature="Vista técnica">
          <div data-testid="contenido-protegido">contenido técnico</div>
        </VisitorGate>
      </AuthProvider>,
    )

    expect(
      screen.getByRole('button', { name: /solo cuentas registradas/i }),
    ).toBeInTheDocument()
  })

  it('abre el modal al hacer clic en el overlay', () => {
    render(
      <AuthProvider value={makeAuth('visitor')}>
        <VisitorGate feature="Vista técnica">
          <div>contenido</div>
        </VisitorGate>
      </AuthProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: /solo cuentas registradas/i }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/solo para cuentas registradas/i)).toBeInTheDocument()
    expect(screen.getByText('Vista técnica', { exact: true })).toBeInTheDocument()
  })

  it('cierra el modal al hacer clic en "Seguir explorando"', () => {
    render(
      <AuthProvider value={makeAuth('visitor')}>
        <VisitorGate feature="Vista técnica">
          <div>contenido</div>
        </VisitorGate>
      </AuthProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: /solo cuentas registradas/i }))
    fireEvent.click(screen.getByRole('button', { name: /seguir explorando/i }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('cierra el modal al hacer clic en el backdrop', () => {
    render(
      <AuthProvider value={makeAuth('visitor')}>
        <VisitorGate feature="Vista técnica">
          <div>contenido</div>
        </VisitorGate>
      </AuthProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: /solo cuentas registradas/i }))
    const backdrop = screen.getByRole('dialog')
    fireEvent.click(backdrop)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('llama a registerRedirect al hacer clic en "Crear cuenta gratis"', () => {
    const auth = makeAuth('visitor')

    render(
      <AuthProvider value={auth}>
        <VisitorGate feature="Vista técnica">
          <div>contenido</div>
        </VisitorGate>
      </AuthProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: /solo cuentas registradas/i }))
    fireEvent.click(screen.getByRole('button', { name: /crear cuenta gratis/i }))

    expect(auth.registerRedirect).toHaveBeenCalledOnce()
  })
})

describe('VisitorGateModal (standalone)', () => {
  it('llama a onClose al hacer clic en el botón de cierre', () => {
    const onClose = vi.fn()
    const onRegister = vi.fn()

    render(<VisitorGateModal feature="Exportación detallada" onClose={onClose} onRegister={onRegister} />)

    fireEvent.click(screen.getByRole('button', { name: /cerrar/i }))

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('llama a onRegister al hacer clic en "Crear cuenta gratis"', () => {
    const onClose = vi.fn()
    const onRegister = vi.fn()

    render(<VisitorGateModal feature="Exportación detallada" onClose={onClose} onRegister={onRegister} />)

    fireEvent.click(screen.getByRole('button', { name: /crear cuenta gratis/i }))

    expect(onRegister).toHaveBeenCalledOnce()
  })

  it('muestra el nombre de la feature en el modal', () => {
    render(
      <VisitorGateModal
        feature="Exportación detallada"
        onClose={vi.fn()}
        onRegister={vi.fn()}
      />,
    )

    expect(screen.getByText(/exportación detallada/i)).toBeInTheDocument()
  })
})
