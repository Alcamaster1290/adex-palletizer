import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DataTradeAdminDashboard } from './DataTradeAdminDashboard'
import type { DataTradeFrontendConfig } from './config'
import type { DataTradeModuleAccess } from './client'
import { AuthProvider } from '../auth/AuthContext'
import type { AuthUser } from '../auth/authApi'

const baseConfig: DataTradeFrontendConfig = {
  trackingEnabled: true,
  adminDashboardEnabled: true,
  apiUrl: 'https://api.datatrade.test',
  moduleCode: 'adex_palletizer',
}

const adminUser: AuthUser = {
  id: 'admin-1',
  email: 'admin@datatrade.test',
  username: 'admin',
  status: 'active',
  role: 'admin',
  mustChangePassword: false,
}

const normalUser: AuthUser = {
  id: 'user-1',
  email: 'user@datatrade.test',
  username: 'user',
  status: 'active',
  role: 'user',
  mustChangePassword: false,
}

const adminModules: DataTradeModuleAccess[] = [
  { key: 'admin', displayName: 'Admin', accessLevel: 'admin' },
]

const userModules: DataTradeModuleAccess[] = [
  { key: 'adex_palletizer', displayName: 'ADEX', accessLevel: 'user' },
]

function createClient(overrides = {}) {
  return {
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

function renderDashboard({
  user = adminUser,
  modules = adminModules,
  accessToken = 'access-token',
  client = createClient(),
  config = baseConfig,
}: {
  user?: AuthUser
  modules?: DataTradeModuleAccess[]
  accessToken?: string | null
  client?: ReturnType<typeof createClient>
  config?: DataTradeFrontendConfig
} = {}) {
  return render(
    <AuthProvider
      value={{
        user,
        accessToken,
        modules,
        canAccessModule: (moduleCode) =>
          modules.some(
            (entry) => entry.key === moduleCode && entry.accessLevel !== 'none',
          ),
        logout: vi.fn(async () => {}),
        logoutPending: false,
        registerRedirect: vi.fn(),
      }}
    >
      <DataTradeAdminDashboard client={client} config={config} />
    </AuthProvider>,
  )
}

describe('DataTradeAdminDashboard', () => {
  it('no muestra el dashboard con el flag apagado', () => {
    const client = createClient()

    const { container } = renderDashboard({
      client,
      config: { ...baseConfig, adminDashboardEnabled: false },
    })

    expect(container.firstChild).toBeNull()
    expect(client.getAdminOverview).not.toHaveBeenCalled()
  })

  it('no muestra dashboard para usuario sin admin', () => {
    const client = createClient()

    const { container } = renderDashboard({
      user: normalUser,
      modules: userModules,
      client,
    })

    expect(container.firstChild).toBeNull()
    expect(client.getAdminOverview).not.toHaveBeenCalled()
  })

  it('muestra cards principales para admin cuando la API responde', async () => {
    renderDashboard()

    await waitFor(() => {
      expect(screen.getAllByText('Usuarios').length).toBeGreaterThan(0)
      expect(screen.getByText('4')).toBeInTheDocument()
      expect(screen.getByText('ADEX Palletizer')).toBeInTheDocument()
    })
  })

  it('muestra error controlado si falla la API', async () => {
    renderDashboard({
      client: createClient({
          getAdminOverview: vi.fn(async () => {
            throw new Error('Admin API down')
          }),
        }),
    })

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Admin API down')
    })
  })
})
