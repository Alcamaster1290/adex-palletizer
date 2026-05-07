import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

vi.stubEnv('VITE_DATA_TRADE_API_URL', 'http://localhost:8788')
vi.stubEnv('VITE_DATA_TRADE_TRACKING_ENABLED', 'false')
vi.stubEnv('VITE_DATA_TRADE_ADMIN_DASHBOARD_ENABLED', 'false')
vi.stubEnv('VITE_DATA_TRADE_MODULE_CODE', 'adex_palletizer')
vi.stubEnv('VITE_ADEX_LEGACY_AUTH_FALLBACK', 'false')
vi.stubEnv('VITE_SISLOPE_URL', 'https://sis-lo-pe.vercel.app')

if (typeof HTMLCanvasElement !== 'undefined') {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    value: () => {
      return {
        fillStyle: '#000000',
        strokeStyle: '#000000',
        lineWidth: 1,
        font: '12px sans-serif',
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        closePath: () => {},
        stroke: () => {},
        fill: () => {},
        fillRect: () => {},
        strokeRect: () => {},
        fillText: () => {},
        arc: () => {},
        quadraticCurveTo: () => {},
        drawImage: () => {},
        save: () => {},
        restore: () => {},
      } satisfies Partial<CanvasRenderingContext2D>
    },
    configurable: true,
  })

  Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
    value: () => 'data:image/png;base64,TEST',
    configurable: true,
  })
}

const defaultSessionPayload = {
  user: {
    id: 'test-user-id',
    username: 'admin',
    email: 'admin',
    role: 'admin',
    status: 'active',
    mustChangePassword: true,
  },
  session: {
    id: 'test-session-id',
    expiresAt: '2099-01-01T00:00:00.000Z',
  },
}

const defaultDataTradeUser = {
  id: 'test-user-id',
  username: 'admin',
  email: 'admin@datatrade.local',
  displayName: 'Admin',
  status: 'active',
  roles: ['user', 'admin'],
}

const defaultDataTradeSession = {
  id: 'test-session-id',
  expiresAt: '2099-01-01T00:00:00.000Z',
}

const defaultDataTradeAuthPayload = {
  user: defaultDataTradeUser,
  session: defaultDataTradeSession,
  accessToken: 'test-access-token',
  refreshToken: 'test-refresh-token-value-that-is-long-enough',
  tokenType: 'Bearer',
  accessTokenExpiresAt: '2099-01-01T00:15:00.000Z',
}

function jsonResponse(payload: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(payload), {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    }),
  )
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url

      if (url.includes('/auth/me')) {
        return jsonResponse({
          user: defaultDataTradeUser,
          session: defaultDataTradeSession,
        })
      }

      if (url.includes('/auth/login')) {
        return jsonResponse(defaultDataTradeAuthPayload)
      }

      if (url.includes('/auth/register')) {
        return jsonResponse(defaultDataTradeAuthPayload)
      }

      if (url.includes('/auth/logout')) {
        return Promise.resolve(new Response(null, { status: 204 }))
      }

      if (url.includes('/auth/refresh')) {
        return jsonResponse(defaultDataTradeAuthPayload)
      }

      if (url.includes('/auth/modules')) {
        return jsonResponse({
          modules: [
            { key: 'adex_palletizer', displayName: 'ADEX Palletizer', accessLevel: 'user' },
            { key: 'admin', displayName: 'Admin', accessLevel: 'admin' },
          ],
        })
      }

      if (url.includes('/auth/handoff/create')) {
        return jsonResponse({
          handoffCode: 'test-handoff-code',
          targetModule: 'sislope',
          expiresAt: '2099-01-01T00:01:00.000Z',
        }, 201)
      }

      if (url.includes('/events/track')) {
        return jsonResponse({ event: { id: 'event-1' } }, 201)
      }

      if (url.includes('/api/auth/me')) {
        return jsonResponse(defaultSessionPayload)
      }

      if (url.includes('/api/auth/login')) {
        return jsonResponse(defaultSessionPayload)
      }

      if (url.includes('/api/auth/register')) {
        return jsonResponse(defaultSessionPayload)
      }

      if (url.includes('/api/auth/logout')) {
        return Promise.resolve(new Response(null, { status: 204 }))
      }

      if (url.includes('/api/auth/refresh')) {
        return jsonResponse(defaultSessionPayload)
      }

      if (url.includes('/api/health')) {
        return jsonResponse({ status: 'ok', service: 'adex-auth-api', database: 'ok' })
      }

      return jsonResponse({ error: 'NOT_MOCKED' }, 404)
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})
