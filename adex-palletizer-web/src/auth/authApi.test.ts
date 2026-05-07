import { afterEach, describe, expect, it, vi } from 'vitest'

function jsonResponse(payload: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

const authPayload = {
  user: {
    id: 'user-1',
    email: 'admin@datatrade.local',
    username: 'admin',
    status: 'active',
    roles: ['user', 'admin'],
  },
  session: { id: 'session-1', expiresAt: '2099-01-01T00:00:00.000Z' },
  accessToken: 'access-token',
  refreshToken: 'refresh-token-value-that-is-long-enough',
  tokenType: 'Bearer',
  accessTokenExpiresAt: '2099-01-01T00:15:00.000Z',
}

async function importAuthApi(env: Record<string, string | undefined>) {
  vi.resetModules()
  vi.unstubAllEnvs()
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) {
      vi.stubEnv(key, value)
    }
  }

  return import('./authApi')
}

function restoreDefaultTestEnv() {
  vi.stubEnv('VITE_DATA_TRADE_API_URL', 'http://localhost:8788')
  vi.stubEnv('VITE_DATA_TRADE_TRACKING_ENABLED', 'false')
  vi.stubEnv('VITE_DATA_TRADE_ADMIN_DASHBOARD_ENABLED', 'false')
  vi.stubEnv('VITE_DATA_TRADE_MODULE_CODE', 'adex_palletizer')
  vi.stubEnv('VITE_ADEX_LEGACY_AUTH_FALLBACK', 'false')
  vi.stubEnv('VITE_SISLOPE_URL', 'https://sis-lo-pe.vercel.app')
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  restoreDefaultTestEnv()
})

describe('authApi Data Trade provider', () => {
  it('loginWithPassword llama Data Trade Auth cuando VITE_DATA_TRADE_API_URL existe', async () => {
    const authApi = await importAuthApi({
      VITE_DATA_TRADE_API_URL: 'http://localhost:8788',
      VITE_ADEX_LEGACY_AUTH_FALLBACK: 'false',
    })
    const fetchMock = vi.fn((input: string) => {
      if (input.endsWith('/auth/login')) return jsonResponse(authPayload)
      if (input.endsWith('/auth/modules')) return jsonResponse({ modules: [] })
      return jsonResponse({ error: { code: 'NOT_MOCKED' } }, 404)
    })
    vi.stubGlobal('fetch', fetchMock)

    const session = await authApi.loginWithPassword(
      'admin@datatrade.local',
      'UnaClaveLargaLocal123!',
    )

    expect(session.user.role).toBe('admin')
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8788/auth/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          email: 'admin@datatrade.local',
          password: 'UnaClaveLargaLocal123!',
        }),
      }),
    )
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes('/api/auth/login'))).toBe(false)
  })

  it('legacy fallback llama /api/auth/login solo con VITE_ADEX_LEGACY_AUTH_FALLBACK=true', async () => {
    const authApi = await importAuthApi({
      VITE_DATA_TRADE_API_URL: 'http://localhost:8788',
      VITE_ADEX_LEGACY_AUTH_FALLBACK: 'true',
    })
    const legacyPayload = {
      user: {
        id: 'legacy-user',
        username: 'admin',
        email: 'admin',
        role: 'admin',
        status: 'active',
        mustChangePassword: false,
      },
      session: { id: 'legacy-session', expiresAt: '2099-01-01T00:00:00.000Z' },
    }
    const fetchMock = vi.fn(() => jsonResponse(legacyPayload))
    vi.stubGlobal('fetch', fetchMock)

    await authApi.loginWithPassword('admin', 'admin')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }),
    )
  })

  it('registerWithPassword llama Data Trade register con el mapeo esperado', async () => {
    const authApi = await importAuthApi({
      VITE_DATA_TRADE_API_URL: 'http://localhost:8788',
      VITE_ADEX_LEGACY_AUTH_FALLBACK: 'false',
    })
    const fetchMock = vi.fn((input: string) => {
      if (input.endsWith('/auth/register')) return jsonResponse(authPayload)
      if (input.endsWith('/auth/modules')) return jsonResponse({ modules: [] })
      return jsonResponse({ error: { code: 'NOT_MOCKED' } }, 404)
    })
    vi.stubGlobal('fetch', fetchMock)

    await authApi.registerWithPassword({
      fullName: 'Admin Data Trade',
      email: 'admin@datatrade.local',
      companyName: 'Data Trade',
      useCase: 'single_palletization',
      monthlyVolumeBand: 'lt_10',
      password: 'UnaClaveLargaLocal123!',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8788/auth/register',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          email: 'admin@datatrade.local',
          password: 'UnaClaveLargaLocal123!',
          displayName: 'Admin Data Trade',
          organizationName: 'Data Trade',
        }),
      }),
    )
  })

  it('fetchCurrentSession llama /auth/me con Bearer si hay token', async () => {
    const authApi = await importAuthApi({
      VITE_DATA_TRADE_API_URL: 'http://localhost:8788',
      VITE_ADEX_LEGACY_AUTH_FALLBACK: 'false',
    })
    const fetchMock = vi.fn((input: string) => {
      if (input.endsWith('/auth/login')) return jsonResponse(authPayload)
      if (input.endsWith('/auth/me')) {
        return jsonResponse({ user: authPayload.user, session: authPayload.session })
      }
      if (input.endsWith('/auth/modules')) return jsonResponse({ modules: [] })
      return jsonResponse({ error: { code: 'NOT_MOCKED' } }, 404)
    })
    vi.stubGlobal('fetch', fetchMock)

    await authApi.loginWithPassword('admin@datatrade.local', 'UnaClaveLargaLocal123!')
    fetchMock.mockClear()
    await authApi.fetchCurrentSession()

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8788/auth/me',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer access-token' }),
      }),
    )
  })

  it('logoutSession llama /auth/logout con refreshToken y limpia la sesion', async () => {
    const authApi = await importAuthApi({
      VITE_DATA_TRADE_API_URL: 'http://localhost:8788',
      VITE_ADEX_LEGACY_AUTH_FALLBACK: 'false',
    })
    const fetchMock = vi.fn((input: string) => {
      if (input.endsWith('/auth/login')) return jsonResponse(authPayload)
      if (input.endsWith('/auth/modules')) return jsonResponse({ modules: [] })
      if (input.endsWith('/auth/logout')) return Promise.resolve(new Response(null, { status: 204 }))
      return jsonResponse({ error: { code: 'NOT_MOCKED' } }, 404)
    })
    vi.stubGlobal('fetch', fetchMock)

    await authApi.loginWithPassword('admin@datatrade.local', 'UnaClaveLargaLocal123!')
    fetchMock.mockClear()
    await authApi.logoutSession()

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8788/auth/logout',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          refreshToken: 'refresh-token-value-that-is-long-enough',
        }),
      }),
    )
    expect(authApi.getDataTradeAccessToken()).toBeNull()
  })

  it('createHandoffCode llama /auth/handoff/create con Bearer activo', async () => {
    const authApi = await importAuthApi({
      VITE_DATA_TRADE_API_URL: 'http://localhost:8788',
      VITE_ADEX_LEGACY_AUTH_FALLBACK: 'false',
    })
    const fetchMock = vi.fn((input: string) => {
      if (input.endsWith('/auth/login')) return jsonResponse(authPayload)
      if (input.endsWith('/auth/modules')) return jsonResponse({ modules: [] })
      if (input.endsWith('/auth/handoff/create')) {
        return jsonResponse({
          handoffCode: 'handoff-code-value-that-is-long-enough',
          targetModule: 'sislope',
          expiresAt: '2099-01-01T00:01:00.000Z',
        }, 201)
      }
      return jsonResponse({ error: { code: 'NOT_MOCKED' } }, 404)
    })
    vi.stubGlobal('fetch', fetchMock)

    await authApi.loginWithPassword('admin@datatrade.local', 'UnaClaveLargaLocal123!')
    fetchMock.mockClear()

    const handoff = await authApi.createHandoffCode('sislope')

    expect(handoff.handoffCode).toBe('handoff-code-value-that-is-long-enough')
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8788/auth/handoff/create',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer access-token' }),
        body: JSON.stringify({ targetModule: 'sislope' }),
      }),
    )
  })
})
