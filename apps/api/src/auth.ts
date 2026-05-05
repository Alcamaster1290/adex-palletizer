import bcrypt from "bcryptjs";
import { and, eq, gt, inArray, isNull } from "drizzle-orm";
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";

import type { AppConfig } from "./config.js";
import type { DataTradeDatabase } from "./db/client.js";
import {
  auditLogs,
  authAccounts,
  authSessions,
  modules,
  userModuleAccess,
  users,
} from "./db/schema.js";

const PASSWORD_HASH_ALGORITHM = "bcrypt";
const DEFAULT_USER_MODULES = ["sislope", "adex_palletizer", "data_trade_analytics"] as const;
const ADMIN_MODULES = ["sislope", "adex_palletizer", "data_trade_analytics", "admin", "api"] as const;

const passwordSchema = z.string().min(12).max(128);

export const registerBodySchema = z
  .object({
    email: z.string().trim().email().max(200),
    password: passwordSchema,
    displayName: z.string().trim().min(2).max(160).optional(),
    organizationName: z.string().trim().min(2).max(160).optional(),
  })
  .strict();

export const loginBodySchema = z
  .object({
    email: z.string().trim().email().max(200).optional(),
    identifier: z.string().trim().min(1).max(200).optional(),
    password: z.string().min(1).max(128),
  })
  .strict()
  .refine((value) => value.email || value.identifier, {
    message: "email or identifier is required",
    path: ["email"],
  });

export const refreshBodySchema = z
  .object({
    refreshToken: z.string().trim().min(32).max(512),
  })
  .strict();

export const logoutBodySchema = z
  .object({
    refreshToken: z.string().trim().min(32).max(512).optional(),
  })
  .strict()
  .default({});

export type RegisterInput = z.infer<typeof registerBodySchema>;
export type LoginInput = z.infer<typeof loginBodySchema>;
export type RefreshInput = z.infer<typeof refreshBodySchema>;
export type LogoutInput = z.infer<typeof logoutBodySchema>;

export interface AuthRequestContext {
  ipHash: string | null;
  userAgent: string | null;
}

export interface AuthUser {
  id: string;
  email: string;
  username: string | null;
  displayName: string | null;
  status: string;
  roles: string[];
}

export interface AuthSessionInfo {
  id: string;
  expiresAt: string;
}

export interface AuthTokenPayload {
  sub: string;
  sid: string;
  email: string;
  iat: number;
  exp: number;
}

export interface AuthSessionPayload {
  user: AuthUser;
  session: AuthSessionInfo;
}

export interface AuthResponse extends AuthSessionPayload {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  accessTokenExpiresAt: string;
}

export interface AuthModuleAccess {
  key: string;
  displayName: string;
  accessLevel: string;
}

export interface AdminSeedInput {
  email: string;
  password: string;
  displayName?: string | null;
}

export interface AdminSeedResult {
  created: boolean;
  userId: string;
  email: string;
}

export class AuthError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
    message = code,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export interface AuthService {
  register(input: RegisterInput, context: AuthRequestContext): Promise<AuthResponse>;
  login(input: LoginInput, context: AuthRequestContext): Promise<AuthResponse>;
  refresh(input: RefreshInput, context: AuthRequestContext): Promise<AuthResponse>;
  logout(input: LogoutInput, context: AuthRequestContext, accessToken?: string | null): Promise<void>;
  getSession(accessToken: string): Promise<AuthSessionPayload>;
  getModules(accessToken: string): Promise<AuthModuleAccess[]>;
  bootstrapAdmin(input: AdminSeedInput): Promise<AdminSeedResult>;
}

interface CredentialUserRow {
  id: string;
  email: string;
  username: string | null;
  displayName: string | null;
  status: string;
  passwordHash: string | null;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function generateUsername(email: string): string {
  const localPart = email.split("@")[0] ?? "user";
  const normalized = localPart
    .normalize("NFKD")
    .split("")
    .filter((character) => character.charCodeAt(0) <= 0x7f)
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 40);

  return `${normalized || "user"}-${randomUUID().slice(0, 8)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function addDaysIso(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function addSecondsEpoch(seconds: number): number {
  return Math.floor(Date.now() / 1000) + seconds;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export function generateRefreshToken(): string {
  return randomBytes(48).toString("base64url");
}

export function hashRefreshToken(rawToken: string, secret: string): string {
  return createHmac("sha256", secret).update(rawToken).digest("hex");
}

function encodeBase64Url(value: Buffer | string): string {
  return Buffer.from(value).toString("base64url");
}

function signTokenSegments(header: string, payload: string, secret: string): string {
  return createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
}

export function createAccessToken(
  user: Pick<AuthUser, "id" | "email">,
  sessionId: string,
  config: AppConfig,
): { token: string; expiresAt: string } {
  const iat = Math.floor(Date.now() / 1000);
  const exp = addSecondsEpoch(config.authAccessTokenTtlSeconds);
  const header = encodeBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = encodeBase64Url(JSON.stringify({
    sub: user.id,
    sid: sessionId,
    email: user.email,
    iat,
    exp,
  } satisfies AuthTokenPayload));
  const signature = signTokenSegments(header, payload, config.authAccessTokenSecret);

  return {
    token: `${header}.${payload}.${signature}`,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

export function verifyAccessToken(token: string, secret: string): AuthTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [header, payload, signature] = parts;
  if (!header || !payload || !signature) {
    return null;
  }

  const expected = signTokenSegments(header, payload, secret);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  const result = z
    .object({
      sub: z.string().uuid(),
      sid: z.string().uuid(),
      email: z.string().email(),
      iat: z.number().int(),
      exp: z.number().int(),
    })
    .safeParse(parsed);

  if (!result.success || result.data.exp <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  return result.data;
}

function toAuthUser(row: {
  id: string;
  email: string;
  username: string | null;
  displayName: string | null;
  status: string;
}, roles: string[]): AuthUser {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    displayName: row.displayName,
    status: row.status,
    roles,
  };
}

async function getUserRoles(db: DataTradeDatabase, userId: string): Promise<string[]> {
  const access = await db
    .select({
      moduleKey: modules.key,
      accessLevel: userModuleAccess.accessLevel,
    })
    .from(userModuleAccess)
    .innerJoin(modules, eq(modules.id, userModuleAccess.moduleId))
    .where(and(
      eq(userModuleAccess.userId, userId),
      isNull(userModuleAccess.revokedAt),
      eq(modules.status, "active"),
    ));

  const roles = new Set<string>(["user"]);
  for (const row of access) {
    if (row.moduleKey === "admin" && row.accessLevel === "admin") {
      roles.add("admin");
    }
    if (row.accessLevel === "manager") {
      roles.add("manager");
    }
  }

  return [...roles];
}

async function findCredentialUser(
  db: DataTradeDatabase,
  identifier: string,
): Promise<CredentialUserRow | null> {
  const normalized = normalizeEmail(identifier);
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      displayName: users.displayName,
      status: users.status,
      passwordHash: authAccounts.passwordHash,
    })
    .from(users)
    .innerJoin(authAccounts, and(
      eq(authAccounts.userId, users.id),
      eq(authAccounts.provider, "credentials"),
    ))
    .where(and(
      isNull(users.deletedAt),
      eq(authAccounts.providerAccountId, normalized),
    ))
    .limit(1);

  return rows[0] ?? null;
}

async function findUserByEmail(db: DataTradeDatabase, email: string) {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      displayName: users.displayName,
      status: users.status,
    })
    .from(users)
    .where(and(eq(users.email, normalizeEmail(email)), isNull(users.deletedAt)))
    .limit(1);

  return rows[0] ?? null;
}

async function writeAuditLog(
  db: DataTradeDatabase,
  input: {
    actorUserId?: string | null;
    action: string;
    entityType?: string | null;
    entityId?: string | null;
    severity?: "info" | "warning" | "critical";
    metadata?: Record<string, unknown>;
  },
) {
  await db.insert(auditLogs).values({
    actorUserId: input.actorUserId ?? null,
    action: input.action,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    severity: input.severity ?? "info",
    metadata: input.metadata ?? {},
  });
}

async function grantModuleAccess(
  db: DataTradeDatabase,
  userId: string,
  moduleKeys: readonly string[],
  accessLevel: "user" | "manager" | "admin",
) {
  const rows = await db
    .select({
      id: modules.id,
    })
    .from(modules)
    .where(inArray(modules.key, [...moduleKeys]));

  if (rows.length === 0) {
    return;
  }

  await db
    .insert(userModuleAccess)
    .values(rows.map((row) => ({
      userId,
      moduleId: row.id,
      accessLevel,
    })))
    .onConflictDoNothing();
}

async function createSessionResponse(
  db: DataTradeDatabase,
  config: AppConfig,
  user: AuthUser,
  context: AuthRequestContext,
): Promise<AuthResponse> {
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashRefreshToken(refreshToken, config.authRefreshTokenSecret);
  const sessionRows = await db
    .insert(authSessions)
    .values({
      userId: user.id,
      refreshTokenHash,
      sessionStatus: "active",
      createdByIpHash: context.ipHash,
      userAgent: context.userAgent,
      lastSeenAt: nowIso(),
      expiresAt: addDaysIso(config.sessionTtlDays),
    })
    .returning({
      id: authSessions.id,
      expiresAt: authSessions.expiresAt,
    });

  const session = sessionRows[0];
  if (!session) {
    throw new Error("AUTH_SESSION_INSERT_FAILED");
  }

  const accessToken = createAccessToken(user, session.id, config);

  return {
    user,
    session: {
      id: session.id,
      expiresAt: session.expiresAt,
    },
    accessToken: accessToken.token,
    refreshToken,
    tokenType: "Bearer",
    accessTokenExpiresAt: accessToken.expiresAt,
  };
}

export function createAuthService(db: DataTradeDatabase, config: AppConfig): AuthService {
  async function getSessionByPayload(payload: AuthTokenPayload): Promise<AuthSessionPayload> {
    const rows = await db
      .select({
        sessionId: authSessions.id,
        expiresAt: authSessions.expiresAt,
        userId: users.id,
        email: users.email,
        username: users.username,
        displayName: users.displayName,
        status: users.status,
      })
      .from(authSessions)
      .innerJoin(users, eq(users.id, authSessions.userId))
      .where(and(
        eq(authSessions.id, payload.sid),
        eq(authSessions.userId, payload.sub),
        eq(authSessions.sessionStatus, "active"),
        isNull(authSessions.revokedAt),
        gt(authSessions.expiresAt, nowIso()),
        isNull(users.deletedAt),
      ))
      .limit(1);

    const row = rows[0];
    if (!row || row.status !== "active") {
      throw new AuthError("UNAUTHENTICATED", 401);
    }

    await db
      .update(authSessions)
      .set({
        lastSeenAt: nowIso(),
        updatedAt: nowIso(),
      })
      .where(eq(authSessions.id, row.sessionId));

    const roles = await getUserRoles(db, row.userId);
    return {
      user: toAuthUser({
        id: row.userId,
        email: row.email,
        username: row.username,
        displayName: row.displayName,
        status: row.status,
      }, roles),
      session: {
        id: row.sessionId,
        expiresAt: row.expiresAt,
      },
    };
  }

  return {
    async register(input, context) {
      const email = normalizeEmail(input.email);
      const existing = await findUserByEmail(db, email);
      if (existing) {
        throw new AuthError("EMAIL_ALREADY_REGISTERED", 409);
      }

      const passwordHash = await hashPassword(input.password);
      const userRows = await db
        .insert(users)
        .values({
          email,
          username: generateUsername(email),
          displayName: input.displayName ?? null,
          passwordHash,
          passwordHashAlgorithm: PASSWORD_HASH_ALGORITHM,
          status: "active",
          metadata: {
            organizationName: input.organizationName ?? null,
            signupSource: "data_trade_api",
          },
        })
        .returning({
          id: users.id,
          email: users.email,
          username: users.username,
          displayName: users.displayName,
          status: users.status,
        });

      const userRow = userRows[0];
      if (!userRow) {
        throw new Error("USER_INSERT_FAILED");
      }

      await db.insert(authAccounts).values({
        userId: userRow.id,
        provider: "credentials",
        providerAccountId: email,
        passwordHash,
        passwordHashAlgorithm: PASSWORD_HASH_ALGORITHM,
        metadata: {},
      });
      await grantModuleAccess(db, userRow.id, DEFAULT_USER_MODULES, "user");
      await writeAuditLog(db, {
        actorUserId: userRow.id,
        action: "auth.user_registered",
        entityType: "user",
        entityId: userRow.id,
        metadata: {
          ipHash: context.ipHash,
          userAgent: context.userAgent,
        },
      });

      const roles = await getUserRoles(db, userRow.id);
      const user = toAuthUser(userRow, roles);
      return createSessionResponse(db, config, user, context);
    },

    async login(input, context) {
      const identifier = normalizeEmail(input.email ?? input.identifier ?? "");
      const row = await findCredentialUser(db, identifier);
      const invalid = new AuthError("INVALID_CREDENTIALS", 401);

      if (!row?.passwordHash || row.status !== "active") {
        throw invalid;
      }

      const passwordMatches = await verifyPassword(input.password, row.passwordHash);
      if (!passwordMatches) {
        await writeAuditLog(db, {
          actorUserId: row.id,
          action: "auth.login_failed",
          entityType: "user",
          entityId: row.id,
          severity: "warning",
          metadata: {
            ipHash: context.ipHash,
            userAgent: context.userAgent,
          },
        });
        throw invalid;
      }

      await db
        .update(users)
        .set({
          lastLoginAt: nowIso(),
          updatedAt: nowIso(),
        })
        .where(eq(users.id, row.id));
      await writeAuditLog(db, {
        actorUserId: row.id,
        action: "auth.login_success",
        entityType: "user",
        entityId: row.id,
        metadata: {
          ipHash: context.ipHash,
          userAgent: context.userAgent,
        },
      });

      const roles = await getUserRoles(db, row.id);
      const user = toAuthUser(row, roles);
      return createSessionResponse(db, config, user, context);
    },

    async refresh(input, context) {
      const refreshTokenHash = hashRefreshToken(input.refreshToken, config.authRefreshTokenSecret);
      const rows = await db
        .select({
          sessionId: authSessions.id,
          sessionExpiresAt: authSessions.expiresAt,
          userId: users.id,
          email: users.email,
          username: users.username,
          displayName: users.displayName,
          status: users.status,
        })
        .from(authSessions)
        .innerJoin(users, eq(users.id, authSessions.userId))
        .where(and(
          eq(authSessions.refreshTokenHash, refreshTokenHash),
          eq(authSessions.sessionStatus, "active"),
          isNull(authSessions.revokedAt),
          gt(authSessions.expiresAt, nowIso()),
          isNull(users.deletedAt),
        ))
        .limit(1);

      const row = rows[0];
      if (!row || row.status !== "active") {
        throw new AuthError("UNAUTHENTICATED", 401);
      }

      const newRefreshToken = generateRefreshToken();
      const newRefreshTokenHash = hashRefreshToken(newRefreshToken, config.authRefreshTokenSecret);
      const newExpiresAt = addDaysIso(config.sessionTtlDays);
      await db
        .update(authSessions)
        .set({
          refreshTokenHash: newRefreshTokenHash,
          lastSeenAt: nowIso(),
          expiresAt: newExpiresAt,
          updatedAt: nowIso(),
        })
        .where(eq(authSessions.id, row.sessionId));

      const roles = await getUserRoles(db, row.userId);
      const user = toAuthUser({
        id: row.userId,
        email: row.email,
        username: row.username,
        displayName: row.displayName,
        status: row.status,
      }, roles);
      const accessToken = createAccessToken(user, row.sessionId, config);
      await writeAuditLog(db, {
        actorUserId: user.id,
        action: "auth.session_refreshed",
        entityType: "auth_session",
        entityId: row.sessionId,
        metadata: {
          ipHash: context.ipHash,
          userAgent: context.userAgent,
        },
      });

      return {
        user,
        session: {
          id: row.sessionId,
          expiresAt: newExpiresAt,
        },
        accessToken: accessToken.token,
        refreshToken: newRefreshToken,
        tokenType: "Bearer",
        accessTokenExpiresAt: accessToken.expiresAt,
      };
    },

    async logout(input, context, accessToken) {
      const updates: string[] = [];
      if (input.refreshToken) {
        const refreshTokenHash = hashRefreshToken(input.refreshToken, config.authRefreshTokenSecret);
        const result = await db
          .update(authSessions)
          .set({
            sessionStatus: "revoked",
            revokedAt: nowIso(),
            revokedByIpHash: context.ipHash,
            revokeReason: "manual_logout",
            updatedAt: nowIso(),
          })
          .where(and(
            eq(authSessions.refreshTokenHash, refreshTokenHash),
            eq(authSessions.sessionStatus, "active"),
          ))
          .returning({ id: authSessions.id, userId: authSessions.userId });
        updates.push(...result.map((row) => row.id));
      }

      if (accessToken) {
        const payload = verifyAccessToken(accessToken, config.authAccessTokenSecret);
        if (payload && !updates.includes(payload.sid)) {
          await db
            .update(authSessions)
            .set({
              sessionStatus: "revoked",
              revokedAt: nowIso(),
              revokedByIpHash: context.ipHash,
              revokeReason: "manual_logout",
              updatedAt: nowIso(),
            })
            .where(and(
              eq(authSessions.id, payload.sid),
              eq(authSessions.sessionStatus, "active"),
            ));
          updates.push(payload.sid);
        }
      }

      for (const sessionId of updates) {
        await writeAuditLog(db, {
          action: "auth.logout",
          entityType: "auth_session",
          entityId: sessionId,
          metadata: {
            ipHash: context.ipHash,
            userAgent: context.userAgent,
          },
        });
      }
    },

    async getSession(accessToken) {
      const payload = verifyAccessToken(accessToken, config.authAccessTokenSecret);
      if (!payload) {
        throw new AuthError("UNAUTHENTICATED", 401);
      }

      return getSessionByPayload(payload);
    },

    async getModules(accessToken) {
      const session = await this.getSession(accessToken);
      const access = await db
        .select({
          key: modules.key,
          displayName: modules.displayName,
          accessLevel: userModuleAccess.accessLevel,
        })
        .from(userModuleAccess)
        .innerJoin(modules, eq(modules.id, userModuleAccess.moduleId))
        .where(and(
          eq(userModuleAccess.userId, session.user.id),
          isNull(userModuleAccess.revokedAt),
          eq(modules.status, "active"),
        ));

      return access;
    },

    async bootstrapAdmin(input) {
      const email = normalizeEmail(input.email);
      const existing = await findUserByEmail(db, email);
      let userId = existing?.id ?? null;

      if (!userId) {
        const passwordHash = await hashPassword(input.password);
        const rows = await db
          .insert(users)
          .values({
            email,
            username: generateUsername(email),
            displayName: input.displayName ?? "Data Trade Admin",
            passwordHash,
            passwordHashAlgorithm: PASSWORD_HASH_ALGORITHM,
            status: "active",
            metadata: {
              signupSource: "admin_bootstrap",
            },
          })
          .returning({
            id: users.id,
          });
        const created = rows[0];
        if (!created) {
          throw new Error("ADMIN_INSERT_FAILED");
        }
        userId = created.id;
        await db.insert(authAccounts).values({
          userId,
          provider: "credentials",
          providerAccountId: email,
          passwordHash,
          passwordHashAlgorithm: PASSWORD_HASH_ALGORITHM,
          metadata: {
            bootstrap: true,
          },
        });
      }

      await grantModuleAccess(db, userId, ADMIN_MODULES, "admin");
      await writeAuditLog(db, {
        actorUserId: userId,
        action: existing ? "auth.admin_bootstrap_verified" : "auth.admin_bootstrap_created",
        entityType: "user",
        entityId: userId,
        metadata: {
          bootstrap: true,
        },
      });

      return {
        created: !existing,
        userId,
        email,
      };
    },
  };
}

export function getBearerToken(authorizationHeader: string | string[] | undefined): string | null {
  const value = Array.isArray(authorizationHeader) ? authorizationHeader[0] : authorizationHeader;
  if (!value) {
    return null;
  }

  const [scheme, token] = value.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token?.trim()) {
    return null;
  }

  return token.trim();
}
