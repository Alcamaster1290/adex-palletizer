import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { buildApp } from "./app.js";
import { createAuthService } from "./auth.js";
import type { AppConfig } from "./config.js";
import { createDatabase } from "./db/client.js";
import { authAccounts, authSessions } from "./db/schema.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();

const config: AppConfig = {
  nodeEnv: "test",
  appEnv: "test",
  host: "127.0.0.1",
  port: 0,
  databaseUrl: testDatabaseUrl || "postgres://postgres:postgres@localhost:55432/data_trade",
  frontendOrigins: ["http://localhost:5173"],
  authCookieName: "data_trade_refresh_token",
  authCookieDomain: null,
  authCookieSecure: false,
  sessionTtlDays: 30,
  authAccessTokenSecret: "test-access-token-secret",
  authRefreshTokenSecret: "test-refresh-token-secret",
  authAccessTokenTtlSeconds: 900,
  authRateLimitMax: 10,
  authRateLimitWindowMs: 60_000,
  ipHashSecret: "test-secret",
  dataTradeAdminEmail: null,
  dataTradeAdminPassword: null,
  dataTradeAdminName: null,
  requestBodyLimitBytes: 64 * 1024,
  eventMetadataMaxBytes: 8 * 1024,
  eventRateLimitMax: 120,
  eventRateLimitWindowMs: 60_000,
  logLevel: "fatal",
};

describe.skipIf(!testDatabaseUrl)("Data Trade API database integration", () => {
  it("passes readiness and writes anonymous and authenticated events with a real database", async () => {
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

  it("supports register, login, me, refresh, logout and admin bootstrap with a real database", async () => {
    const connection = createDatabase(config.databaseUrl);
    const app = await buildApp({
      config,
      db: connection.db,
      logger: false,
    });
    const unique = Date.now();
    const email = `phase2-${unique}@datatrade.local`;
    const password = "ValidPassword123";

    try {
      const register = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: {
          email,
          password,
          displayName: "Phase 2 User",
        },
      });
      expect(register.statusCode).toBe(201);
      const registered = register.json();
      expect(registered.accessToken).toEqual(expect.any(String));
      expect(registered.refreshToken).toEqual(expect.any(String));

      const storedAccount = await connection.db
        .select({
          passwordHash: authAccounts.passwordHash,
        })
        .from(authAccounts)
        .where(eq(authAccounts.providerAccountId, email))
        .limit(1);
      expect(storedAccount[0]?.passwordHash).toBeTruthy();
      expect(storedAccount[0]?.passwordHash).not.toBe(password);
      expect(storedAccount[0]?.passwordHash).not.toContain(password);

      const duplicate = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: {
          email,
          password,
        },
      });
      expect(duplicate.statusCode).toBe(409);

      const badLogin = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: {
          email,
          password: "WrongPassword123",
        },
      });
      expect(badLogin.statusCode).toBe(401);

      const login = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: {
          email,
          password,
        },
      });
      expect(login.statusCode).toBe(200);
      const loggedIn = login.json();

      const me = await app.inject({
        method: "GET",
        url: "/auth/me",
        headers: {
          authorization: `Bearer ${loggedIn.accessToken}`,
        },
      });
      expect(me.statusCode).toBe(200);
      expect(me.json().user.email).toBe(email);

      const modules = await app.inject({
        method: "GET",
        url: "/auth/modules",
        headers: {
          authorization: `Bearer ${loggedIn.accessToken}`,
        },
      });
      expect(modules.statusCode).toBe(200);
      const moduleKeys = modules.json().modules.map((entry: { key: string }) => entry.key);
      expect(moduleKeys).toContain("sislope");
      expect(moduleKeys).not.toContain("admin");

      const refresh = await app.inject({
        method: "POST",
        url: "/auth/refresh",
        payload: {
          refreshToken: loggedIn.refreshToken,
        },
      });
      expect(refresh.statusCode).toBe(200);
      const refreshed = refresh.json();
      expect(refreshed.refreshToken).not.toBe(loggedIn.refreshToken);

      const oldRefreshReuse = await app.inject({
        method: "POST",
        url: "/auth/refresh",
        payload: {
          refreshToken: loggedIn.refreshToken,
        },
      });
      expect(oldRefreshReuse.statusCode).toBe(401);

      const storedSession = await connection.db
        .select({
          refreshTokenHash: authSessions.refreshTokenHash,
        })
        .from(authSessions)
        .where(eq(authSessions.id, refreshed.session.id))
        .limit(1);
      expect(storedSession[0]?.refreshTokenHash).toBeTruthy();
      expect(storedSession[0]?.refreshTokenHash).not.toBe(refreshed.refreshToken);
      expect(storedSession[0]?.refreshTokenHash).not.toContain(refreshed.refreshToken);

      const tracked = await app.inject({
        method: "POST",
        url: "/events/track",
        headers: {
          authorization: `Bearer ${refreshed.accessToken}`,
        },
        payload: {
          module: "api",
          eventName: "module_opened",
          metadata: {
            authenticated: true,
          },
        },
      });
      expect(tracked.statusCode).toBe(201);

      const logout = await app.inject({
        method: "POST",
        url: "/auth/logout",
        headers: {
          authorization: `Bearer ${refreshed.accessToken}`,
        },
        payload: {
          refreshToken: refreshed.refreshToken,
        },
      });
      expect(logout.statusCode).toBe(204);

      const revokedRefresh = await app.inject({
        method: "POST",
        url: "/auth/refresh",
        payload: {
          refreshToken: refreshed.refreshToken,
        },
      });
      expect(revokedRefresh.statusCode).toBe(401);

      const afterLogout = await app.inject({
        method: "GET",
        url: "/auth/me",
        headers: {
          authorization: `Bearer ${refreshed.accessToken}`,
        },
      });
      expect(afterLogout.statusCode).toBe(401);

      const anonymousEvent = await app.inject({
        method: "POST",
        url: "/events/track",
        payload: {
          anonymousId: `anon-${unique}`,
          module: "api",
          eventName: "module_opened",
        },
      });
      expect(anonymousEvent.statusCode).toBe(201);

      const auth = createAuthService(connection.db, config);
      const adminEmail = `admin-${unique}@datatrade.local`;
      const firstSeed = await auth.bootstrapAdmin({
        email: adminEmail,
        password: "ValidAdminPassword123",
        displayName: "Phase 2 Admin",
      });
      const secondSeed = await auth.bootstrapAdmin({
        email: adminEmail,
        password: "ValidAdminPassword123",
        displayName: "Phase 2 Admin",
      });
      expect(firstSeed.created).toBe(true);
      expect(secondSeed.created).toBe(false);
      expect(secondSeed.userId).toBe(firstSeed.userId);

      const adminLogin = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: {
          email: adminEmail,
          password: "ValidAdminPassword123",
        },
      });
      expect(adminLogin.statusCode).toBe(200);
      const adminModules = await app.inject({
        method: "GET",
        url: "/auth/modules",
        headers: {
          authorization: `Bearer ${adminLogin.json().accessToken}`,
        },
      });
      expect(adminModules.statusCode).toBe(200);
      expect(adminModules.json().modules.map((entry: { key: string }) => entry.key)).toEqual(
        expect.arrayContaining(["admin", "api"]),
      );
    } finally {
      await app.close();
      await connection.close();
    }
  });
});
