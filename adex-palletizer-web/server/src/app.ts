import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import Fastify from 'fastify'
import { ZodError } from 'zod'

import {
  changePassword,
  clearSessionCookie,
  createSession,
  findUserByIdentifier,
  generateRawToken,
  getRequestIp,
  getSessionFromCookie,
  hashToken,
  incrementFailedLogin,
  markSuccessfulLogin,
  parseChangePasswordPayload,
  parseLoginPayload,
  revokeAllSessionsForUser,
  revokeSession,
  rotateSessionToken,
  setSessionCookie,
  updateSessionActivity,
  writeAuditLog,
} from './auth.js'
import type { AppConfig } from './config.js'
import type pg from 'pg'

export function buildApp(config: AppConfig, pool: pg.Pool) {
  const app = Fastify({
    logger: true,
  })

  app.register(cookie)
  app.register(cors, {
    origin: config.corsOrigin,
    credentials: true,
  })
  app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  })

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        issues: error.issues,
      })
    }

    app.log.error(error)
    return reply.status(500).send({
      error: 'INTERNAL_SERVER_ERROR',
    })
  })

  app.get('/api/health', async () => ({
    status: 'ok',
    service: 'adex-auth-api',
  }))

  app.post('/api/auth/login', async (request, reply) => {
    const payload = parseLoginPayload(request.body)
    const identifier = payload.identifier.trim()
    const ipAddress = getRequestIp(request)
    const userAgent = request.headers['user-agent'] ?? null

    const user = await findUserByIdentifier(pool, identifier, payload.password)
    if (!user || user.status !== 'active' || !user.passwordMatches) {
      if (user?.id) {
        await incrementFailedLogin(pool, user.id)
      }

      await writeAuditLog(pool, {
        userId: user?.id ?? null,
        eventType: 'auth.login.failure',
        eventSeverity: 'warning',
        ipAddress,
        userAgent,
        payload: { identifier },
      })

      return reply.status(401).send({
        error: 'INVALID_CREDENTIALS',
      })
    }

    await markSuccessfulLogin(pool, user.id, ipAddress)

    const rawToken = generateRawToken()
    const refreshTokenHash = hashToken(rawToken)
    const session = await createSession(pool, config, user.id, refreshTokenHash, ipAddress, userAgent)

    setSessionCookie(reply, config, rawToken, session.expiresAt)

    await writeAuditLog(pool, {
      userId: user.id,
      sessionId: session.id,
      eventType: 'auth.login.success',
      ipAddress,
      userAgent,
      payload: { role: user.role },
    })

    return reply.send({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
        mustChangePassword: user.mustChangePassword,
      },
      session: {
        id: session.id,
        expiresAt: session.expiresAt,
      },
    })
  })

  app.get('/api/auth/me', async (request, reply) => {
    const session = await getSessionFromCookie(pool, config.cookieName, request)
    if (!session) {
      return reply.status(401).send({ error: 'UNAUTHENTICATED' })
    }

    await updateSessionActivity(pool, session.sessionId)

    return reply.send({
      user: session.user,
      session: {
        id: session.sessionId,
        expiresAt: session.expiresAt,
      },
    })
  })

  app.post('/api/auth/refresh', async (request, reply) => {
    const session = await getSessionFromCookie(pool, config.cookieName, request)
    if (!session) {
      clearSessionCookie(reply, config)
      return reply.status(401).send({ error: 'UNAUTHENTICATED' })
    }

    const newRawToken = generateRawToken()
    const newRefreshTokenHash = hashToken(newRawToken)
    const rotated = await rotateSessionToken(pool, session.sessionId, newRefreshTokenHash, config)

    if (!rotated) {
      clearSessionCookie(reply, config)
      return reply.status(401).send({ error: 'UNAUTHENTICATED' })
    }

    setSessionCookie(reply, config, newRawToken, rotated.expiresAt)

    await writeAuditLog(pool, {
      userId: session.user.id,
      sessionId: session.sessionId,
      eventType: 'auth.session.refreshed',
      ipAddress: getRequestIp(request),
      userAgent: request.headers['user-agent'] ?? null,
    })

    return reply.send({
      user: session.user,
      session: {
        id: session.sessionId,
        expiresAt: rotated.expiresAt,
      },
    })
  })

  app.post('/api/auth/logout', async (request, reply) => {
    const session = await getSessionFromCookie(pool, config.cookieName, request)

    if (session) {
      await revokeSession(pool, session.sessionId, getRequestIp(request), 'manual_logout')
      await writeAuditLog(pool, {
        userId: session.user.id,
        sessionId: session.sessionId,
        eventType: 'auth.logout',
        ipAddress: getRequestIp(request),
        userAgent: request.headers['user-agent'] ?? null,
      })
    }

    clearSessionCookie(reply, config)
    return reply.status(204).send()
  })

  app.post('/api/auth/change-password', async (request, reply) => {
    const session = await getSessionFromCookie(pool, config.cookieName, request)
    if (!session) {
      return reply.status(401).send({ error: 'UNAUTHENTICATED' })
    }

    const payload = parseChangePasswordPayload(request.body)
    const changed = await changePassword(pool, session.user.id, payload.currentPassword, payload.newPassword)
    if (!changed) {
      return reply.status(400).send({ error: 'INVALID_CURRENT_PASSWORD' })
    }

    await revokeAllSessionsForUser(pool, session.user.id, getRequestIp(request), 'password_changed')
    clearSessionCookie(reply, config)

    await writeAuditLog(pool, {
      userId: session.user.id,
      sessionId: session.sessionId,
      eventType: 'auth.password.change',
      ipAddress: getRequestIp(request),
      userAgent: request.headers['user-agent'] ?? null,
    })

    return reply.send({
      status: 'PASSWORD_CHANGED',
      message: 'La contrasena fue actualizada. Debes iniciar sesion nuevamente.',
    })
  })

  return app
}
