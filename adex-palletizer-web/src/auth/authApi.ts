import type {
  RegistrationUseCase,
  RegistrationVolumeBand,
} from './registrationModel'

export interface AuthUser {
  id: string
  username: string
  email: string
  role: string
  status: string
  mustChangePassword: boolean
}

export interface AuthSessionPayload {
  user: AuthUser
  session: {
    id: string
    expiresAt: string
  }
}

export interface RegisterPayload {
  fullName: string
  email: string
  companyName: string
  useCase: RegistrationUseCase
  monthlyVolumeBand: RegistrationVolumeBand
  password: string
}

interface ErrorPayload {
  error?: string
  message?: string
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || ''

function buildUrl(path: string): string {
  if (!API_BASE_URL) {
    return path
  }

  return new URL(path, API_BASE_URL).toString()
}

export function getApiBaseUrl() {
  return API_BASE_URL || 'mismo origen (/api)'
}

export class AuthApiError extends Error {
  status: number
  code: string

  constructor(message: string, status: number, code = 'UNKNOWN_ERROR') {
    super(message)
    this.name = 'AuthApiError'
    this.status = status
    this.code = code
  }
}

export function isRetryableAuthError(error: unknown): boolean {
  if (!(error instanceof AuthApiError)) {
    return false
  }

  return error.code === 'NETWORK_ERROR' || error.status >= 500
}

async function readErrorPayload(response: Response): Promise<ErrorPayload> {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    return {}
  }

  try {
    return (await response.json()) as ErrorPayload
  } catch {
    return {}
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response

  try {
    response = await fetch(buildUrl(path), {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
      ...init,
    })
  } catch {
    throw new AuthApiError(
      'No se pudo conectar con el servicio de acceso. Intenta nuevamente en unos segundos.',
      0,
      'NETWORK_ERROR',
    )
  }

  if (!response.ok) {
    const payload = await readErrorPayload(response)
    const errorCode = payload.error ?? 'HTTP_ERROR'
    const message =
      errorCode === 'INVALID_CREDENTIALS'
        ? 'Usuario, correo o contrasena incorrectos.'
        : errorCode === 'EMAIL_ALREADY_REGISTERED'
          ? 'Ya existe una cuenta con ese correo. Inicia sesion o usa otro correo.'
        : payload.message ??
          payload.error ??
          'No se pudo completar el acceso. Intenta nuevamente.'

    throw new AuthApiError(
      message,
      response.status,
      errorCode,
    )
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export async function fetchCurrentSession() {
  return requestJson<AuthSessionPayload>('/api/auth/me', {
    method: 'GET',
  })
}

export async function loginWithPassword(identifier: string, password: string) {
  return requestJson<AuthSessionPayload>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      identifier,
      password,
    }),
  })
}

export async function registerWithPassword(payload: RegisterPayload) {
  return requestJson<AuthSessionPayload>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function logoutSession() {
  return requestJson<void>('/api/auth/logout', {
    method: 'POST',
  })
}
