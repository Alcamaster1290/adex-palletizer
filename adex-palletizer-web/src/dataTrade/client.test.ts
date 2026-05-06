import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createDataTradeClient } from './client'
import type { DataTradeFrontendConfig } from './config'

const baseConfig: DataTradeFrontendConfig = {
  trackingEnabled: true,
  adminDashboardEnabled: false,
  apiUrl: 'https://api.datatrade.test',
  moduleCode: 'adex_palletizer',
}

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
    email: 'user@datatrade.test',
    username: 'user',
    displayName: 'User',
    status: 'active',
    roles: ['user'],
  },
  session: { id: 'session-1', expiresAt: '2099-01-01T00:00:00.000Z' },
  accessToken: 'access-token',
  refreshToken: 'refresh-token-value-that-is-long-enough',
  tokenType: 'Bearer',
  accessTokenExpiresAt: '2099-01-01T00:15:00.000Z',
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('DataTradeAuthApi', () => {
  it('no llama al backend cuando los flags estan apagados', async () => {
    const fetchMock = vi.fn()
    const client = createDataTradeClient(
      { ...baseConfig, apiUrl: '', trackingEnabled: false },
      fetchMock,
    )

    await client.loadCurrentUser()
    await client.track('module_opened')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(client.getSessionSnapshot().status).toBe('disabled')
  })

  it('login guarda sesion en memoria y carga modulos', async () => {
    const fetchMock = vi.fn((input: string, _init?: RequestInit) => {
      if (input.endsWith('/auth/login')) return jsonResponse(authPayload)
      if (input.endsWith('/auth/modules')) {
        return jsonResponse({
          modules: [{ key: 'adex_palletizer', displayName: 'ADEX', accessLevel: 'member' }],
        })
      }
      return jsonResponse({}, 404)
    })
    const client = createDataTradeClient(baseConfig, fetchMock)

    const session = await client.login({
      email: 'user@datatrade.test',
      password: 'ChangeMeOnlyLocal123',
    })

    expect(session.status).toBe('authenticated')
    expect(session.user?.email).toBe('user@datatrade.test')
    expect(client.canAccessModule('adex_palletizer')).toBe(true)
  })

  it('auth/me carga usuario con Bearer existente', async () => {
    const fetchMock = vi.fn((input: string, _init?: RequestInit) => {
      if (input.endsWith('/auth/login')) return jsonResponse(authPayload)
      if (input.endsWith('/auth/me')) {
        return jsonResponse({ user: authPayload.user, session: authPayload.session })
      }
      if (input.endsWith('/auth/modules')) return jsonResponse({ modules: [] })
      return jsonResponse({}, 404)
    })
    const client = createDataTradeClient(baseConfig, fetchMock)

    await client.login({ email: authPayload.user.email, password: 'ChangeMeOnlyLocal123' })
    const session = await client.loadCurrentUser()

    expect(session.status).toBe('authenticated')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.datatrade.test/auth/me',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer access-token' }),
      }),
    )
  })

  it('logout limpia la sesion en memoria', async () => {
    const fetchMock = vi.fn((input: string, _init?: RequestInit) => {
      if (input.endsWith('/auth/login')) return jsonResponse(authPayload)
      if (input.endsWith('/auth/modules')) return jsonResponse({ modules: [] })
      if (input.endsWith('/auth/logout')) return Promise.resolve(new Response(null, { status: 204 }))
      return jsonResponse({}, 404)
    })
    const client = createDataTradeClient(baseConfig, fetchMock)

    await client.login({ email: authPayload.user.email, password: 'ChangeMeOnlyLocal123' })
    const session = await client.logout()

    expect(session.status).toBe('unauthenticated')
    expect(session.user).toBeNull()
  })

  it('tracking anonimo envia anonymousId sin Authorization', async () => {
    const fetchMock = vi.fn(() => jsonResponse({ event: { id: 'event-1' } }, 201))
    const client = createDataTradeClient(baseConfig, fetchMock)

    await client.track('module_opened', { source: 'test' })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.datatrade.test/events/track',
      expect.objectContaining({
        body: expect.stringContaining('"anonymousId"'),
        headers: expect.not.objectContaining({ Authorization: expect.any(String) }),
      }),
    )
  })

  it('tracking autenticado agrega Bearer y no envia userId del cliente', async () => {
    const fetchMock = vi.fn((input: string, _init?: RequestInit) => {
      if (input.endsWith('/auth/login')) return jsonResponse(authPayload)
      if (input.endsWith('/auth/modules')) return jsonResponse({ modules: [] })
      if (input.endsWith('/events/track')) return jsonResponse({ event: { id: 'event-1' } }, 201)
      return jsonResponse({}, 404)
    })
    const client = createDataTradeClient(baseConfig, fetchMock)

    await client.login({ email: authPayload.user.email, password: 'ChangeMeOnlyLocal123' })
    await client.track('palletizer_calculation_created', { userId: 'spoofed', token: 'secret' })

    const trackCall = fetchMock.mock.calls.find(([input]) =>
      String(input).endsWith('/events/track'),
    )
    expect(trackCall?.[1]?.headers).toEqual(
      expect.objectContaining({ Authorization: 'Bearer access-token' }),
    )
    expect(trackCall?.[1]?.body).not.toContain('spoofed')
    expect(trackCall?.[1]?.body).not.toContain('secret')
  })

  it('error de tracking no rompe modo legacy', async () => {
    const fetchMock = vi.fn(() => Promise.reject(new Error('network down')))
    const client = createDataTradeClient(baseConfig, fetchMock)

    await expect(client.track('module_opened')).resolves.toEqual({
      sent: false,
      reason: 'api_error',
    })
  })
})
