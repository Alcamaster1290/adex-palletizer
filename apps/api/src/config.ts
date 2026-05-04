import "dotenv/config";
import { z } from "zod";

const DEFAULT_PORT = 8788;
const DEFAULT_HOST = "0.0.0.0";
const DEFAULT_SESSION_TTL_DAYS = 30;
const DEFAULT_COOKIE_NAME = "data_trade_refresh_token";
const DEFAULT_REQUEST_BODY_LIMIT_BYTES = 64 * 1024;
const DEFAULT_EVENT_METADATA_MAX_BYTES = 8 * 1024;
const DEFAULT_EVENT_RATE_LIMIT_MAX = 120;
const DEFAULT_EVENT_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_AUTH_ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const DEFAULT_AUTH_RATE_LIMIT_MAX = 10;
const DEFAULT_AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60_000;

function parseOrigins(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

const booleanFlag = z
  .union([z.boolean(), z.string().trim().toLowerCase()])
  .optional()
  .transform((value) => value === true || value === "true" || value === "1");

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    HOST: z.string().trim().default(DEFAULT_HOST),
    PORT: z.coerce.number().int().positive().default(DEFAULT_PORT),
    DATABASE_URL: z.string().trim().min(1, "DATABASE_URL is required"),
    FRONTEND_ORIGINS: z.string().trim().default("http://localhost:5173"),
    AUTH_COOKIE_NAME: z.string().trim().default(DEFAULT_COOKIE_NAME),
    AUTH_COOKIE_DOMAIN: z.string().trim().optional(),
    AUTH_COOKIE_SECURE: booleanFlag,
    SESSION_TTL_DAYS: z.coerce.number().int().positive().default(DEFAULT_SESSION_TTL_DAYS),
    IP_HASH_SECRET: z.string().trim().optional(),
    AUTH_ACCESS_TOKEN_SECRET: z.string().trim().optional(),
    AUTH_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(DEFAULT_AUTH_ACCESS_TOKEN_TTL_SECONDS),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(DEFAULT_AUTH_RATE_LIMIT_MAX),
    AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(DEFAULT_AUTH_RATE_LIMIT_WINDOW_MS),
    DATA_TRADE_ADMIN_EMAIL: z.string().trim().email().optional(),
    DATA_TRADE_ADMIN_PASSWORD: z.string().optional(),
    DATA_TRADE_ADMIN_NAME: z.string().trim().optional(),
    REQUEST_BODY_LIMIT_BYTES: z.coerce.number().int().positive().default(DEFAULT_REQUEST_BODY_LIMIT_BYTES),
    EVENT_METADATA_MAX_BYTES: z.coerce.number().int().positive().default(DEFAULT_EVENT_METADATA_MAX_BYTES),
    EVENT_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(DEFAULT_EVENT_RATE_LIMIT_MAX),
    EVENT_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(DEFAULT_EVENT_RATE_LIMIT_WINDOW_MS),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "production" && !env.IP_HASH_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["IP_HASH_SECRET"],
        message: "IP_HASH_SECRET is required in production",
      });
    }
    if (env.NODE_ENV === "production" && !env.AUTH_ACCESS_TOKEN_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["AUTH_ACCESS_TOKEN_SECRET"],
        message: "AUTH_ACCESS_TOKEN_SECRET is required in production",
      });
    }
    if (env.DATA_TRADE_ADMIN_EMAIL && !env.DATA_TRADE_ADMIN_PASSWORD) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["DATA_TRADE_ADMIN_PASSWORD"],
        message: "DATA_TRADE_ADMIN_PASSWORD is required when DATA_TRADE_ADMIN_EMAIL is set",
      });
    }
  });

export interface AppConfig {
  nodeEnv: "development" | "test" | "production";
  host: string;
  port: number;
  databaseUrl: string;
  frontendOrigins: string[];
  authCookieName: string;
  authCookieDomain: string | null;
  authCookieSecure: boolean;
  sessionTtlDays: number;
  authAccessTokenSecret: string;
  authAccessTokenTtlSeconds: number;
  authRateLimitMax: number;
  authRateLimitWindowMs: number;
  ipHashSecret: string;
  dataTradeAdminEmail: string | null;
  dataTradeAdminPassword: string | null;
  dataTradeAdminName: string | null;
  requestBodyLimitBytes: number;
  eventMetadataMaxBytes: number;
  eventRateLimitMax: number;
  eventRateLimitWindowMs: number;
  logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace";
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.parse(source);
  const isVercelRuntime = source.VERCEL === "1" || Boolean(source.VERCEL_URL);

  return {
    nodeEnv: parsed.NODE_ENV,
    host: parsed.HOST,
    port: parsed.PORT,
    databaseUrl: parsed.DATABASE_URL,
    frontendOrigins: parseOrigins(parsed.FRONTEND_ORIGINS),
    authCookieName: parsed.AUTH_COOKIE_NAME,
    authCookieDomain: parsed.AUTH_COOKIE_DOMAIN || null,
    authCookieSecure: parsed.AUTH_COOKIE_SECURE || isVercelRuntime || parsed.NODE_ENV === "production",
    sessionTtlDays: parsed.SESSION_TTL_DAYS,
    authAccessTokenSecret: parsed.AUTH_ACCESS_TOKEN_SECRET || "data-trade-development-access-token-secret",
    authAccessTokenTtlSeconds: parsed.AUTH_ACCESS_TOKEN_TTL_SECONDS,
    authRateLimitMax: parsed.AUTH_RATE_LIMIT_MAX,
    authRateLimitWindowMs: parsed.AUTH_RATE_LIMIT_WINDOW_MS,
    ipHashSecret: parsed.IP_HASH_SECRET || "data-trade-development-ip-hash-secret",
    dataTradeAdminEmail: parsed.DATA_TRADE_ADMIN_EMAIL || null,
    dataTradeAdminPassword: parsed.DATA_TRADE_ADMIN_PASSWORD || null,
    dataTradeAdminName: parsed.DATA_TRADE_ADMIN_NAME || null,
    requestBodyLimitBytes: parsed.REQUEST_BODY_LIMIT_BYTES,
    eventMetadataMaxBytes: parsed.EVENT_METADATA_MAX_BYTES,
    eventRateLimitMax: parsed.EVENT_RATE_LIMIT_MAX,
    eventRateLimitWindowMs: parsed.EVENT_RATE_LIMIT_WINDOW_MS,
    logLevel: parsed.LOG_LEVEL,
  };
}
