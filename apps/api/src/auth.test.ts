import { describe, expect, it } from "vitest";

import type { AppConfig } from "./config.js";
import {
  createAccessToken,
  hashPassword,
  hashRefreshToken,
  verifyAccessToken,
  verifyPassword,
} from "./auth.js";

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

describe("auth utilities", () => {
  it("hashes passwords without storing the plain value", async () => {
    const password = "ValidPassword123";
    const hash = await hashPassword(password);

    expect(hash).not.toBe(password);
    expect(hash).not.toContain(password);
    await expect(verifyPassword(password, hash)).resolves.toBe(true);
    await expect(verifyPassword("WrongPassword123", hash)).resolves.toBe(false);
  }, 15_000);

  it("hashes refresh tokens without exposing the raw token", () => {
    const raw = "refresh-token-value-that-is-long-enough";
    const hash = hashRefreshToken(raw, config.authRefreshTokenSecret);

    expect(hash).toHaveLength(64);
    expect(hash).not.toContain(raw);
  });

  it("uses the refresh token secret when hashing refresh tokens", () => {
    const raw = "refresh-token-value-that-is-long-enough";

    expect(hashRefreshToken(raw, "refresh-secret-one-abcdefghijklmnopqrstuvwxyz")).not.toBe(
      hashRefreshToken(raw, "refresh-secret-two-abcdefghijklmnopqrstuvwxyz"),
    );
  });

  it("creates and verifies access tokens", () => {
    const user = {
      id: "11111111-1111-4111-8111-111111111111",
      email: "user@datatrade.local",
    };
    const sessionId = "22222222-2222-4222-8222-222222222222";
    const { token } = createAccessToken(user, sessionId, config);
    const payload = verifyAccessToken(token, config.authAccessTokenSecret);

    expect(payload).toMatchObject({
      sub: user.id,
      sid: sessionId,
      email: user.email,
    });
  });

  it("rejects tampered access tokens", () => {
    const user = {
      id: "11111111-1111-4111-8111-111111111111",
      email: "user@datatrade.local",
    };
    const { token } = createAccessToken(user, "22222222-2222-4222-8222-222222222222", config);
    const tampered = `${token.slice(0, -2)}xx`;

    expect(verifyAccessToken(tampered, config.authAccessTokenSecret)).toBeNull();
  });

  it("rejects expired access tokens", () => {
    const user = {
      id: "11111111-1111-4111-8111-111111111111",
      email: "user@datatrade.local",
    };
    const expiredConfig = {
      ...config,
      authAccessTokenTtlSeconds: -1,
    };
    const { token } = createAccessToken(user, "22222222-2222-4222-8222-222222222222", expiredConfig);

    expect(verifyAccessToken(token, config.authAccessTokenSecret)).toBeNull();
  });
});
