import { createHash, randomBytes } from 'node:crypto'

import type { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import type { AppConfig } from './config.js'
import type pg from 'pg'

export const REGISTER_USE_CASES = [
  'single_palletization',
  'multi_box_mixing',
  'container_loading',
  'general_exploration',
] as const

export const REGISTER_VOLUME_BANDS = [
  'lt_10',
  'between_10_50',
  'between_51_200',
  'gt_200',
] as const

const loginSchema = z.object({
  identifier: z.string().trim().min(1),
  password: z.string().min(1),
})

const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(160),
  companyName: z.string().trim().min(2).max(160),
  useCase: z.enum(REGISTER_USE_CASES),
  monthlyVolumeBand: z.enum(REGISTER_VOLUME_BANDS),
  password: z.string().min(12).max(128),
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12).max(128),
})

export type RegisterPayload = z.infer<typeof registerSchema>

export interface AuthenticatedUser {
  id: string
  username: string
  email: string
  role: string
  status: string
  mustChangePassword: boolean
}

interface LoginQueryRow extends AuthenticatedUser {
  passwordHash: string
  passwordMatches: boolean
}

interface SessionQueryRow {
  sessionId: string
  refreshTokenHash: string
  expiresAt: string
  id: string
  username: string
  email: string
  role: string
  status: string
  mustChangePassword: boolean
}

interface SessionInsertRow {
  id: string
  expiresAt: string
}

interface ExistingUserRow {
  id: string
}

interface SqlQueryable {
  query: pg.Pool['query']
}

export interface AuthSessionContext {
  sessionId: string
  refreshTokenHash: string
  expiresAt: string
  user: AuthenticatedUser
}

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super('EMAIL_ALREADY_REGISTERED')
    this.name = 'EmailAlreadyRegisteredError'
  }
}

export function parseLoginPayload(payload: unknown) {
  return loginSchema.parse(payload)
}

export function parseRegisterPayload(payload: unknown) {
  return registerSchema.parse(payload)
}

export function parseChangePasswordPayload(payload: unknown) {
  return changePasswordSchema.parse(payload)
}

export function generateRawToken(): string {
  return randomBytes(48).toString('base64url')
}

export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex')
}

export function buildGeneratedUsername(email: string, attempt = 0): string {
  const localPart = email.split('@')[0] ?? 'user'
  const normalized = localPart
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .split('')
    .filter((character) => character.charCodeAt(0) <= 0x7f)
    .join('')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 42)

  const base = normalized || 'user'
  if (attempt <= 0) {
    return base
  }

  return `${base}-${attempt + 1}`
}

function isUniqueViolationError(error: unknown, constraint?: string): error is { code: string; constraint?: string } {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return false
  }

  const code = String((error as { code?: unknown }).code ?? '')
  if (code !== '23505') {
    return false
  }

  if (!constraint) {
    return true
  }

  return String((error as { constraint?: unknown }).constraint ?? '') === constraint
}

export async function findUserByIdentifier(
  pool: pg.Pool,
  identifier: string,
  password: string,
) {
  const result = await pool.query<LoginQueryRow>(
    `
      SELECT
        id,
        username::text AS username,
        email::text AS email,
        role,
        status,
        must_change_password AS "mustChangePassword",
        password_hash AS "passwordHash",
        password_hash = crypt($2, password_hash) AS "passwordMatches"
      FROM public.usuarios
      WHERE deleted_at IS NULL
        AND (username = $1 OR email = $1)
      LIMIT 1
    `,
    [identifier, password],
  )

  return result.rows[0] ?? null
}

export async function findUserByEmail(queryable: SqlQueryable, email: string) {
  const result = await queryable.query<ExistingUserRow>(
    `
      SELECT id
      FROM public.usuarios
      WHERE email = $1
      LIMIT 1
    `,
    [email],
  )

  return result.rows[0] ?? null
}

export async function registerSelfServeUser(
  queryable: SqlQueryable,
  payload: RegisterPayload,
) {
  const normalizedEmail = payload.email.trim().toLowerCase()

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const username = buildGeneratedUsername(normalizedEmail, attempt)

    try {
      const userInsert = await queryable.query<AuthenticatedUser>(
        `
          INSERT INTO public.usuarios (
            username,
            email,
            password_hash,
            password_hash_algorithm,
            role,
            status,
            must_change_password,
            notes
          )
          VALUES (
            $1,
            $2,
            crypt($3, gen_salt('bf', 12)),
            'bcrypt',
            'analyst',
            'active',
            false,
            'Usuario creado desde registro self-serve.'
          )
          RETURNING
            id,
            username::text AS username,
            email::text AS email,
            role,
            status,
            must_change_password AS "mustChangePassword"
        `,
        [username, normalizedEmail, payload.password],
      )

      const user = userInsert.rows[0]

      await queryable.query(
        `
          INSERT INTO public.usuario_profiles (
            user_id,
            full_name,
            company_name,
            use_case,
            monthly_volume_band,
            signup_source
          )
          VALUES ($1, $2, $3, $4, $5, 'self_serve')
        `,
        [
          user.id,
          payload.fullName.trim(),
          payload.companyName.trim(),
          payload.useCase,
          payload.monthlyVolumeBand,
        ],
      )

      return user
    } catch (error) {
      if (isUniqueViolationError(error, 'usuarios_email_uq')) {
        throw new EmailAlreadyRegisteredError()
      }

      if (isUniqueViolationError(error, 'usuarios_username_uq')) {
        continue
      }

      throw error
    }
  }

  throw new Error('No se pudo generar un username unico para el registro.')
}

export async function incrementFailedLogin(pool: pg.Pool, userId: string) {
  await pool.query(
    `
      UPDATE public.usuarios
      SET failed_login_attempts = failed_login_attempts + 1
      WHERE id = $1
    `,
    [userId],
  )
}

export async function markSuccessfulLogin(
  queryable: SqlQueryable,
  userId: string,
  ipAddress: string | null,
) {
  await queryable.query(
    `
      UPDATE public.usuarios
      SET failed_login_attempts = 0,
          last_login_at = NOW(),
          last_login_ip = $2
      WHERE id = $1
    `,
    [userId, ipAddress],
  )
}

export async function createSession(
  queryable: SqlQueryable,
  config: AppConfig,
  userId: string,
  refreshTokenHash: string,
  ipAddress: string | null,
  userAgent: string | null,
) {
  const result = await queryable.query<SessionInsertRow>(
    `
      INSERT INTO public.auth_sessions (
        user_id,
        refresh_token_hash,
        created_by_ip,
        user_agent,
        expires_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        NOW() + make_interval(days => $5::int)
      )
      RETURNING id, expires_at AS "expiresAt"
    `,
    [userId, refreshTokenHash, ipAddress, userAgent, config.sessionTtlDays],
  )

  return result.rows[0]
}

export async function getSessionFromCookie(
  pool: pg.Pool,
  cookieName: string,
  request: FastifyRequest,
) {
  const rawToken = request.cookies[cookieName]
  if (!rawToken) {
    return null
  }

  const refreshTokenHash = hashToken(rawToken)
  const result = await pool.query<SessionQueryRow>(
    `
      SELECT
        s.id AS "sessionId",
        s.refresh_token_hash AS "refreshTokenHash",
        s.expires_at AS "expiresAt",
        u.id,
        u.username::text AS username,
        u.email::text AS email,
        u.role,
        u.status,
        u.must_change_password AS "mustChangePassword"
      FROM public.auth_sessions s
      INNER JOIN public.usuarios u
        ON u.id = s.user_id
      WHERE s.refresh_token_hash = $1
        AND s.session_status = 'active'
        AND s.revoked_at IS NULL
        AND s.expires_at > NOW()
        AND u.deleted_at IS NULL
      LIMIT 1
    `,
    [refreshTokenHash],
  )

  const row = result.rows[0]
  if (!row) {
    return null
  }

  return {
    sessionId: row.sessionId,
    refreshTokenHash: row.refreshTokenHash,
    expiresAt: row.expiresAt,
    user: {
      id: row.id,
      username: row.username,
      email: row.email,
      role: row.role,
      status: row.status,
      mustChangePassword: row.mustChangePassword,
    },
  } satisfies AuthSessionContext
}

export async function updateSessionActivity(pool: pg.Pool, sessionId: string) {
  await pool.query(
    `
      UPDATE public.auth_sessions
      SET last_seen_at = NOW()
      WHERE id = $1
    `,
    [sessionId],
  )
}

export async function rotateSessionToken(
  pool: pg.Pool,
  sessionId: string,
  refreshTokenHash: string,
  config: AppConfig,
) {
  const result = await pool.query<{ expiresAt: string }>(
    `
      UPDATE public.auth_sessions
      SET refresh_token_hash = $2,
          expires_at = NOW() + make_interval(days => $3::int),
          last_seen_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
      RETURNING expires_at AS "expiresAt"
    `,
    [sessionId, refreshTokenHash, config.sessionTtlDays],
  )

  return result.rows[0] ?? null
}

export async function revokeSession(
  pool: pg.Pool,
  sessionId: string,
  ipAddress: string | null,
  reason: string,
) {
  await pool.query(
    `
      UPDATE public.auth_sessions
      SET session_status = 'revoked',
          revoked_at = NOW(),
          revoked_by_ip = $2,
          revoke_reason = $3
      WHERE id = $1
    `,
    [sessionId, ipAddress, reason],
  )
}

export async function revokeAllSessionsForUser(
  pool: pg.Pool,
  userId: string,
  ipAddress: string | null,
  reason: string,
) {
  await pool.query(
    `
      UPDATE public.auth_sessions
      SET session_status = 'revoked',
          revoked_at = NOW(),
          revoked_by_ip = $2,
          revoke_reason = $3
      WHERE user_id = $1
        AND session_status = 'active'
        AND revoked_at IS NULL
    `,
    [userId, ipAddress, reason],
  )
}

export async function changePassword(
  pool: pg.Pool,
  userId: string,
  currentPassword: string,
  newPassword: string,
) {
  const result = await pool.query<{ id: string }>(
    `
      UPDATE public.usuarios
      SET password_hash = crypt($3, gen_salt('bf', 12)),
          password_hash_algorithm = 'bcrypt',
          must_change_password = false,
          failed_login_attempts = 0,
          updated_at = NOW()
      WHERE id = $1
        AND password_hash = crypt($2, password_hash)
      RETURNING id
    `,
    [userId, currentPassword, newPassword],
  )

  return result.rows[0] ?? null
}

export function setSessionCookie(
  reply: FastifyReply,
  config: AppConfig,
  rawToken: string,
  expiresAt: string,
) {
  reply.setCookie(config.cookieName, rawToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    path: '/',
    expires: new Date(expiresAt),
  })
}

export function clearSessionCookie(reply: FastifyReply, config: AppConfig) {
  reply.clearCookie(config.cookieName, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
  })
}

export function getRequestIp(request: FastifyRequest): string | null {
  return request.ip || null
}

export async function writeAuditLog(
  queryable: SqlQueryable,
  options: {
    userId?: string | null
    sessionId?: string | null
    eventType: string
    eventSeverity?: 'info' | 'warning' | 'critical'
    ipAddress?: string | null
    userAgent?: string | null
    payload?: Record<string, unknown>
  },
) {
  try {
    await queryable.query(
      `
        INSERT INTO public.auth_audit_log (
          user_id,
          session_id,
          event_type,
          event_severity,
          ip_address,
          user_agent,
          payload
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      `,
      [
        options.userId ?? null,
        options.sessionId ?? null,
        options.eventType,
        options.eventSeverity ?? 'info',
        options.ipAddress ?? null,
        options.userAgent ?? null,
        JSON.stringify(options.payload ?? {}),
      ],
    )
  } catch {
    // La auditoria no debe derribar auth si la tabla aun no existe.
  }
}
