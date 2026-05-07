import type {
  RegistrationJobTitle,
  RegistrationUseCase,
  RegistrationVolumeBand,
} from './registrationModel'
import type { DataTradeModuleAccess } from '../dataTrade/client'

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
  accessToken?: string | null
  modules?: DataTradeModuleAccess[]
}

export interface RegisterPayload {
  fullName: string
  email: string
  companyName: string
  useCase: RegistrationUseCase
  monthlyVolumeBand: RegistrationVolumeBand
  phone?: string
  jobTitle?: RegistrationJobTitle
  password: string
}

interface ErrorPayload {
  error?: string | {
    code?: string
    message?: string
    requestId?: string
  }
  message?: string
}

interface DataTradeUser {
  id: string
  email: string
  username: string | null
  displayName?: string | null
  status?: string | null
  roles?: string[]
}

interface DataTradeAuthResponse {
  user: DataTradeUser
  session: {
    id: string
    expiresAt: string
  }
  accessToken: string
  refreshToken: string
  tokenType: 'Bearer'
  accessTokenExpiresAt: string
}

interface DataTradeSessionResponse {
  user: DataTradeUser
  session: {
    id: string
    expiresAt: string
  }
}

interface DataTradeModulesResponse {
  modules: DataTradeModuleAccess[]
}

interface DataTradeHandoffCreateResponse {
  handoffCode: string
  targetModule: string
  expiresAt: string
}

const LEGACY_API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || ''
const DATA_TRADE_API_URL = normalizeApiUrl(import.meta.env.VITE_DATA_TRADE_API_URL)
const LEGACY_AUTH_FALLBACK = parseBooleanFlag(import.meta.env.VITE_ADEX_LEGACY_AUTH_FALLBACK)

let accessToken: string | null = null
let refreshToken: string | null = null
let modules: DataTradeModuleAccess[] = []

function parseBooleanFlag(value: string | undefined): boolean {
  return value === 'true' || value === '1'
}

function normalizeApiUrl(value: string | undefined): string {
  return (value ?? '').trim().replace(/\/+$/, '')
}

function useDataTradeAuth() {
  return Boolean(DATA_TRADE_API_URL) && !LEGACY_AUTH_FALLBACK
}

function buildLegacyUrl(path: string): string {
  if (!LEGACY_API_BASE_URL) {
    return path
  }

  return new URL(path, LEGACY_API_BASE_URL).toString()
}

function buildDataTradeUrl(path: string): string {
  if (!DATA_TRADE_API_URL) {
    throw new AuthApiError(
      'Configura VITE_DATA_TRADE_API_URL para usar el acceso central de Data Trade.',
      0,
      'DATA_TRADE_API_URL_MISSING',
    )
  }

  return `${DATA_TRADE_API_URL}${path}`
}

export function getApiBaseUrl() {
  if (useDataTradeAuth()) {
    return DATA_TRADE_API_URL
  }

  if (LEGACY_AUTH_FALLBACK) {
    return LEGACY_API_BASE_URL || 'mismo origen (/api legacy)'
  }

  return 'Data Trade API no configurada'
}

export function getDataTradeAccessToken() {
  return accessToken
}

export function getDataTradeModules() {
  return modules.map((entry) => ({ ...entry }))
}

export function clearDataTradeSession() {
  accessToken = null
  refreshToken = null
  modules = []
}

export function canAccessDataTradeModule(moduleCode: string) {
  return modules.some(
    (entry) => entry.key === moduleCode && entry.accessLevel !== 'none',
  )
}

export function isDataTradeAuthConfigured() {
  return useDataTradeAuth()
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

function getErrorCode(payload: ErrorPayload) {
  if (typeof payload.error === 'string') {
    return payload.error
  }

  return payload.error?.code ?? 'HTTP_ERROR'
}

function getErrorMessage(payload: ErrorPayload, errorCode: string) {
  if (errorCode === 'INVALID_CREDENTIALS') {
    return 'Usuario, correo o contrasena incorrectos.'
  }

  if (errorCode === 'ACCOUNT_LOCKED') {
    return 'Cuenta bloqueada por multiples intentos fallidos. Intenta en 15 minutos.'
  }

  if (errorCode === 'EMAIL_ALREADY_REGISTERED') {
    return 'Ya existe una cuenta con ese correo. Inicia sesion o usa otro correo.'
  }

  return (
    (typeof payload.error === 'object' ? payload.error.message : undefined) ??
    payload.message ??
    (typeof payload.error === 'string' ? payload.error : undefined) ??
    'No se pudo completar el acceso. Intenta nuevamente.'
  )
}

async function requestLegacyJson<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response

  try {
    response = await fetch(buildLegacyUrl(path), {
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
    const errorCode = getErrorCode(payload)

    throw new AuthApiError(
      getErrorMessage(payload, errorCode),
      response.status,
      errorCode,
    )
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

async function requestDataTradeJson<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response

  try {
    response = await fetch(buildDataTradeUrl(path), {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(init?.headers ?? {}),
      },
      ...init,
    })
  } catch {
    throw new AuthApiError(
      'No se pudo conectar con Data Trade Auth. Intenta nuevamente en unos segundos.',
      0,
      'NETWORK_ERROR',
    )
  }

  if (!response.ok) {
    const payload = await readErrorPayload(response)
    const errorCode = getErrorCode(payload)

    throw new AuthApiError(
      getErrorMessage(payload, errorCode),
      response.status,
      errorCode,
    )
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

function mapDataTradeUser(user: DataTradeUser): AuthUser {
  const roles = user.roles ?? []

  return {
    id: user.id,
    email: user.email,
    username: user.username?.trim() || user.email,
    role: roles.includes('admin') ? 'admin' : 'user',
    status: user.status || 'active',
    mustChangePassword: false,
  }
}

async function loadDataTradeModules() {
  if (!accessToken) {
    modules = []
    return modules
  }

  try {
    const response = await requestDataTradeJson<DataTradeModulesResponse>('/auth/modules', {
      method: 'GET',
    })
    modules = response.modules
  } catch {
    modules = []
  }

  return modules
}

async function applyDataTradeAuthResponse(
  response: DataTradeAuthResponse,
): Promise<AuthSessionPayload> {
  accessToken = response.accessToken
  refreshToken = response.refreshToken
  await loadDataTradeModules()

  return {
    user: mapDataTradeUser(response.user),
    session: response.session,
    accessToken,
    modules: getDataTradeModules(),
  }
}

async function refreshDataTradeSession() {
  if (!refreshToken) {
    clearDataTradeSession()
    throw new AuthApiError('Sesion expirada. Inicia sesion nuevamente.', 401, 'UNAUTHENTICATED')
  }

  const response = await requestDataTradeJson<DataTradeAuthResponse>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  })

  return applyDataTradeAuthResponse(response)
}

export async function fetchCurrentSession() {
  if (!useDataTradeAuth()) {
    if (!LEGACY_AUTH_FALLBACK) {
      throw new AuthApiError(
        'Configura VITE_DATA_TRADE_API_URL para usar el acceso central de Data Trade.',
        0,
        'DATA_TRADE_API_URL_MISSING',
      )
    }

    return requestLegacyJson<AuthSessionPayload>('/api/auth/me', {
      method: 'GET',
    })
  }

  if (!accessToken) {
    throw new AuthApiError('Sesion no restaurada. Inicia sesion nuevamente.', 401, 'UNAUTHENTICATED')
  }

  try {
    const response = await requestDataTradeJson<DataTradeSessionResponse>('/auth/me', {
      method: 'GET',
    })
    await loadDataTradeModules()
    return {
      user: mapDataTradeUser(response.user),
      session: response.session,
      accessToken,
      modules: getDataTradeModules(),
    }
  } catch (error) {
    if (error instanceof AuthApiError && error.status === 401 && refreshToken) {
      return refreshDataTradeSession()
    }

    clearDataTradeSession()
    throw error
  }
}

export async function loginWithPassword(identifier: string, password: string) {
  if (!useDataTradeAuth()) {
    if (!LEGACY_AUTH_FALLBACK) {
      throw new AuthApiError(
        'Configura VITE_DATA_TRADE_API_URL para usar el acceso central de Data Trade.',
        0,
        'DATA_TRADE_API_URL_MISSING',
      )
    }

    return requestLegacyJson<AuthSessionPayload>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier,
        password,
      }),
    })
  }

  const response = await requestDataTradeJson<DataTradeAuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: identifier,
      password,
    }),
  })

  return applyDataTradeAuthResponse(response)
}

export async function registerWithPassword(payload: RegisterPayload) {
  if (!useDataTradeAuth()) {
    if (!LEGACY_AUTH_FALLBACK) {
      throw new AuthApiError(
        'Configura VITE_DATA_TRADE_API_URL para usar el acceso central de Data Trade.',
        0,
        'DATA_TRADE_API_URL_MISSING',
      )
    }

    const body: Record<string, unknown> = { ...payload }
    if (!body.phone) delete body.phone
    if (!body.jobTitle) delete body.jobTitle
    return requestLegacyJson<AuthSessionPayload>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }

  const response = await requestDataTradeJson<DataTradeAuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: payload.email,
      password: payload.password,
      displayName: payload.fullName,
      organizationName: payload.companyName,
    }),
  })

  return applyDataTradeAuthResponse(response)
}

export async function logoutSession() {
  if (!useDataTradeAuth()) {
    if (!LEGACY_AUTH_FALLBACK) {
      clearDataTradeSession()
      return
    }

    return requestLegacyJson<void>('/api/auth/logout', {
      method: 'POST',
    })
  }

  try {
    if (accessToken || refreshToken) {
      await requestDataTradeJson<void>('/auth/logout', {
        method: 'POST',
        body: JSON.stringify(refreshToken ? { refreshToken } : {}),
      })
    }
  } finally {
    clearDataTradeSession()
  }
}

export async function createHandoffCode(targetModule: string) {
  if (!useDataTradeAuth()) {
    throw new AuthApiError(
      'Configura VITE_DATA_TRADE_API_URL para navegar con sesion compartida.',
      0,
      'DATA_TRADE_API_URL_MISSING',
    )
  }

  if (!accessToken) {
    throw new AuthApiError('Sesion no restaurada. Inicia sesion nuevamente.', 401, 'UNAUTHENTICATED')
  }

  return requestDataTradeJson<DataTradeHandoffCreateResponse>('/auth/handoff/create', {
    method: 'POST',
    body: JSON.stringify({ targetModule }),
  })
}
