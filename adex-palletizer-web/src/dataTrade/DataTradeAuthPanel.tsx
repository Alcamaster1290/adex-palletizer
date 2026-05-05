import { useEffect, useMemo, useState } from 'react'
import { getDataTradeConfig } from './config'
import {
  DataTradeApiError,
  canAccessModule,
  type DataTradeSessionState,
} from './client'
import { dataTradeClient, trackDataTradeEvent } from './runtime'

type PanelMode = 'login' | 'register'

export function DataTradeAuthPanel() {
  const config = useMemo(() => getDataTradeConfig(), [])
  const [mode, setMode] = useState<PanelMode>('login')
  const [session, setSession] = useState<DataTradeSessionState>(() =>
    dataTradeClient.getSessionSnapshot(),
  )
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!config.authEnabled) {
      return
    }

    let mounted = true
    void dataTradeClient.loadCurrentUser().then((nextSession) => {
      if (mounted) {
        setSession(nextSession)
      }
    })

    return () => {
      mounted = false
    }
  }, [config.authEnabled])

  if (!config.authEnabled) {
    return null
  }

  const moduleAllowed = canAccessModule(session.modules, config.moduleCode)

  const submit = async () => {
    setSubmitting(true)
    setMessage(null)

    try {
      const nextSession =
        mode === 'register'
          ? await dataTradeClient.register({
              email,
              password,
              displayName: displayName.trim() || undefined,
            })
          : await dataTradeClient.login({ email, password })

      setSession(nextSession)
      setPassword('')
      setMessage(mode === 'register' ? 'Cuenta Data Trade creada.' : 'Sesion Data Trade iniciada.')
      void trackDataTradeEvent(mode === 'register' ? 'user_signed_up' : 'user_logged_in', {
        surface: 'adex_palletizer',
      })
    } catch (error) {
      setMessage(
        error instanceof DataTradeApiError
          ? error.message
          : 'No se pudo conectar con Data Trade Auth.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const refresh = async () => {
    setSubmitting(true)
    setMessage(null)
    const nextSession = await dataTradeClient.refresh()
    setSession(nextSession)
    setSubmitting(false)
  }

  const logout = async () => {
    setSubmitting(true)
    setMessage(null)
    await trackDataTradeEvent('session_ended', { surface: 'adex_palletizer' })
    const nextSession = await dataTradeClient.logout()
    setSession(nextSession)
    setSubmitting(false)
  }

  return (
    <section className="data-trade-auth-panel" aria-label="Data Trade Auth">
      <div>
        <strong>Data Trade</strong>
        <span>
          {session.status === 'authenticated'
            ? session.user?.email
            : session.status === 'expired'
              ? 'Sesion expirada'
              : config.apiUrl
                ? 'Cuenta comun opcional'
                : 'Configura VITE_DATA_TRADE_API_URL'}
        </span>
      </div>

      {session.status === 'authenticated' ? (
        <div className="data-trade-auth-actions">
          <span className={moduleAllowed ? 'chip ready' : 'chip pending'}>
            {moduleAllowed ? 'Modulo habilitado' : 'Modulo pendiente'}
          </span>
          <button type="button" className="btn-secondary" onClick={refresh} disabled={submitting}>
            Refrescar
          </button>
          <button type="button" className="btn-secondary" onClick={logout} disabled={submitting}>
            Salir Data Trade
          </button>
        </div>
      ) : (
        <form
          className="data-trade-auth-form"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          {mode === 'register' ? (
            <input
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Nombre"
              autoComplete="name"
            />
          ) : null}
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="correo@datatrade.pe"
            autoComplete="email"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Contrasena"
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            required
          />
          <button type="submit" className="btn-primary" disabled={submitting || !config.apiUrl}>
            {submitting ? 'Conectando...' : mode === 'register' ? 'Crear cuenta' : 'Entrar'}
          </button>
          <button
            type="button"
            className="auth-inline-link"
            onClick={() => {
              setMode(mode === 'register' ? 'login' : 'register')
              setMessage(null)
            }}
          >
            {mode === 'register' ? 'Usar cuenta existente' : 'Crear cuenta Data Trade'}
          </button>
        </form>
      )}

      {message ? <p className="data-trade-auth-message">{message}</p> : null}
    </section>
  )
}
