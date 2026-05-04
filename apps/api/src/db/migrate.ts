import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import postgres from "postgres";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, "migrations");

async function listMigrationFiles(): Promise<string[]> {
  const entries = await readdir(migrationsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to run migrations.");
  }

  const sql = postgres(databaseUrl, {
    max: 1,
    prepare: false,
  });

  try {
    await sql`
      CREATE SCHEMA IF NOT EXISTS data_trade
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS data_trade.schema_migrations (
        id text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `;

    const migrationFiles = await listMigrationFiles();
    for (const fileName of migrationFiles) {
      const existing = await sql<{ id: string }[]>`
        SELECT id
        FROM data_trade.schema_migrations
        WHERE id = ${fileName}
        LIMIT 1
      `;

      if (existing.length > 0) {
        process.stdout.write(`Skipping ${fileName}; already applied.\n`);
        continue;
      }

      const migrationSql = await readFile(path.join(migrationsDir, fileName), "utf8");
      process.stdout.write(`Applying ${fileName}...\n`);
      await sql.unsafe(migrationSql);
      await sql`
        INSERT INTO data_trade.schema_migrations (id)
        VALUES (${fileName})
      `;
    }

    process.stdout.write("Data Trade migrations complete.\n");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
