const DEFAULT_PORT = 8787
const DEFAULT_HOST = '0.0.0.0'
const DEFAULT_CORS_ORIGIN = 'http://localhost:5173'
const DEFAULT_COOKIE_NAME = 'adex_refresh_token'
const DEFAULT_SESSION_TTL_DAYS = 30
const DEFAULT_SISLOPE_URL = 'https://sis-lo-pe.vercel.app'

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback
  }

  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }

  return parsed
}

export interface AppConfig {
  port: number
  host: string
  databaseUrl: string
  corsOrigin: string
  cookieName: string
  sessionTtlDays: number
  cookieSecure: boolean
  sislopeUrl: string
}

export function getConfig(): AppConfig {
  const databaseUrl = process.env.DATABASE_URL?.trim()
  if (!databaseUrl) {
    throw new Error('DATABASE_URL es obligatorio para iniciar el backend.')
  }

  const isVercelRuntime = process.env.VERCEL === '1' || Boolean(process.env.VERCEL_URL)

  return {
    port: parsePositiveInteger(process.env.PORT, DEFAULT_PORT),
    host: process.env.HOST?.trim() || DEFAULT_HOST,
    databaseUrl,
    corsOrigin: process.env.CORS_ORIGIN?.trim() || DEFAULT_CORS_ORIGIN,
    cookieName: process.env.COOKIE_NAME?.trim() || DEFAULT_COOKIE_NAME,
    sessionTtlDays: parsePositiveInteger(process.env.SESSION_TTL_DAYS, DEFAULT_SESSION_TTL_DAYS),
    cookieSecure: process.env.AUTH_COOKIE_SECURE === 'true' || isVercelRuntime,
    sislopeUrl: process.env.SISLOPE_URL?.trim() || DEFAULT_SISLOPE_URL,
  }
}
