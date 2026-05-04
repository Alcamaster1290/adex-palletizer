import { randomUUID } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { buildApp } from "./app.js";
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
  ipHashSecret: "test-secret",
  adminBootstrapEmail: null,
  adminBootstrapPasswordHash: null,
  requestBodyLimitBytes: 64 * 1024,
  eventMetadataMaxBytes: 8 * 1024,
  eventRateLimitMax: 120,
  eventRateLimitWindowMs: 60_000,
  logLevel: "fatal",
};

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

  it("tracks authenticated events by userId", async () => {
    const userId = randomUUID();
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
      payload: {
        userId,
        module: "adex_palletizer",
        eventName: "palletizer_calculation_created",
        metadata: {
          mode: "container",
        },
      },
    });

    expect(response.statusCode).toBe(201);
    expect(trackEvent.mock.calls[0]?.[0].userId).toBe(userId);

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
