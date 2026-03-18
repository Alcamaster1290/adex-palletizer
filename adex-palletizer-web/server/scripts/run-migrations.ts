import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { Client } from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..', '..')

const migrationFiles = [
  path.join(projectRoot, 'docs', 'database', '001_auth_usuarios_postgres.sql'),
  path.join(projectRoot, 'docs', 'database', '002_backend_foundation_postgres.sql'),
]

async function run() {
  const connectionString = process.env.DATABASE_URL?.trim()

  if (!connectionString) {
    throw new Error('DATABASE_URL es obligatorio para ejecutar migraciones.')
  }

  const isLocalConnection =
    connectionString.includes('localhost') || connectionString.includes('127.0.0.1')

  const client = new Client({
    connectionString,
    ssl: isLocalConnection
      ? undefined
      : {
          rejectUnauthorized: false,
        },
  })

  await client.connect()

  try {
    for (const migrationFile of migrationFiles) {
      const sql = await readFile(migrationFile, 'utf8')
      process.stdout.write(`Aplicando ${path.basename(migrationFile)}...\n`)
      await client.query(sql)
    }

    process.stdout.write('Migraciones completadas.\n')
  } finally {
    await client.end()
  }
}

run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
