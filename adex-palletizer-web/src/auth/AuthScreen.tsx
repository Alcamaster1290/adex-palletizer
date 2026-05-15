import {
  REGISTRATION_JOB_TITLE_OPTIONS,
  REGISTRATION_USE_CASE_OPTIONS,
  REGISTRATION_VOLUME_OPTIONS,
  type AuthMode,
  type RegistrationDraft,
  type RegistrationField,
  type RegistrationFieldErrors,
} from './registrationModel'

interface AuthScreenProps {
  status: 'checking' | 'unauthenticated'
  mode: AuthMode
  identifier: string
  password: string
  registerDraft: RegistrationDraft
  registerErrors: RegistrationFieldErrors
  error: string | null
  showRetryConnection: boolean
  submitting: boolean
  onIdentifierChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onRegisterFieldChange: (field: RegistrationField, value: string) => void
  onSubmit: () => void
  onModeChange: (mode: AuthMode) => void
  onRetrySession: () => void
  sislopeUrl: string
}

export function AuthScreen({
  status,
  mode,
  identifier,
  password,
  registerDraft,
  registerErrors,
  error,
  showRetryConnection,
  submitting,
  onIdentifierChange,
  onPasswordChange,
  onRegisterFieldChange,
  onSubmit,
  onModeChange,
  onRetrySession,
  sislopeUrl,
}: AuthScreenProps) {
  const isRegisterMode = mode === 'register'
  const title = isRegisterMode
    ? 'Crea tu acceso en 1 minuto'
    : 'Accede a tu espacio de trabajo'
  const lead = isRegisterMode
    ? 'Registrate para probar palletizacion, escenarios y contenedorizacion con tu equipo.'
    : 'Inicia sesion para continuar con palletizacion, escenarios y contenedorizacion.'
  const primaryLabel = submitting
    ? isRegisterMode
      ? 'Creando acceso...'
      : 'Entrando...'
    : isRegisterMode
      ? 'Crear cuenta'
      : 'Iniciar sesion'

  if (status === 'checking') {
    return (
      <main className="auth-shell">
        <section className="auth-card auth-card-loading">
          <h1>Verificando acceso</h1>
          <p>Restaurando tu sesion segura.</p>
          <div className="auth-spinner" aria-hidden="true" />
        </section>
      </main>
    )
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-copy">
          <h1>{title}</h1>
          <p className="auth-lead">{lead}</p>
        </div>

        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit()
          }}
        >
          {isRegisterMode ? (
            <div className="auth-form-grid">
              {/* Row 1: name + email */}
              <label className="field" htmlFor="auth-full-name">
                <span>
                  Nombre completo
                </span>
                <input
                  id="auth-full-name"
                  type="text"
                  value={registerDraft.fullName}
                  onChange={(event) => onRegisterFieldChange('fullName', event.target.value)}
                  autoComplete="name"
                  placeholder="Tu nombre y apellido"
                />
                {registerErrors.fullName ? (
                  <span className="field-error">{registerErrors.fullName}</span>
                ) : null}
              </label>

              <label className="field" htmlFor="auth-register-email">
                <span>
                  Correo de trabajo
                </span>
                <input
                  id="auth-register-email"
                  type="email"
                  value={registerDraft.email}
                  onChange={(event) => onRegisterFieldChange('email', event.target.value)}
                  autoComplete="email"
                  placeholder="nombre@empresa.com"
                />
                {registerErrors.email ? (
                  <span className="field-error">{registerErrors.email}</span>
                ) : null}
              </label>

              {/* Row 2: company + job title */}
              <label className="field" htmlFor="auth-company-name">
                <span>
                  Empresa
                </span>
                <input
                  id="auth-company-name"
                  type="text"
                  value={registerDraft.companyName}
                  onChange={(event) => onRegisterFieldChange('companyName', event.target.value)}
                  autoComplete="organization"
                  placeholder="Nombre de tu empresa"
                />
                {registerErrors.companyName ? (
                  <span className="field-error">{registerErrors.companyName}</span>
                ) : null}
              </label>

              <label className="field" htmlFor="auth-job-title">
                <span>
                  Cargo
                  <strong>opcional</strong>
                </span>
                <select
                  id="auth-job-title"
                  value={registerDraft.jobTitle}
                  onChange={(event) => onRegisterFieldChange('jobTitle', event.target.value)}
                >
                  <option value="">Tu cargo (opcional)</option>
                  {REGISTRATION_JOB_TITLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              {/* Row 3: phone + use case */}
              <label className="field" htmlFor="auth-phone">
                <span>
                  Teléfono
                  <strong>opcional</strong>
                </span>
                <input
                  id="auth-phone"
                  type="tel"
                  value={registerDraft.phone}
                  onChange={(event) => onRegisterFieldChange('phone', event.target.value)}
                  autoComplete="tel"
                  placeholder="+51 987654321"
                />
                {registerErrors.phone ? (
                  <span className="field-error">{registerErrors.phone}</span>
                ) : null}
              </label>

              <label className="field" htmlFor="auth-use-case">
                <span>
                  Caso de uso
                </span>
                <select
                  id="auth-use-case"
                  value={registerDraft.useCase}
                  onChange={(event) => onRegisterFieldChange('useCase', event.target.value)}
                >
                  <option value="">Selecciona una opcion</option>
                  {REGISTRATION_USE_CASE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {registerErrors.useCase ? (
                  <span className="field-error">{registerErrors.useCase}</span>
                ) : null}
              </label>

              {/* Row 4: volume band + password */}
              <label className="field" htmlFor="auth-volume-band">
                <span>
                  Volumen estimado
                </span>
                <select
                  id="auth-volume-band"
                  value={registerDraft.monthlyVolumeBand}
                  onChange={(event) =>
                    onRegisterFieldChange('monthlyVolumeBand', event.target.value)
                  }
                >
                  <option value="">Selecciona una banda</option>
                  {REGISTRATION_VOLUME_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {registerErrors.monthlyVolumeBand ? (
                  <span className="field-error">{registerErrors.monthlyVolumeBand}</span>
                ) : null}
              </label>

              <label className="field" htmlFor="auth-register-password">
                <span>
                  Contrasena
                </span>
                <input
                  id="auth-register-password"
                  type="password"
                  value={registerDraft.password}
                  onChange={(event) => onRegisterFieldChange('password', event.target.value)}
                  autoComplete="new-password"
                  placeholder="Minimo 12 caracteres"
                />
                {registerErrors.password ? (
                  <span className="field-error">{registerErrors.password}</span>
                ) : null}
              </label>

              {/* Row 5: confirm password (full width via CSS) */}
              <label className="field field--full" htmlFor="auth-register-password-confirm">
                <span>
                  Confirmar contrasena
                </span>
                <input
                  id="auth-register-password-confirm"
                  type="password"
                  value={registerDraft.confirmPassword}
                  onChange={(event) =>
                    onRegisterFieldChange('confirmPassword', event.target.value)
                  }
                  autoComplete="new-password"
                  placeholder="Repite tu contrasena"
                />
                {registerErrors.confirmPassword ? (
                  <span className="field-error">{registerErrors.confirmPassword}</span>
                ) : null}
              </label>
            </div>
          ) : (
            <>
              <label className="field" htmlFor="auth-identifier">
                <span>
                  Usuario o correo
                </span>
                <input
                  id="auth-identifier"
                  type="text"
                  value={identifier}
                  onChange={(event) => onIdentifierChange(event.target.value)}
                  autoComplete="username"
                  placeholder="usuario o correo"
                />
              </label>

              <label className="field" htmlFor="auth-password">
                <span>
                  Contrasena
                </span>
                <input
                  id="auth-password"
                  type="password"
                  value={password}
                  onChange={(event) => onPasswordChange(event.target.value)}
                  autoComplete="current-password"
                  placeholder="Ingresa tu contrasena"
                />
              </label>
            </>
          )}

          {error ? (
            <div className="auth-error" role="alert">
              <p>{error}</p>
            </div>
          ) : null}

          <div className="auth-actions">
            <button type="submit" className="btn-primary" disabled={submitting}>
              {primaryLabel}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => onModeChange(isRegisterMode ? 'login' : 'register')}
              disabled={submitting}
            >
              {isRegisterMode ? 'Ya tengo cuenta' : 'Registrate'}
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

          {showRetryConnection ? (
            <button
              type="button"
              className="auth-inline-link"
              onClick={onRetrySession}
              disabled={submitting}
            >
              Reintentar conexion
            </button>
          ) : null}

          <p className="auth-meta">
            {isRegisterMode
              ? 'Tu acceso queda listo al terminar el registro.'
              : 'Acceso disponible para usuarios habilitados o recien registrados.'}
          </p>
        </form>
      </section>
    </main>
  )
}
