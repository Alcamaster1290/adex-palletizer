import { useEffect, useMemo, useState } from 'react'
import { getDataTradeConfig, type DataTradeFrontendConfig } from './config'
import {
  canAccessModule,
  type DataTradeAdminEventRow,
  type DataTradeAdminModuleUsageRow,
  type DataTradeAdminOverview,
  type DataTradeAdminUserRow,
  type DataTradeAuthApi,
  type DataTradeSessionState,
} from './client'
import { dataTradeClient, subscribeDataTradeSession } from './runtime'

interface AdminDashboardClient {
  getSessionSnapshot: DataTradeAuthApi['getSessionSnapshot']
  getAdminOverview: DataTradeAuthApi['getAdminOverview']
  getAdminUsers: DataTradeAuthApi['getAdminUsers']
  getAdminEvents: DataTradeAuthApi['getAdminEvents']
  getAdminModulesUsage: DataTradeAuthApi['getAdminModulesUsage']
}

interface AdminDashboardData {
  overview: DataTradeAdminOverview
  users: DataTradeAdminUserRow[]
  events: DataTradeAdminEventRow[]
  modules: DataTradeAdminModuleUsageRow[]
}

interface DataTradeAdminDashboardProps {
  client?: AdminDashboardClient
  config?: DataTradeFrontendConfig
}

function formatDate(value: string | null) {
  if (!value) {
    return '-'
  }

  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function hasAdminAccess(session: DataTradeSessionState) {
  return (
    session.user?.roles.includes('admin') ||
    canAccessModule(session.modules, 'admin')
  )
}

export function DataTradeAdminDashboard({
  client = dataTradeClient,
  config,
}: DataTradeAdminDashboardProps) {
  const runtimeConfig = useMemo(() => config ?? getDataTradeConfig(), [config])
  const [session, setSession] = useState<DataTradeSessionState>(() =>
    client.getSessionSnapshot(),
  )
  const [data, setData] = useState<AdminDashboardData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!runtimeConfig.adminDashboardEnabled || client !== dataTradeClient) {
      return
    }

    return subscribeDataTradeSession(setSession)
  }, [client, runtimeConfig.adminDashboardEnabled])

  useEffect(() => {
    if (!runtimeConfig.adminDashboardEnabled || !runtimeConfig.apiUrl) {
      return
    }

    const currentSession = client.getSessionSnapshot()
    setSession(currentSession)
    if (currentSession.status !== 'authenticated' || !hasAdminAccess(currentSession)) {
      setData(null)
      return
    }

    let mounted = true
    setLoading(true)
    setError(null)

    Promise.all([
      client.getAdminOverview(),
      client.getAdminUsers({ limit: 10 }),
      client.getAdminEvents({ limit: 10 }),
      client.getAdminModulesUsage(),
    ])
      .then(([overview, users, events, modules]) => {
        if (!mounted) {
          return
        }

        setData({
          overview,
          users: users.users,
          events: events.events,
          modules: modules.modules,
        })
      })
      .catch((nextError) => {
        if (!mounted) {
          return
        }

        setData(null)
        setError(nextError instanceof Error ? nextError.message : 'No se pudo cargar el dashboard admin.')
      })
      .finally(() => {
        if (mounted) {
          setLoading(false)
        }
      })

    return () => {
      mounted = false
    }
  }, [client, runtimeConfig.adminDashboardEnabled, runtimeConfig.apiUrl, session.status])

  if (!runtimeConfig.adminDashboardEnabled) {
    return null
  }

  if (!runtimeConfig.authEnabled || !runtimeConfig.apiUrl) {
    return (
      <section className="data-trade-admin-panel" aria-label="Data Trade Admin Dashboard">
        <div className="data-trade-admin-header">
          <h2>Admin Data Trade</h2>
          <span>Configura Data Trade Auth para habilitar el panel.</span>
        </div>
      </section>
    )
  }

  if (session.status !== 'authenticated') {
    return (
      <section className="data-trade-admin-panel" aria-label="Data Trade Admin Dashboard">
        <div className="data-trade-admin-header">
          <h2>Admin Data Trade</h2>
          <span>Inicia sesion Data Trade con rol admin.</span>
        </div>
      </section>
    )
  }

  if (!hasAdminAccess(session)) {
    return (
      <section className="data-trade-admin-panel" aria-label="Data Trade Admin Dashboard">
        <div className="data-trade-admin-header">
          <h2>Admin Data Trade</h2>
          <span>Acceso no autorizado.</span>
        </div>
      </section>
    )
  }

  return (
    <section className="data-trade-admin-panel" aria-label="Data Trade Admin Dashboard">
      <div className="data-trade-admin-header">
        <div>
          <h2>Admin Data Trade</h2>
          <span>{session.user?.email}</span>
        </div>
        {loading ? <span>Cargando metricas...</span> : null}
      </div>

      {error ? (
        <div className="notice-box" role="alert">
          <p>{error}</p>
        </div>
      ) : null}

      {data ? (
        <>
          <div className="data-trade-admin-grid">
            <article className="data-trade-admin-card">
              <span>Usuarios</span>
              <strong>{data.overview.total_users}</strong>
            </article>
            <article className="data-trade-admin-card">
              <span>Activos 7 dias</span>
              <strong>{data.overview.active_users_7d}</strong>
            </article>
            <article className="data-trade-admin-card">
              <span>Eventos 30 dias</span>
              <strong>{data.overview.events_30d}</strong>
            </article>
            <article className="data-trade-admin-card">
              <span>Modulo top</span>
              <strong>{data.overview.top_module_by_events ?? '-'}</strong>
            </article>
          </div>

          <div className="data-trade-admin-tables">
            <div className="data-trade-admin-table-wrap">
              <h3>Usuarios</h3>
              <table>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Rol</th>
                    <th>Eventos</th>
                    <th>Ultimo acceso</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((user) => (
                    <tr key={user.id}>
                      <td>{user.email}</td>
                      <td>{user.role}</td>
                      <td>{user.event_count}</td>
                      <td>{formatDate(user.last_seen_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="data-trade-admin-table-wrap">
              <h3>Eventos recientes</h3>
              <table>
                <thead>
                  <tr>
                    <th>Modulo</th>
                    <th>Evento</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {data.events.map((event) => (
                    <tr key={event.id}>
                      <td>{event.module}</td>
                      <td>{event.event_name}</td>
                      <td>{formatDate(event.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="data-trade-admin-table-wrap">
              <h3>Uso por modulo</h3>
              <table>
                <thead>
                  <tr>
                    <th>Modulo</th>
                    <th>Eventos</th>
                    <th>Usuarios</th>
                    <th>Anonimos</th>
                  </tr>
                </thead>
                <tbody>
                  {data.modules.map((module) => (
                    <tr key={module.module_code}>
                      <td>{module.module_name}</td>
                      <td>{module.events_count}</td>
                      <td>{module.unique_users}</td>
                      <td>{module.anonymous_users}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </section>
  )
}
