import { loadConfig } from "../config.js";
import { createAuthService } from "../auth.js";
import { createDatabase } from "./client.js";

async function main() {
  const config = loadConfig();
  if (!config.dataTradeAdminEmail || !config.dataTradeAdminPassword) {
    process.stdout.write(
      "DATA_TRADE_ADMIN_EMAIL/DATA_TRADE_ADMIN_PASSWORD not set; skipping admin bootstrap.\n",
    );
    return;
  }

  const connection = createDatabase(config.databaseUrl);
  try {
    const auth = createAuthService(connection.db, config);
    const result = await auth.bootstrapAdmin({
      email: config.dataTradeAdminEmail,
      password: config.dataTradeAdminPassword,
      displayName: config.dataTradeAdminName,
    });

    process.stdout.write(
      `${result.created ? "Created" : "Verified"} Data Trade admin ${result.email} (${result.userId}).\n`,
    );
  } finally {
    await connection.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
