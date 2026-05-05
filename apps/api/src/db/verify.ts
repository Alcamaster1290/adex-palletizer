import postgres from "postgres";

const requiredTables = [
  "users",
  "organizations",
  "roles",
  "memberships",
  "auth_accounts",
  "auth_sessions",
  "modules",
  "user_module_access",
  "projects",
  "palletizer_runs",
  "map_sessions",
  "search_queries",
  "uploaded_files",
  "data_sources",
  "events",
  "audit_logs",
  "admin_notes",
  "user_flags",
  "schema_migrations",
] as const;

const requiredJsonbColumns = [
  ["users", "metadata"],
  ["organizations", "metadata"],
  ["modules", "metadata"],
  ["projects", "payload"],
  ["palletizer_runs", "input_payload"],
  ["palletizer_runs", "result_payload"],
  ["events", "metadata"],
  ["audit_logs", "metadata"],
  ["user_flags", "value"],
] as const;

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to verify migrations.");
  }

  const sql = postgres(databaseUrl, {
    max: 1,
    prepare: false,
  });

  try {
    const schemas = await sql<{ schema_name: string }[]>`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name = 'data_trade'
    `;
    if (schemas.length !== 1) {
      throw new Error("Schema data_trade was not created.");
    }

    const tables = await sql<{ table_name: string }[]>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'data_trade'
    `;
    const tableSet = new Set(tables.map((table) => table.table_name));
    const missingTables = requiredTables.filter((table) => !tableSet.has(table));
    if (missingTables.length > 0) {
      throw new Error(`Missing data_trade tables: ${missingTables.join(", ")}`);
    }

    const jsonbColumns = await sql<{ table_name: string; column_name: string }[]>`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'data_trade'
        AND data_type = 'jsonb'
    `;
    const jsonbSet = new Set(jsonbColumns.map((column) => `${column.table_name}.${column.column_name}`));
    const missingJsonbColumns = requiredJsonbColumns
      .map(([table, column]) => `${table}.${column}`)
      .filter((columnKey) => !jsonbSet.has(columnKey));
    if (missingJsonbColumns.length > 0) {
      throw new Error(`Missing JSONB columns: ${missingJsonbColumns.join(", ")}`);
    }

    const indexes = await sql<{ indexname: string }[]>`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'data_trade'
    `;
    if (indexes.length < 20) {
      throw new Error(`Expected at least 20 indexes in data_trade, found ${indexes.length}.`);
    }

    const publicCollisions = await sql<{ table_name: string }[]>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY(${requiredTables})
      ORDER BY table_name
    `;

    process.stdout.write(`Schema data_trade verified.\n`);
    process.stdout.write(`Tables verified: ${requiredTables.length}.\n`);
    process.stdout.write(`JSONB columns verified: ${requiredJsonbColumns.length}.\n`);
    process.stdout.write(`Indexes found: ${indexes.length}.\n`);
    if (publicCollisions.length > 0) {
      process.stdout.write(
        `Public tables with matching names exist but were not modified: ${publicCollisions
          .map((entry) => entry.table_name)
          .join(", ")}.\n`,
      );
    } else {
      process.stdout.write("No matching Data Trade tables found in public schema.\n");
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
