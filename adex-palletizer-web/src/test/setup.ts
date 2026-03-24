import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

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
