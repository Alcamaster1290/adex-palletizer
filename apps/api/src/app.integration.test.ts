import { describe, expect, it } from "vitest";

import { buildApp } from "./app.js";
import type { AppConfig } from "./config.js";
import { createDatabase } from "./db/client.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();

const config: AppConfig = {
  nodeEnv: "test",
  host: "127.0.0.1",
  port: 0,
  databaseUrl: testDatabaseUrl || "postgres://postgres:postgres@localhost:55432/data_trade",
  frontendOrigins: ["http://localhost:5173"],
  authCookieName: "data_trade_refresh_token",
  authCookieDomain: null,
  authCookieSecure: false,
  sessionTtlDays: 30,
  ipHashSecret: "test-secret",
  adminBootstrapEmail: null,
  adminBootstrapPasswordHash: null,
  requestBodyLimitBytes: 64 * 1024,
  eventMetadataMaxBytes: 8 * 1024,
  eventRateLimitMax: 120,
  eventRateLimitWindowMs: 60_000,
  logLevel: "fatal",
};

describe.skipIf(!testDatabaseUrl)("Data Trade API database integration", () => {
  it("passes readiness and writes an event with a real database", async () => {
    const connection = createDatabase(config.databaseUrl);
    const app = await buildApp({
      config,
      db: connection.db,
      logger: false,
    });

    try {
      const ready = await app.inject({
        method: "GET",
        url: "/ready",
      });

      expect(ready.statusCode).toBe(200);

      const event = await app.inject({
        method: "POST",
        url: "/events/track",
        headers: {
          "x-forwarded-for": "198.51.100.10",
          "user-agent": "vitest-integration",
        },
        payload: {
          anonymousId: `integration-${Date.now()}`,
          module: "api",
          eventName: "module_opened",
          metadata: {
            integration: true,
          },
        },
      });

      expect(event.statusCode).toBe(201);
      expect(event.json().event).toMatchObject({
        module: "api",
        eventName: "module_opened",
      });
    } finally {
      await app.close();
      await connection.close();
    }
  });
});
