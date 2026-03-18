import { attachDatabasePool } from '@vercel/functions'
import type { FastifyInstance } from 'fastify'
import type { IncomingMessage, ServerResponse } from 'node:http'

import { buildApp } from './app.js'
import { getConfig } from './config.js'
import { createPool } from './db.js'

const config = getConfig()
const pool = createPool(config.databaseUrl)

attachDatabasePool(pool)

let appPromise: Promise<FastifyInstance> | null = null

async function getApp(): Promise<FastifyInstance> {
  if (!appPromise) {
    appPromise = (async () => {
      const app = buildApp(config, pool)
      await app.ready()
      return app
    })()
  }

  return appPromise
}

export async function handleVercelNodeRequest(req: IncomingMessage, res: ServerResponse) {
  const app = await getApp()

  await new Promise<void>((resolve, reject) => {
    res.on('finish', () => resolve())
    res.on('error', (error) => reject(error))
    app.server.emit('request', req, res)
  })
}
