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
  const usesLocalDocker = apiBaseUrl.includes('localhost:8787')
  const connectionHint = usesLocalDocker
    ? 'Usa tu backend local en Docker Desktop.'
    : 'Usa el backend integrado del mismo deployment.'

  if (status === 'checking') {
    return (
      <main className="auth-shell">
        <section className="auth-card auth-card-loading">
          <p className="eyebrow">ADEX ACCESS GATE</p>
          <h1>Verificando acceso</h1>
          <p>Restaurando tu sesion segura.</p>
          <div className="auth-spinner" aria-hidden="true" />
          <p className="auth-meta">Origen API: {apiBaseUrl}</p>
        </section>
      </main>
    )
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-copy">
          <p className="eyebrow">ADEX ACCESS GATE</p>
          <h1>Accede a tu espacio de trabajo</h1>
          <p className="auth-lead">
            Inicia sesion para continuar con palletizacion, escenarios y contenedorizacion.
          </p>
          <div className="auth-highlights" aria-label="estado de acceso">
            <span className="auth-chip">Acceso seguro</span>
            <span className="auth-chip">Usuario de prueba: admin</span>
            <span className="auth-chip">{connectionHint}</span>
          </div>
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
              {submitting ? 'Entrando...' : 'Iniciar sesion'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={onRetrySession}
              disabled={submitting}
            >
              Reintentar
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

          <p className="auth-meta">Acceso temporal de pruebas: `admin / admin`.</p>
        </form>
      </section>
    </main>
  )
}
