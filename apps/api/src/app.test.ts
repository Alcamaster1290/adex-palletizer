import { randomUUID } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { buildApp } from "./app.js";
import type { AdminService } from "./admin.js";
import { AuthError, type AuthResponse, type AuthService, type AuthSessionPayload } from "./auth.js";
import type { AppConfig } from "./config.js";
import type { TrackEventInput } from "./events.js";

const config: AppConfig = {
  nodeEnv: "test",
  appEnv: "test",
  host: "127.0.0.1",
  port: 0,
  databaseUrl: "postgres://postgres:postgres@localhost:5432/data_trade",
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

const authUser = {
  id: randomUUID(),
  email: "user@datatrade.local",
  username: "user",
  displayName: "Data Trade User",
  status: "active",
  roles: ["user"],
};

const authSession: AuthSessionPayload = {
  user: authUser,
  session: {
    id: randomUUID(),
    expiresAt: "2026-05-05T00:00:00.000Z",
  },
};

const adminUser = {
  ...authUser,
  id: randomUUID(),
  email: "admin@datatrade.local",
  username: "admin",
  displayName: "Data Trade Admin",
  roles: ["user", "admin"],
};

const adminSession: AuthSessionPayload = {
  user: adminUser,
  session: {
    id: randomUUID(),
    expiresAt: "2026-05-05T00:00:00.000Z",
  },
};

const authResponse: AuthResponse = {
  ...authSession,
  accessToken: "valid-token",
  refreshToken: "refresh-token-value-that-is-long-enough",
  tokenType: "Bearer",
  accessTokenExpiresAt: "2026-05-04T00:15:00.000Z",
};

function createAuthService(overrides: Partial<AuthService> = {}): AuthService {
  return {
    register: vi.fn(async () => authResponse),
    login: vi.fn(async () => authResponse),
    refresh: vi.fn(async () => authResponse),
    logout: vi.fn(async () => undefined),
    getSession: vi.fn(async (token: string) => {
      if (token !== "valid-token") {
        throw new AuthError("UNAUTHENTICATED", 401);
      }
      return authSession;
    }),
    getModules: vi.fn(async () => [
      {
        key: "sislope",
        displayName: "SisLoPe",
        accessLevel: "user",
      },
    ]),
    bootstrapAdmin: vi.fn(async () => ({
      created: false,
      userId: authUser.id,
      email: authUser.email,
    })),
    ...overrides,
  };
}

function createAdminAuthService(overrides: Partial<AuthService> = {}): AuthService {
  return createAuthService({
    getSession: vi.fn(async (token: string) => {
      if (token !== "admin-token") {
        throw new AuthError("UNAUTHENTICATED", 401);
      }
      return adminSession;
    }),
    getModules: vi.fn(async () => [
      {
        key: "admin",
        displayName: "Admin",
        accessLevel: "admin",
      },
    ]),
    ...overrides,
  });
}

function createAdminService(overrides: Partial<AdminService> = {}): AdminService {
  return {
    getOverview: vi.fn(async () => ({
      total_users: 2,
      active_users_24h: 1,
      active_users_7d: 1,
      active_users_30d: 1,
      total_events: 3,
      events_24h: 1,
      events_7d: 2,
      events_30d: 3,
      total_modules: 4,
      top_module_by_events: "adex_palletizer",
      latest_event_at: "2026-05-04T00:00:00.000Z",
    })),
    listUsers: vi.fn(async () => ({
      users: [
        {
          id: adminUser.id,
          email: adminUser.email,
          name: adminUser.displayName,
          role: "admin",
          created_at: "2026-05-04T00:00:00.000Z",
          last_seen_at: "2026-05-04T00:00:00.000Z",
          event_count: 2,
          module_count: 1,
        },
      ],
      total: 1,
      limit: 50,
      offset: 0,
    })),
    getUserActivity: vi.fn(async () => ({
      latest_events: [],
      modules_used: [],
      last_login_at: null,
      latest_tracking_event_at: null,
      event_name_counts: [],
    })),
    listEvents: vi.fn(async (query) => ({
      events: [
        {
          id: "event-1",
          user_id: adminUser.id,
          anonymous_id: null,
          module: query.module ?? "adex_palletizer",
          event_name: query.event_name ?? "module_opened",
          metadata: {},
          path: "/",
          created_at: "2026-05-04T00:00:00.000Z",
        },
      ],
      total: 3,
      limit: query.limit,
      offset: query.offset,
    })),
    getModulesUsage: vi.fn(async () => ({
      modules: [
        {
          module_code: "adex_palletizer",
          module_name: "ADEX Palletizer",
          events_count: 3,
          unique_users: 1,
          anonymous_users: 1,
          last_event_at: "2026-05-04T00:00:00.000Z",
        },
      ],
    })),
    getRetention: vi.fn(async () => ({
      new_users_7d: 0,
      returning_users_7d: 0,
      new_users_30d: 0,
      returning_users_30d: 0,
      stickiness_7d_30d: 0,
    })),
    getErrors: vi.fn(async () => ({
      errors: [],
    })),
    aggregateMetrics: vi.fn(async (input) => ({
      from: input.from ?? "2026-05-01",
      to: input.to ?? "2026-05-04",
      events_read: 3,
      module_rows: 1,
      user_rows: 1,
    })),
    ...overrides,
  };
}

describe("Data Trade API", () => {
  it("returns health without touching the database", async () => {
    const readyCheck = vi.fn();
    const app = await buildApp({
      config,
      readyCheck,
      trackEvent: vi.fn(),
      logger: false,
    });

    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "ok",
      service: "data-trade-api",
    });
    expect(readyCheck).not.toHaveBeenCalled();

    await app.close();
  });

  it("runs the ready check", async () => {
    const readyCheck = vi.fn().mockResolvedValue(undefined);
    const app = await buildApp({
      config,
      readyCheck,
      trackEvent: vi.fn(),
      logger: false,
    });

    const response = await app.inject({
      method: "GET",
      url: "/ready",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "ok",
      database: "ok",
    });
    expect(readyCheck).toHaveBeenCalledOnce();

    await app.close();
  });

  it("tracks anonymous events with a hashed IP", async () => {
    const trackEvent = vi.fn(async (input: TrackEventInput) => ({
      id: randomUUID(),
      module: input.module,
      eventName: input.eventName,
      createdAt: "2026-05-04T00:00:00.000Z",
    }));
    const app = await buildApp({
      config,
      readyCheck: vi.fn(),
      trackEvent,
      logger: false,
    });

    const response = await app.inject({
      method: "POST",
      url: "/events/track",
      headers: {
        origin: "http://localhost:5173",
        "x-forwarded-for": "203.0.113.9",
        "user-agent": "vitest-agent",
      },
      payload: {
        anonymousId: "anon-123",
        module: "sislope",
        eventName: "module_opened",
        path: "/map",
        metadata: {
          source: "test",
        },
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().event).toMatchObject({
      module: "sislope",
      eventName: "module_opened",
    });

    expect(trackEvent).toHaveBeenCalledOnce();
    const tracked = trackEvent.mock.calls[0]?.[0];
    expect(tracked?.ipHash).toHaveLength(64);
    expect(tracked?.ipHash).not.toBe("203.0.113.9");
    expect(tracked?.userAgent).toBe("vitest-agent");

    await app.close();
  });

  it("tracks authenticated events with the bearer user id", async () => {
    const trackEvent = vi.fn(async (input: TrackEventInput) => ({
      id: randomUUID(),
      module: input.module,
      eventName: input.eventName,
      createdAt: "2026-05-04T00:00:00.000Z",
    }));
    const app = await buildApp({
      config,
      readyCheck: vi.fn(),
      trackEvent,
      authService: createAuthService(),
      logger: false,
    });

    const response = await app.inject({
      method: "POST",
      url: "/events/track",
      headers: {
        authorization: "Bearer valid-token",
      },
      payload: {
        module: "adex_palletizer",
        eventName: "palletizer_calculation_created",
        metadata: {
          mode: "container",
        },
      },
    });

    expect(response.statusCode).toBe(201);
    expect(trackEvent.mock.calls[0]?.[0].userId).toBe(authUser.id);

    await app.close();
  });

  it("registers a valid user", async () => {
    const authService = createAuthService();
    const app = await buildApp({
      config,
      readyCheck: vi.fn(),
      trackEvent: vi.fn(),
      authService,
      logger: false,
    });

    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: "new@datatrade.local",
        password: "ValidPassword123",
        displayName: "New User",
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      tokenType: "Bearer",
      accessToken: "valid-token",
      user: {
        email: authUser.email,
      },
    });
    expect(authService.register).toHaveBeenCalledOnce();

    await app.close();
  });

  it("rejects invalid registration payloads", async () => {
    const app = await buildApp({
      config,
      readyCheck: vi.fn(),
      trackEvent: vi.fn(),
      authService: createAuthService(),
      logger: false,
    });

    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: "bad-email",
        password: "short",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toMatchObject({
      code: "VALIDATION_ERROR",
    });

    await app.close();
  });

  it("rejects duplicate registration emails", async () => {
    const app = await buildApp({
      config,
      readyCheck: vi.fn(),
      trackEvent: vi.fn(),
      authService: createAuthService({
        register: vi.fn(async () => {
          throw new AuthError("EMAIL_ALREADY_REGISTERED", 409);
        }),
      }),
      logger: false,
    });

    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: "existing@datatrade.local",
        password: "ValidPassword123",
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error).toMatchObject({
      code: "EMAIL_ALREADY_REGISTERED",
    });

    await app.close();
  });

  it("logs in with valid credentials", async () => {
    const authService = createAuthService();
    const app = await buildApp({
      config,
      readyCheck: vi.fn(),
      trackEvent: vi.fn(),
      authService,
      logger: false,
    });

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "user@datatrade.local",
        password: "ValidPassword123",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().refreshToken).toBe(authResponse.refreshToken);
    expect(authService.login).toHaveBeenCalledOnce();

    await app.close();
  });

  it("rejects invalid login credentials", async () => {
    const app = await buildApp({
      config,
      readyCheck: vi.fn(),
      trackEvent: vi.fn(),
      authService: createAuthService({
        login: vi.fn(async () => {
          throw new AuthError("INVALID_CREDENTIALS", 401);
        }),
      }),
      logger: false,
    });

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "user@datatrade.local",
        password: "WrongPassword123",
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error).toMatchObject({
      code: "INVALID_CREDENTIALS",
    });

    await app.close();
  });

  it("requires bearer token for /auth/me", async () => {
    const app = await buildApp({
      config,
      readyCheck: vi.fn(),
      trackEvent: vi.fn(),
      authService: createAuthService(),
      logger: false,
    });

    const response = await app.inject({
      method: "GET",
      url: "/auth/me",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error).toMatchObject({
      code: "UNAUTHENTICATED",
    });

    await app.close();
  });

  it("returns /auth/me with a valid bearer token", async () => {
    const app = await buildApp({
      config,
      readyCheck: vi.fn(),
      trackEvent: vi.fn(),
      authService: createAuthService(),
      logger: false,
    });

    const response = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: {
        authorization: "Bearer valid-token",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().user).toMatchObject({
      id: authUser.id,
    });

    await app.close();
  });

  it("refreshes a session", async () => {
    const authService = createAuthService();
    const app = await buildApp({
      config,
      readyCheck: vi.fn(),
      trackEvent: vi.fn(),
      authService,
      logger: false,
    });

    const response = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: {
        refreshToken: authResponse.refreshToken,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().accessToken).toBe("valid-token");
    expect(authService.refresh).toHaveBeenCalledOnce();

    await app.close();
  });

  it("logs out and revokes the provided session", async () => {
    const authService = createAuthService();
    const app = await buildApp({
      config,
      readyCheck: vi.fn(),
      trackEvent: vi.fn(),
      authService,
      logger: false,
    });

    const response = await app.inject({
      method: "POST",
      url: "/auth/logout",
      headers: {
        authorization: "Bearer valid-token",
      },
      payload: {
        refreshToken: authResponse.refreshToken,
      },
    });

    expect(response.statusCode).toBe(204);
    expect(authService.logout).toHaveBeenCalledOnce();
    expect(vi.mocked(authService.logout).mock.calls[0]?.[0]).toMatchObject({
      refreshToken: authResponse.refreshToken,
    });
    expect(vi.mocked(authService.logout).mock.calls[0]?.[2]).toBe("valid-token");

    await app.close();
  });

  it("rate limits login attempts", async () => {
    const authService = createAuthService();
    const app = await buildApp({
      config: {
        ...config,
        authRateLimitMax: 1,
      },
      readyCheck: vi.fn(),
      trackEvent: vi.fn(),
      authService,
      logger: false,
    });

    const payload = {
      email: "rate@datatrade.local",
      password: "ValidPassword123",
    };
    const first = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload,
    });
    const second = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload,
    });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(429);
    expect(second.json().error).toMatchObject({
      code: "AUTH_RATE_LIMITED",
    });

    await app.close();
  });

  it("rate limits refresh attempts", async () => {
    const authService = createAuthService();
    const app = await buildApp({
      config: {
        ...config,
        authRateLimitMax: 1,
      },
      readyCheck: vi.fn(),
      trackEvent: vi.fn(),
      authService,
      logger: false,
    });

    const payload = {
      refreshToken: authResponse.refreshToken,
    };
    const first = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload,
    });
    const second = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload,
    });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(429);
    expect(second.json().error).toMatchObject({
      code: "AUTH_RATE_LIMITED",
    });

    await app.close();
  });

  it("returns only modules supplied by auth permissions", async () => {
    const app = await buildApp({
      config,
      readyCheck: vi.fn(),
      trackEvent: vi.fn(),
      authService: createAuthService({
        getModules: vi.fn(async () => [
          {
            key: "sislope",
            displayName: "SisLoPe",
            accessLevel: "user",
          },
        ]),
      }),
      logger: false,
    });

    const response = await app.inject({
      method: "GET",
      url: "/auth/modules",
      headers: {
        authorization: "Bearer valid-token",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().modules.map((entry: { key: string }) => entry.key)).toEqual(["sislope"]);

    await app.close();
  });

  it("rejects event user_id impersonation with an invalid bearer token", async () => {
    const trackEvent = vi.fn();
    const app = await buildApp({
      config,
      readyCheck: vi.fn(),
      trackEvent,
      authService: createAuthService(),
      logger: false,
    });

    const response = await app.inject({
      method: "POST",
      url: "/events/track",
      headers: {
        authorization: "Bearer invalid-token",
      },
      payload: {
        userId: randomUUID(),
        anonymousId: "anon-with-invalid-token",
        module: "api",
        eventName: "module_opened",
      },
    });

    expect(response.statusCode).toBe(401);
    expect(trackEvent).not.toHaveBeenCalled();

    await app.close();
  });

  it("rejects user identity fields inside event metadata", async () => {
    const trackEvent = vi.fn();
    const app = await buildApp({
      config,
      readyCheck: vi.fn(),
      trackEvent,
      logger: false,
    });

    const response = await app.inject({
      method: "POST",
      url: "/events/track",
      payload: {
        anonymousId: "anon-metadata-impersonation",
        module: "api",
        eventName: "module_opened",
        metadata: {
          user_id: randomUUID(),
        },
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toMatchObject({
      code: "RESERVED_METADATA_FIELD",
    });
    expect(trackEvent).not.toHaveBeenCalled();

    await app.close();
  });

  it("rejects unknown events", async () => {
    const app = await buildApp({
      config,
      readyCheck: vi.fn(),
      trackEvent: vi.fn(),
      logger: false,
    });

    const response = await app.inject({
      method: "POST",
      url: "/events/track",
      payload: {
        anonymousId: "anon-123",
        module: "sislope",
        eventName: "not_supported",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toMatchObject({
      code: "VALIDATION_ERROR",
    });

    await app.close();
  });

  it("rejects unknown modules", async () => {
    const app = await buildApp({
      config,
      readyCheck: vi.fn(),
      trackEvent: vi.fn(),
      logger: false,
    });

    const response = await app.inject({
      method: "POST",
      url: "/events/track",
      payload: {
        anonymousId: "anon-123",
        module: "unknown_module",
        eventName: "module_opened",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toMatchObject({
      code: "VALIDATION_ERROR",
    });

    await app.close();
  });

  it("rejects oversized metadata", async () => {
    const app = await buildApp({
      config: {
        ...config,
        eventMetadataMaxBytes: 24,
      },
      readyCheck: vi.fn(),
      trackEvent: vi.fn(),
      logger: false,
    });

    const response = await app.inject({
      method: "POST",
      url: "/events/track",
      payload: {
        anonymousId: "anon-oversized",
        module: "sislope",
        eventName: "module_opened",
        metadata: {
          value: "x".repeat(200),
        },
      },
    });

    expect(response.statusCode).toBe(413);
    expect(response.json().error).toMatchObject({
      code: "METADATA_TOO_LARGE",
    });

    await app.close();
  });

  it("enforces a basic event rate limit", async () => {
    const trackEvent = vi.fn(async (input: TrackEventInput) => ({
      id: randomUUID(),
      module: input.module,
      eventName: input.eventName,
      createdAt: "2026-05-04T00:00:00.000Z",
    }));
    const app = await buildApp({
      config: {
        ...config,
        eventRateLimitMax: 1,
        eventRateLimitWindowMs: 60_000,
      },
      readyCheck: vi.fn(),
      trackEvent,
      logger: false,
    });

    const payload = {
      anonymousId: "anon-rate-limited",
      module: "sislope",
      eventName: "module_opened",
    };

    const first = await app.inject({
      method: "POST",
      url: "/events/track",
      payload,
    });
    const second = await app.inject({
      method: "POST",
      url: "/events/track",
      payload,
    });

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(429);
    expect(second.json().error).toMatchObject({
      code: "EVENT_RATE_LIMITED",
    });

    await app.close();
  });

  it("returns a uniform error when ready check fails", async () => {
    const app = await buildApp({
      config,
      readyCheck: vi.fn().mockRejectedValue(new Error("db down")),
      trackEvent: vi.fn(),
      logger: false,
    });

    const response = await app.inject({
      method: "GET",
      url: "/ready",
      headers: {
        "x-request-id": "test-request-id",
      },
    });

    expect(response.statusCode).toBe(503);
    expect(response.headers["x-request-id"]).toBe("test-request-id");
    expect(response.json().error).toMatchObject({
      code: "DATABASE_UNAVAILABLE",
      requestId: "test-request-id",
    });

    await app.close();
  });

  it("rejects bodies above the configured request limit", async () => {
    const app = await buildApp({
      config: {
        ...config,
        requestBodyLimitBytes: 128,
      },
      readyCheck: vi.fn(),
      trackEvent: vi.fn(),
      logger: false,
    });

    const response = await app.inject({
      method: "POST",
      url: "/events/track",
      payload: {
        anonymousId: "anon-body-limit",
        module: "sislope",
        eventName: "module_opened",
        metadata: {
          value: "x".repeat(500),
        },
      },
    });

    expect(response.statusCode).toBe(413);
    expect(response.json().error).toMatchObject({
      code: "PAYLOAD_TOO_LARGE",
    });

    await app.close();
  });

  it("allows admins to access metrics overview", async () => {
    const adminService = createAdminService();
    const app = await buildApp({
      config,
      readyCheck: vi.fn(),
      trackEvent: vi.fn(),
      authService: createAdminAuthService(),
      adminService,
      logger: false,
    });

    const response = await app.inject({
      method: "GET",
      url: "/admin/metrics/overview",
      headers: {
        authorization: "Bearer admin-token",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      total_users: 2,
      top_module_by_events: "adex_palletizer",
    });
    expect(adminService.getOverview).toHaveBeenCalledOnce();

    await app.close();
  });

  it("allows admins to run manual metrics aggregation for a small range", async () => {
    const adminService = createAdminService();
    const app = await buildApp({
      config,
      readyCheck: vi.fn(),
      trackEvent: vi.fn(),
      authService: createAdminAuthService(),
      adminService,
      logger: false,
    });

    const response = await app.inject({
      method: "POST",
      url: "/admin/metrics/aggregate",
      headers: {
        authorization: "Bearer admin-token",
      },
      payload: {
        from: "2026-05-01",
        to: "2026-05-04",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      from: "2026-05-01",
      to: "2026-05-04",
      events_read: 3,
    });
    expect(adminService.aggregateMetrics).toHaveBeenCalledWith({
      from: "2026-05-01",
      to: "2026-05-04",
    });

    await app.close();
  });

  it("rejects normal users from manual metrics aggregation", async () => {
    const app = await buildApp({
      config,
      readyCheck: vi.fn(),
      trackEvent: vi.fn(),
      authService: createAuthService(),
      adminService: createAdminService(),
      logger: false,
    });

    const response = await app.inject({
      method: "POST",
      url: "/admin/metrics/aggregate",
      headers: {
        authorization: "Bearer valid-token",
      },
      payload: {
        from: "2026-05-01",
        to: "2026-05-04",
      },
    });

    expect(response.statusCode).toBe(403);

    await app.close();
  });

  it("rejects manual metrics aggregation ranges above the limit", async () => {
    const app = await buildApp({
      config,
      readyCheck: vi.fn(),
      trackEvent: vi.fn(),
      authService: createAdminAuthService(),
      adminService: createAdminService(),
      logger: false,
    });

    const response = await app.inject({
      method: "POST",
      url: "/admin/metrics/aggregate",
      headers: {
        authorization: "Bearer admin-token",
        "x-request-id": "aggregate-range-request",
      },
      payload: {
        from: "2026-05-01",
        to: "2026-06-15",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toMatchObject({
      code: "VALIDATION_ERROR",
      requestId: "aggregate-range-request",
    });

    await app.close();
  });

  it("rejects normal users from admin endpoints", async () => {
    const app = await buildApp({
      config,
      readyCheck: vi.fn(),
      trackEvent: vi.fn(),
      authService: createAuthService(),
      adminService: createAdminService(),
      logger: false,
    });

    const response = await app.inject({
      method: "GET",
      url: "/admin/metrics/overview",
      headers: {
        authorization: "Bearer valid-token",
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error).toMatchObject({
      code: "FORBIDDEN",
    });

    await app.close();
  });

  it("requires bearer tokens for admin endpoints", async () => {
    const app = await buildApp({
      config,
      readyCheck: vi.fn(),
      trackEvent: vi.fn(),
      authService: createAdminAuthService(),
      adminService: createAdminService(),
      logger: false,
    });

    const response = await app.inject({
      method: "GET",
      url: "/admin/metrics/overview",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error).toMatchObject({
      code: "UNAUTHENTICATED",
    });

    await app.close();
  });

  it("does not expose password hashes from /admin/users", async () => {
    const app = await buildApp({
      config,
      readyCheck: vi.fn(),
      trackEvent: vi.fn(),
      authService: createAdminAuthService(),
      adminService: createAdminService(),
      logger: false,
    });

    const response = await app.inject({
      method: "GET",
      url: "/admin/users",
      headers: {
        authorization: "Bearer admin-token",
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(JSON.stringify(body)).not.toContain("password_hash");
    expect(JSON.stringify(body)).not.toContain("refresh");
    expect(body.users[0]).toMatchObject({
      email: adminUser.email,
      role: "admin",
    });

    await app.close();
  });

  it("passes pagination to /admin/events", async () => {
    const adminService = createAdminService();
    const app = await buildApp({
      config,
      readyCheck: vi.fn(),
      trackEvent: vi.fn(),
      authService: createAdminAuthService(),
      adminService,
      logger: false,
    });

    const response = await app.inject({
      method: "GET",
      url: "/admin/events?limit=10&offset=5",
      headers: {
        authorization: "Bearer admin-token",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      limit: 10,
      offset: 5,
    });
    expect(adminService.listEvents).toHaveBeenCalledWith(expect.objectContaining({
      limit: 10,
      offset: 5,
    }));

    await app.close();
  });

  it("filters /admin/events by module and event_name", async () => {
    const adminService = createAdminService();
    const app = await buildApp({
      config,
      readyCheck: vi.fn(),
      trackEvent: vi.fn(),
      authService: createAdminAuthService(),
      adminService,
      logger: false,
    });

    const response = await app.inject({
      method: "GET",
      url: "/admin/events?module=adex_palletizer&event_name=module_opened",
      headers: {
        authorization: "Bearer admin-token",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(adminService.listEvents).toHaveBeenCalledWith(expect.objectContaining({
      module: "adex_palletizer",
      event_name: "module_opened",
    }));

    await app.close();
  });

  it("returns grouped module usage", async () => {
    const app = await buildApp({
      config,
      readyCheck: vi.fn(),
      trackEvent: vi.fn(),
      authService: createAdminAuthService(),
      adminService: createAdminService(),
      logger: false,
    });

    const response = await app.inject({
      method: "GET",
      url: "/admin/modules/usage",
      headers: {
        authorization: "Bearer admin-token",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().modules[0]).toMatchObject({
      module_code: "adex_palletizer",
      events_count: 3,
    });

    await app.close();
  });

  it("returns retention metrics even without data", async () => {
    const app = await buildApp({
      config,
      readyCheck: vi.fn(),
      trackEvent: vi.fn(),
      authService: createAdminAuthService(),
      adminService: createAdminService(),
      logger: false,
    });

    const response = await app.inject({
      method: "GET",
      url: "/admin/retention",
      headers: {
        authorization: "Bearer admin-token",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      new_users_7d: 0,
      stickiness_7d_30d: 0,
    });

    await app.close();
  });

  it("returns an empty errors list when no api_error events exist", async () => {
    const app = await buildApp({
      config,
      readyCheck: vi.fn(),
      trackEvent: vi.fn(),
      authService: createAdminAuthService(),
      adminService: createAdminService(),
      logger: false,
    });

    const response = await app.inject({
      method: "GET",
      url: "/admin/errors",
      headers: {
        authorization: "Bearer admin-token",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      errors: [],
    });

    await app.close();
  });

  it("rejects invalid admin filters with request_id", async () => {
    const app = await buildApp({
      config,
      readyCheck: vi.fn(),
      trackEvent: vi.fn(),
      authService: createAdminAuthService(),
      adminService: createAdminService(),
      logger: false,
    });

    const response = await app.inject({
      method: "GET",
      url: "/admin/events?limit=1000&module=unknown_admin_module",
      headers: {
        authorization: "Bearer admin-token",
        "x-request-id": "admin-filter-request",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toMatchObject({
      code: "VALIDATION_ERROR",
      requestId: "admin-filter-request",
    });

    await app.close();
  });

  it("returns uniform not found errors", async () => {
    const app = await buildApp({
      config,
      readyCheck: vi.fn(),
      trackEvent: vi.fn(),
      logger: false,
    });

    const response = await app.inject({
      method: "GET",
      url: "/missing",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error).toMatchObject({
      code: "NOT_FOUND",
    });

    await app.close();
  });
});
