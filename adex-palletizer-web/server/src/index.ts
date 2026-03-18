import { buildApp } from './app.js'
import { getConfig } from './config.js'
import { createPool } from './db.js'

const config = getConfig()
const pool = createPool(config.databaseUrl)
const app = buildApp(config, pool)

async function start() {
  try {
    await app.listen({
      host: config.host,
      port: config.port,
    })
  } catch (error) {
    app.log.error(error)
    process.exitCode = 1
  }
}

async function shutdown(signal: string) {
  app.log.info({ signal }, 'Cerrando backend ADEX')
  await app.close()
  await pool.end()
  process.exit(0)
}

process.on('SIGINT', () => {
  void shutdown('SIGINT')
})

process.on('SIGTERM', () => {
  void shutdown('SIGTERM')
})

void start()
