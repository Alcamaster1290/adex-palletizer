import { randomUUID } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { buildApp } from "./app.js";
import { AuthError, type AuthResponse, type AuthService, type AuthSessionPayload } from "./auth.js";
import type { AppConfig } from "./config.js";
import type { TrackEventInput } from "./events.js";

const config: AppConfig = {
  nodeEnv: "test",
  host: "127.0.0.1",
  port: 0,
  databaseUrl: "postgres://postgres:postgres@localhost:5432/data_trade",
  frontendOrigins: ["http://localhost:5173"],
  authCookieName: "data_trade_refresh_token",
  authCookieDomain: null,
  authCookieSecure: false,
  sessionTtlDays: 30,
  authAccessTokenSecret: "test-access-token-secret",
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
