import cors from "@fastify/cors";
import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { ZodError } from "zod";

import type { AppConfig } from "./config.js";
import type { DataTradeDatabase } from "./db/client.js";
import { buildErrorBody } from "./errors.js";
import {
  createEventTracker,
  getJsonByteLength,
  hashIpAddress,
  sanitizeMetadata,
  trackEventBodySchema,
  type TrackEventInput,
  type TrackedEvent,
} from "./events.js";
import { createInMemoryRateLimiter } from "./rateLimit.js";

declare module "fastify" {
  interface FastifyRequest {
    dataTradeRequestId: string;
  }
}

interface BuildAppOptions {
  config: AppConfig;
  db?: DataTradeDatabase;
  readyCheck?: () => Promise<void>;
  trackEvent?: (input: TrackEventInput) => Promise<TrackedEvent>;
  logger?: boolean;
}

function getRequestIp(request: { ip: string; headers: Record<string, unknown> }): string | null {
  const forwardedFor = request.headers["x-forwarded-for"];
  const forwarded = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0]?.trim() || null;
  }

  return request.ip || null;
}

function isOriginAllowed(origin: string | undefined, allowedOrigins: string[]): boolean {
  if (!origin) {
    return true;
  }

  return allowedOrigins.includes("*") || allowedOrigins.includes(origin);
}

function getIncomingRequestId(headerValue: string | string[] | undefined): string {
  const raw = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  const normalized = raw?.trim();
  if (normalized && normalized.length <= 128) {
    return normalized;
  }

  return randomUUID();
}

export async function buildApp(options: BuildAppOptions) {
  const { config, db } = options;
  const eventRateLimiter = createInMemoryRateLimiter({
    max: config.eventRateLimitMax,
    windowMs: config.eventRateLimitWindowMs,
  });
  const app = Fastify({
    bodyLimit: config.requestBodyLimitBytes,
    logger:
      options.logger === false
        ? false
        : {
            level: config.logLevel,
          },
    trustProxy: true,
  });

  await app.register(cors, {
    credentials: true,
    origin: (origin, callback) => {
      if (isOriginAllowed(origin, config.frontendOrigins)) {
        callback(null, true);
        return;
      }

      callback(new Error("ORIGIN_NOT_ALLOWED"), false);
    },
  });

  app.addHook("onRequest", (request, reply, done) => {
    request.dataTradeRequestId = getIncomingRequestId(request.headers["x-request-id"]);
    void reply.header("x-request-id", request.dataTradeRequestId);
    done();
  });

  app.addHook("onSend", (_request, reply, _payload, done) => {
    void reply.header("X-Content-Type-Options", "nosniff");
    void reply.header("X-Frame-Options", "DENY");
    void reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
    done();
  });

  app.setErrorHandler((error, request, reply) => {
    const requestId = request.dataTradeRequestId ?? randomUUID();
    const errorCode = error instanceof Error ? (error as Error & { code?: string }).code : undefined;
    const errorMessage = error instanceof Error ? error.message : "";

    if (error instanceof ZodError) {
      return reply.status(400).send(buildErrorBody(
        "VALIDATION_ERROR",
        "Request payload failed validation.",
        requestId,
      ));
    }

    if (errorCode === "FST_ERR_CTP_BODY_TOO_LARGE") {
      return reply.status(413).send(buildErrorBody(
        "PAYLOAD_TOO_LARGE",
        "Request body exceeds the configured size limit.",
        requestId,
      ));
    }

    if (errorMessage === "ORIGIN_NOT_ALLOWED") {
      return reply.status(403).send(buildErrorBody(
        "ORIGIN_NOT_ALLOWED",
        "Request origin is not allowed.",
        requestId,
      ));
    }

    app.log.error(error);
    return reply.status(500).send(buildErrorBody(
      "INTERNAL_SERVER_ERROR",
      "Unexpected internal server error.",
      requestId,
    ));
  });

  app.setNotFoundHandler((request, reply) => reply.status(404).send(buildErrorBody(
    "NOT_FOUND",
    "Route not found.",
    request.dataTradeRequestId,
  )));

  const readyCheck =
    options.readyCheck ??
    (async () => {
      if (!db) {
        throw new Error("Database is not configured");
      }
      await db.execute(sql`select 1`);
    });

  const trackEvent = options.trackEvent ?? (db ? createEventTracker(db) : null);

  app.get("/health", async () => ({
    status: "ok",
    service: "data-trade-api",
    version: "0.1.0",
  }));

  app.get("/ready", async (_request, reply) => {
    try {
      await readyCheck();
    } catch {
      return reply.status(503).send(buildErrorBody(
        "DATABASE_UNAVAILABLE",
        "Database readiness check failed.",
        _request.dataTradeRequestId,
      ));
    }

    return reply.send({
      status: "ok",
      service: "data-trade-api",
      database: "ok",
    });
  });

  app.post("/events/track", async (request, reply) => {
    if (!trackEvent) {
      return reply.status(503).send(buildErrorBody(
        "EVENT_TRACKING_UNAVAILABLE",
        "Event tracking is not available.",
        request.dataTradeRequestId,
      ));
    }

    const payload = trackEventBodySchema.parse(request.body);
    const metadata = sanitizeMetadata(payload.metadata);
    const metadataBytes = getJsonByteLength(metadata);
    if (metadataBytes > config.eventMetadataMaxBytes) {
      return reply.status(413).send(buildErrorBody(
        "METADATA_TOO_LARGE",
        "Event metadata exceeds the configured size limit.",
        request.dataTradeRequestId,
      ));
    }

    const rawIp = getRequestIp(request);
    const ipHash = hashIpAddress(rawIp, config.ipHashSecret);
    const userAgent = request.headers["user-agent"];
    const rateLimitKey = payload.anonymousId ?? ipHash ?? payload.userId ?? "unknown";
    const rateLimit = eventRateLimiter(`events:${rateLimitKey}`);

    void reply.header("x-ratelimit-limit", String(config.eventRateLimitMax));
    void reply.header("x-ratelimit-remaining", String(rateLimit.remaining));
    void reply.header("x-ratelimit-reset", new Date(rateLimit.resetAt).toISOString());

    if (!rateLimit.allowed) {
      return reply.status(429).send(buildErrorBody(
        "EVENT_RATE_LIMITED",
        "Too many event tracking requests.",
        request.dataTradeRequestId,
      ));
    }

    const event = await trackEvent({
      ...payload,
      metadata,
      userAgent: typeof userAgent === "string" ? userAgent : null,
      ipHash,
    });

    return reply.status(201).send({
      event,
    });
  });

  return app;
}
