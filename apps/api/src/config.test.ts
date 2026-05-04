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
    expect(config.authCookieName).toBe("data_trade_refresh_token");
    expect(config.requestBodyLimitBytes).toBe(64 * 1024);
    expect(config.eventMetadataMaxBytes).toBe(8 * 1024);
  });

  it("requires IP_HASH_SECRET in production", () => {
    expect(() =>
      loadConfig({
        ...baseEnv,
        NODE_ENV: "production",
      }),
    ).toThrow();
  });
});
