import cors from "@fastify/cors";
import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { ZodError } from "zod";

import {
  adminEventsQuerySchema,
  adminUserActivityParamsSchema,
  adminUsersQuerySchema,
  createAdminService,
  type AdminService,
} from "./admin.js";
import {
  AuthError,
  createAuthService,
  getBearerToken,
  handoffCreateBodySchema,
  handoffExchangeBodySchema,
  loginBodySchema,
  logoutBodySchema,
  refreshBodySchema,
  registerBodySchema,
  type AuthRequestContext,
  type AuthService,
} from "./auth.js";
import type { AppConfig } from "./config.js";
import type { DataTradeDatabase } from "./db/client.js";
import { buildErrorBody } from "./errors.js";
import {
  createEventTracker,
  getJsonByteLength,
  hashIpAddress,
  containsReservedIdentityMetadata,
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
  authService?: AuthService;
  adminService?: AdminService;
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
  const authRateLimiter = createInMemoryRateLimiter({
    max: config.authRateLimitMax,
    windowMs: config.authRateLimitWindowMs,
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

    if (error instanceof AuthError) {
      return reply.status(error.statusCode).send(buildErrorBody(
        error.code,
        error.message,
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
  const authService = options.authService ?? (db ? createAuthService(db, config) : null);
  const adminService = options.adminService ?? (db ? createAdminService(db) : null);

  function buildAuthContext(request: { headers: Record<string, unknown>; ip: string }): AuthRequestContext {
    const rawIp = getRequestIp(request);
    const userAgent = request.headers["user-agent"];

    return {
      ipHash: hashIpAddress(rawIp, config.ipHashSecret),
      userAgent: typeof userAgent === "string" ? userAgent : null,
    };
  }

  function checkAuthRateLimit(
    key: string,
    requestId: string,
    reply: { status: (statusCode: number) => { send: (payload: unknown) => unknown } },
  ) {
    const rateLimit = authRateLimiter(key);
    if (!rateLimit.allowed) {
      return reply.status(429).send(buildErrorBody(
        "AUTH_RATE_LIMITED",
        "Too many authentication requests.",
        requestId,
      ));
    }

    return null;
  }

  async function requireAuthSession(request: { headers: Record<string, unknown> }) {
    if (!authService) {
      throw new AuthError("AUTH_UNAVAILABLE", 503, "Authentication service is not available.");
    }

    const token = getBearerToken(request.headers.authorization as string | string[] | undefined);
    if (!token) {
      throw new AuthError("UNAUTHENTICATED", 401);
    }

    return authService.getSession(token);
  }

  async function requireAdminSession(request: { headers: Record<string, unknown> }) {
    const session = await requireAuthSession(request);
    if (!session.user.roles.includes("admin")) {
      throw new AuthError("FORBIDDEN", 403, "Admin role is required.");
    }

    return session;
  }

  app.get("/health", async () => ({
    status: "ok",
    service: "data-trade-api",
    version: "0.1.0",
  }));

  app.get("/ready", async (_request, reply) => {
    try {
      await readyCheck();
    } catch (err) {
      // Bypass pino formatting to surface the full error in Railway logs.
      // eslint-disable-next-line no-console
      console.error("[ready-check failed]", err);
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

  app.post("/auth/register", async (request, reply) => {
    if (!authService) {
      return reply.status(503).send(buildErrorBody(
        "AUTH_UNAVAILABLE",
        "Authentication service is not available.",
        request.dataTradeRequestId,
      ));
    }

    const payload = registerBodySchema.parse(request.body);
    const rateLimited = checkAuthRateLimit(
      `auth:register:${payload.email.toLowerCase()}:${buildAuthContext(request).ipHash ?? "unknown"}`,
      request.dataTradeRequestId,
      reply,
    );
    if (rateLimited) {
      return rateLimited;
    }

    const auth = await authService.register(payload, buildAuthContext(request));
    return reply.status(201).send(auth);
  });

  app.post("/auth/login", async (request, reply) => {
    if (!authService) {
      return reply.status(503).send(buildErrorBody(
        "AUTH_UNAVAILABLE",
        "Authentication service is not available.",
        request.dataTradeRequestId,
      ));
    }

    const payload = loginBodySchema.parse(request.body);
    const identifier = (payload.email ?? payload.identifier ?? "unknown").toLowerCase();
    const rateLimited = checkAuthRateLimit(
      `auth:login:${identifier}:${buildAuthContext(request).ipHash ?? "unknown"}`,
      request.dataTradeRequestId,
      reply,
    );
    if (rateLimited) {
      return rateLimited;
    }

    return reply.send(await authService.login(payload, buildAuthContext(request)));
  });

  app.post("/auth/refresh", async (request, reply) => {
    if (!authService) {
      return reply.status(503).send(buildErrorBody(
        "AUTH_UNAVAILABLE",
        "Authentication service is not available.",
        request.dataTradeRequestId,
      ));
    }

    const payload = refreshBodySchema.parse(request.body);
    const rateLimited = checkAuthRateLimit(
      `auth:refresh:${buildAuthContext(request).ipHash ?? "unknown"}`,
      request.dataTradeRequestId,
      reply,
    );
    if (rateLimited) {
      return rateLimited;
    }

    return reply.send(await authService.refresh(payload, buildAuthContext(request)));
  });

  app.post("/auth/logout", async (request, reply) => {
    if (!authService) {
      return reply.status(503).send(buildErrorBody(
        "AUTH_UNAVAILABLE",
        "Authentication service is not available.",
        request.dataTradeRequestId,
      ));
    }

    const payload = logoutBodySchema.parse(request.body ?? {});
    const token = getBearerToken(request.headers.authorization);
    await authService.logout(payload, buildAuthContext(request), token);
    return reply.status(204).send();
  });

  app.post("/auth/handoff/create", async (request, reply) => {
    if (!authService) {
      return reply.status(503).send(buildErrorBody(
        "AUTH_UNAVAILABLE",
        "Authentication service is not available.",
        request.dataTradeRequestId,
      ));
    }

    const token = getBearerToken(request.headers.authorization);
    if (!token) {
      throw new AuthError("UNAUTHENTICATED", 401);
    }

    const payload = handoffCreateBodySchema.parse(request.body);
    const rateLimited = checkAuthRateLimit(
      `auth:handoff:create:${buildAuthContext(request).ipHash ?? "unknown"}`,
      request.dataTradeRequestId,
      reply,
    );
    if (rateLimited) {
      return rateLimited;
    }

    return reply
      .status(200)
      .send(await authService.createHandoff(token, payload, buildAuthContext(request)));
  });

  app.post("/auth/handoff/exchange", async (request, reply) => {
    if (!authService) {
      return reply.status(503).send(buildErrorBody(
        "AUTH_UNAVAILABLE",
        "Authentication service is not available.",
        request.dataTradeRequestId,
      ));
    }

    const payload = handoffExchangeBodySchema.parse(request.body);
    const rateLimited = checkAuthRateLimit(
      `auth:handoff:exchange:${buildAuthContext(request).ipHash ?? "unknown"}`,
      request.dataTradeRequestId,
      reply,
    );
    if (rateLimited) {
      return rateLimited;
    }

    return reply.send(await authService.exchangeHandoff(payload, buildAuthContext(request)));
  });

  app.get("/auth/me", async (request, reply) => {
    const session = await requireAuthSession(request);
    return reply.send(session);
  });

  app.get("/auth/session", async (request, reply) => {
    const session = await requireAuthSession(request);
    return reply.send({
      session: session.session,
      user: session.user,
    });
  });

  app.get("/auth/modules", async (request, reply) => {
    if (!authService) {
      return reply.status(503).send(buildErrorBody(
        "AUTH_UNAVAILABLE",
        "Authentication service is not available.",
        request.dataTradeRequestId,
      ));
    }

    const token = getBearerToken(request.headers.authorization);
    if (!token) {
      throw new AuthError("UNAUTHENTICATED", 401);
    }

    return reply.send({
      modules: await authService.getModules(token),
    });
  });

  app.get("/admin/metrics/overview", async (request, reply) => {
    await requireAdminSession(request);
    if (!adminService) {
      return reply.status(503).send(buildErrorBody(
        "ADMIN_UNAVAILABLE",
        "Admin metrics service is not available.",
        request.dataTradeRequestId,
      ));
    }

    return reply.send(await adminService.getOverview());
  });

  app.get("/admin/users", async (request, reply) => {
    await requireAdminSession(request);
    if (!adminService) {
      return reply.status(503).send(buildErrorBody(
        "ADMIN_UNAVAILABLE",
        "Admin users service is not available.",
        request.dataTradeRequestId,
      ));
    }

    const query = adminUsersQuerySchema.parse(request.query ?? {});
    return reply.send(await adminService.listUsers(query));
  });

  app.get("/admin/users/:id/activity", async (request, reply) => {
    await requireAdminSession(request);
    if (!adminService) {
      return reply.status(503).send(buildErrorBody(
        "ADMIN_UNAVAILABLE",
        "Admin user activity service is not available.",
        request.dataTradeRequestId,
      ));
    }

    const params = adminUserActivityParamsSchema.parse(request.params);
    return reply.send(await adminService.getUserActivity(params));
  });

  app.get("/admin/events", async (request, reply) => {
    await requireAdminSession(request);
    if (!adminService) {
      return reply.status(503).send(buildErrorBody(
        "ADMIN_UNAVAILABLE",
        "Admin events service is not available.",
        request.dataTradeRequestId,
      ));
    }

    const query = adminEventsQuerySchema.parse(request.query ?? {});
    return reply.send(await adminService.listEvents(query));
  });

  app.get("/admin/modules/usage", async (request, reply) => {
    await requireAdminSession(request);
    if (!adminService) {
      return reply.status(503).send(buildErrorBody(
        "ADMIN_UNAVAILABLE",
        "Admin module usage service is not available.",
        request.dataTradeRequestId,
      ));
    }

    return reply.send(await adminService.getModulesUsage());
  });

  app.get("/admin/retention", async (request, reply) => {
    await requireAdminSession(request);
    if (!adminService) {
      return reply.status(503).send(buildErrorBody(
        "ADMIN_UNAVAILABLE",
        "Admin retention service is not available.",
        request.dataTradeRequestId,
      ));
    }

    return reply.send(await adminService.getRetention());
  });

  app.get("/admin/errors", async (request, reply) => {
    await requireAdminSession(request);
    if (!adminService) {
      return reply.status(503).send(buildErrorBody(
        "ADMIN_UNAVAILABLE",
        "Admin error metrics service is not available.",
        request.dataTradeRequestId,
      ));
    }

    return reply.send(await adminService.getErrors());
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
    if (containsReservedIdentityMetadata(payload.metadata)) {
      return reply.status(400).send(buildErrorBody(
        "RESERVED_METADATA_FIELD",
        "Event metadata cannot include user identity fields.",
        request.dataTradeRequestId,
      ));
    }

    const token = getBearerToken(request.headers.authorization);
    const authSession = token && authService ? await authService.getSession(token) : null;
    if (!authSession && payload.userId) {
      return reply.status(401).send(buildErrorBody(
        "UNAUTHENTICATED",
        "A valid bearer token is required to associate user_id with an event.",
        request.dataTradeRequestId,
      ));
    }
    if (!authSession && !payload.anonymousId) {
      return reply.status(400).send(buildErrorBody(
        "VALIDATION_ERROR",
        "anonymousId is required when no bearer token is provided.",
        request.dataTradeRequestId,
      ));
    }

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
    const rateLimitKey = payload.anonymousId ?? authSession?.user.id ?? ipHash ?? "unknown";
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
      userId: authSession?.user.id ?? payload.userId,
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
