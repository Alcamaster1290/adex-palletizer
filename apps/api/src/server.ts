import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDatabase } from "./db/client.js";

async function main() {
  const config = loadConfig();
  const connection = createDatabase(config.databaseUrl);
  const app = await buildApp({
    config,
    db: connection.db,
  });

  const close = async () => {
    await app.close();
    await connection.close();
  };

  process.once("SIGINT", () => {
    void close().finally(() => process.exit(0));
  });
  process.once("SIGTERM", () => {
    void close().finally(() => process.exit(0));
  });

  await app.listen({
    host: config.host,
    port: config.port,
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
