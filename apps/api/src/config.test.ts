import { describe, expect, it } from "vitest";

import { loadConfig } from "./config.js";

const baseEnv = {
  NODE_ENV: "development",
  DATABASE_URL: "postgres://postgres:postgres@localhost:5432/data_trade",
};

describe("loadConfig", () => {
  it("parses frontend origins and defaults", () => {
    const config = loadConfig({
      ...baseEnv,
      FRONTEND_ORIGINS: "http://localhost:5173, https://app.datatrade.pe ",
      IP_HASH_SECRET: "test-secret",
    });

    expect(config.frontendOrigins).toEqual(["http://localhost:5173", "https://app.datatrade.pe"]);
    expect(config.port).toBe(8788);
    expect(config.appEnv).toBe("development");
    expect(config.authCookieName).toBe("data_trade_refresh_token");
    expect(config.authAccessTokenTtlSeconds).toBe(900);
    expect(config.requestBodyLimitBytes).toBe(64 * 1024);
    expect(config.eventMetadataMaxBytes).toBe(8 * 1024);
  });

  it("requires auth and IP secrets in production", () => {
    expect(() =>
      loadConfig({
        ...baseEnv,
        APP_ENV: "production",
      }),
    ).toThrow();
  });

  it("accepts strong production secrets", () => {
    const config = loadConfig({
      ...baseEnv,
      APP_ENV: "production",
      FRONTEND_ORIGINS: "https://app.datatrade.pe",
      IP_HASH_SECRET: "ip-secret-abcdefghijklmnopqrstuvwxyz123456",
      AUTH_ACCESS_TOKEN_SECRET: "access-secret-abcdefghijklmnopqrstuvwxyz123456",
      AUTH_REFRESH_TOKEN_SECRET: "refresh-secret-abcdefghijklmnopqrstuvwxyz123456",
    });

    expect(config.appEnv).toBe("production");
    expect(config.authCookieSecure).toBe(true);
  });

  it("rejects wildcard CORS origins because credentials are enabled", () => {
    expect(() =>
      loadConfig({
        ...baseEnv,
        FRONTEND_ORIGINS: "*",
      }),
    ).toThrow();
  });

  it("requires admin password when admin email is configured", () => {
    expect(() =>
      loadConfig({
        ...baseEnv,
        DATA_TRADE_ADMIN_EMAIL: "admin@datatrade.local",
      }),
    ).toThrow();
  });
});
