import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema.js";

export type DataTradeDatabase = PostgresJsDatabase<typeof schema>;

export interface DatabaseConnection {
  db: DataTradeDatabase;
  close: () => Promise<void>;
}

export function createDatabase(databaseUrl: string): DatabaseConnection {
  const client = postgres(databaseUrl, {
    max: 10,
    idle_timeout: 20,
    prepare: false,
  });

  return {
    db: drizzle(client, { schema }),
    close: async () => {
      await client.end({ timeout: 5 });
    },
  };
}
