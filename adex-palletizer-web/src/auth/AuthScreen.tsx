import { getApiBaseUrl } from './authApi'

interface AuthScreenProps {
  status: 'checking' | 'unauthenticated'
  identifier: string
  password: string
  error: string | null
  submitting: boolean
  onIdentifierChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onSubmit: () => void
  onRetrySession: () => void
  sislopeUrl: string
}

export function AuthScreen({
  status,
  identifier,
  password,
  error,
  submitting,
  onIdentifierChange,
  onPasswordChange,
  onSubmit,
  onRetrySession,
  sislopeUrl,
}: AuthScreenProps) {
  const apiBaseUrl = getApiBaseUrl()

  if (status === 'checking') {
    return (
      <main className="auth-shell">
        <section className="auth-card auth-card-loading">
          <p className="eyebrow">ADEX ACCESS GATE</p>
          <h1>Verificando sesion activa</h1>
          <p>
            Consultando el backend B1 para restaurar la sesion segura del palletizer.
          </p>
          <div className="auth-spinner" aria-hidden="true" />
          <p className="auth-meta">Backend esperado: {apiBaseUrl}</p>
        </section>
      </main>
    )
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-copy">
          <p className="eyebrow">ADEX ACCESS GATE</p>
          <h1>Inicia sesion para usar el palletizer</h1>
          <p className="auth-lead">
            El frontend ya esta conectado al backend B1. La sesion usa cookie segura y
            el acceso bootstrap actual es solo para pruebas controladas.
          </p>
          <ul className="auth-bullets">
            <li>Backend esperado: {apiBaseUrl}</li>
            <li>Usuario bootstrap de prueba: `admin`</li>
            <li>Docker local: `npm run docker:backend:up`</li>
          </ul>
        </div>

        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit()
          }}
        >
          <label className="field" htmlFor="auth-identifier">
            <span>
              Usuario o correo
              <strong>auth</strong>
            </span>
            <input
              id="auth-identifier"
              type="text"
              value={identifier}
              onChange={(event) => onIdentifierChange(event.target.value)}
              autoComplete="username"
              placeholder="admin"
            />
          </label>

          <label className="field" htmlFor="auth-password">
            <span>
              Contrasena
              <strong>auth</strong>
            </span>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              autoComplete="current-password"
              placeholder="admin"
            />
          </label>

          {error && (
            <div className="auth-error" role="alert">
              <p>{error}</p>
            </div>
          )}

          <div className="auth-actions">
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Conectando...' : 'Iniciar sesion'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={onRetrySession}
              disabled={submitting}
            >
              Reintentar backend
            </button>
            <a
              className="btn-secondary hero-link"
              href={sislopeUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              Abrir SisLoPe
            </a>
          </div>

          <p className="auth-meta">
            Siguiente sprint pendiente: cambio/recuperacion de contrasena. B2 aun no se
            ejecuta.
          </p>
        </form>
      </section>
    </main>
  )
}
