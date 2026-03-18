import pg from 'pg'

const { Pool } = pg

export function createPool(connectionString: string): pg.Pool {
  const isLocalConnection =
    connectionString.includes('localhost') || connectionString.includes('127.0.0.1')

  return new Pool({
    connectionString,
    ssl: isLocalConnection
      ? undefined
      : {
          rejectUnauthorized: false,
        },
    max: 10,
    idleTimeoutMillis: 30_000,
  })
}
