import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { getDataTradeConfig, type DataTradeFrontendConfig } from './config'
import {
  type DataTradeAdminEventRow,
  type DataTradeAdminModuleUsageRow,
  type DataTradeAdminOverview,
  type DataTradeAdminUserRow,
  type DataTradeAuthApi,
} from './client'
import { dataTradeClient, trackDataTradeEvent } from './runtime'

interface AdminDashboardClient {
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

export function DataTradeAdminDashboard({
  client = dataTradeClient,
  config,
}: DataTradeAdminDashboardProps) {
  const auth = useAuth()
  const runtimeConfig = useMemo(() => config ?? getDataTradeConfig(), [config])
  const [data, setData] = useState<AdminDashboardData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasAdminAccess =
    auth.user.role === 'admin' || auth.canAccessModule('admin')

  useEffect(() => {
    if (
      !runtimeConfig.adminDashboardEnabled ||
      !runtimeConfig.apiUrl ||
      !hasAdminAccess
    ) {
      setData(null)
      return
    }

    if (!auth.accessToken) {
      setData(null)
      setError('No hay sesion Data Trade activa para cargar metricas admin.')
      return
    }

    let mounted = true
    setLoading(true)
    setError(null)
    void trackDataTradeEvent('admin_view_opened', {
      surface: 'adex_palletizer',
    })

    Promise.all([
      client.getAdminOverview(auth.accessToken),
      client.getAdminUsers({ limit: 10 }, auth.accessToken),
      client.getAdminEvents({ limit: 10 }, auth.accessToken),
      client.getAdminModulesUsage(auth.accessToken),
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
  }, [
    auth.accessToken,
    client,
    hasAdminAccess,
    runtimeConfig.adminDashboardEnabled,
    runtimeConfig.apiUrl,
  ])

  if (!runtimeConfig.adminDashboardEnabled || !hasAdminAccess) {
    return null
  }

  if (!runtimeConfig.apiUrl) {
    return (
      <section className="data-trade-admin-panel" aria-label="Data Trade Admin Dashboard">
        <div className="data-trade-admin-header">
          <h2>Admin Data Trade</h2>
          <span>Configura VITE_DATA_TRADE_API_URL para habilitar metricas.</span>
        </div>
      </section>
    )
  }

  return (
    <section className="data-trade-admin-panel" aria-label="Data Trade Admin Dashboard">
      <div className="data-trade-admin-header">
        <div>
          <h2>Admin Data Trade</h2>
          <span>{auth.user.email}</span>
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
