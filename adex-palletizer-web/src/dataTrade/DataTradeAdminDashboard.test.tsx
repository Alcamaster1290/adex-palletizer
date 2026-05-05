import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DataTradeAdminDashboard } from './DataTradeAdminDashboard'
import type { DataTradeFrontendConfig } from './config'
import type { DataTradeSessionState } from './client'

const baseConfig: DataTradeFrontendConfig = {
  authEnabled: true,
  trackingEnabled: true,
  adminDashboardEnabled: true,
  apiUrl: 'https://api.datatrade.test',
  moduleCode: 'adex_palletizer',
}

const adminSession: DataTradeSessionState = {
  status: 'authenticated',
  user: {
    id: 'admin-1',
    email: 'admin@datatrade.test',
    username: 'admin',
    displayName: 'Admin',
    status: 'active',
    roles: ['user', 'admin'],
  },
  modules: [{ key: 'admin', displayName: 'Admin', accessLevel: 'admin' }],
  error: null,
}

const userSession: DataTradeSessionState = {
  status: 'authenticated',
  user: {
    id: 'user-1',
    email: 'user@datatrade.test',
    username: 'user',
    displayName: 'User',
    status: 'active',
    roles: ['user'],
  },
  modules: [{ key: 'adex_palletizer', displayName: 'ADEX', accessLevel: 'user' }],
  error: null,
}

function createClient(session: DataTradeSessionState, overrides = {}) {
  return {
    getSessionSnapshot: vi.fn(() => session),
    getAdminOverview: vi.fn(async () => ({
      total_users: 4,
      active_users_24h: 1,
      active_users_7d: 2,
      active_users_30d: 3,
      total_events: 8,
      events_24h: 1,
      events_7d: 5,
      events_30d: 8,
      total_modules: 4,
      top_module_by_events: 'adex_palletizer',
      latest_event_at: '2026-05-04T00:00:00.000Z',
    })),
    getAdminUsers: vi.fn(async () => ({
      users: [
        {
          id: 'admin-1',
          email: 'admin@datatrade.test',
          name: 'Admin',
          role: 'admin',
          created_at: '2026-05-04T00:00:00.000Z',
          last_seen_at: '2026-05-04T00:00:00.000Z',
          event_count: 3,
          module_count: 1,
        },
      ],
      total: 1,
      limit: 10,
      offset: 0,
    })),
    getAdminEvents: vi.fn(async () => ({
      events: [
        {
          id: 'event-1',
          user_id: 'admin-1',
          anonymous_id: null,
          module: 'adex_palletizer',
          event_name: 'module_opened',
          metadata: {},
          path: '/',
          created_at: '2026-05-04T00:00:00.000Z',
        },
      ],
      total: 1,
      limit: 10,
      offset: 0,
    })),
    getAdminModulesUsage: vi.fn(async () => ({
      modules: [
        {
          module_code: 'adex_palletizer',
          module_name: 'ADEX Palletizer',
          events_count: 8,
          unique_users: 2,
          anonymous_users: 1,
          last_event_at: '2026-05-04T00:00:00.000Z',
        },
      ],
    })),
    ...overrides,
  }
}

describe('DataTradeAdminDashboard', () => {
  it('no muestra el dashboard con el flag apagado', () => {
    const client = createClient(adminSession)

    const { container } = render(
      <DataTradeAdminDashboard
        client={client}
        config={{ ...baseConfig, adminDashboardEnabled: false }}
      />,
    )

    expect(container.firstChild).toBeNull()
    expect(client.getAdminOverview).not.toHaveBeenCalled()
  })

  it('muestra acceso no autorizado para usuario sin admin', () => {
    render(
      <DataTradeAdminDashboard
        client={createClient(userSession)}
        config={baseConfig}
      />,
    )

    expect(screen.getByText('Acceso no autorizado.')).toBeInTheDocument()
  })

  it('muestra cards principales para admin cuando la API responde', async () => {
    const trackEvent = vi.fn()

    render(
      <DataTradeAdminDashboard
        client={createClient(adminSession)}
        config={baseConfig}
        trackEvent={trackEvent}
      />,
    )

    await waitFor(() => {
      expect(screen.getAllByText('Usuarios').length).toBeGreaterThan(0)
      expect(screen.getByText('4')).toBeInTheDocument()
      expect(screen.getByText('ADEX Palletizer')).toBeInTheDocument()
    })
    expect(trackEvent).toHaveBeenCalledWith(
      'admin_dashboard_opened',
      expect.objectContaining({ surface: 'adex_palletizer' }),
    )
    expect(trackEvent).toHaveBeenCalledWith(
      'admin_metric_viewed',
      expect.objectContaining({ metric: 'overview' }),
    )
  })

  it('muestra error controlado si falla la API', async () => {
    const trackEvent = vi.fn()

    render(
      <DataTradeAdminDashboard
        client={createClient(adminSession, {
          getAdminOverview: vi.fn(async () => {
            throw new Error('Admin API down')
          }),
        })}
        config={baseConfig}
        trackEvent={trackEvent}
      />,
    )

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Admin API down')
    })
    expect(trackEvent).toHaveBeenCalledWith(
      'api_error',
      expect.objectContaining({ path: '/admin/dashboard' }),
    )
  })
})
