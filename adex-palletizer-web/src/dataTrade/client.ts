import type { DataTradeFrontendConfig } from './config'

export const DATA_TRADE_MODULES = [
  'sislope',
  'adex_palletizer',
  'data_trade_analytics',
  'alvin',
  'admin',
  'api',
  'unknown',
] as const

export type DataTradeEventName =
  | 'user_signed_up'
  | 'user_logged_in'
  | 'module_opened'
  | 'palletizer_calculation_created'
  | 'map_layer_toggled'
  | 'search_performed'
  | 'file_uploaded'
  | 'export_generated'
  | 'admin_view_opened'
  | 'api_error'
  | 'session_started'
  | 'session_ended'

export interface DataTradeUser {
  id: string
  email: string
  username: string | null
  displayName: string | null
  status: string
  roles: string[]
}

export interface DataTradeModuleAccess {
  key: string
  displayName: string
  accessLevel: string
}

export interface DataTradeAdminOverview {
  total_users: number
  active_users_24h: number
  active_users_7d: number
  active_users_30d: number
  total_events: number
  events_24h: number
  events_7d: number
  events_30d: number
  total_modules: number
  top_module_by_events: string | null
  latest_event_at: string | null
}

export interface DataTradeAdminUserRow {
  id: string
  email: string
  name: string | null
  role: string
  created_at: string | null
  last_seen_at: string | null
  event_count: number
  module_count: number
}

export interface DataTradeAdminEventRow {
  id: string
  user_id: string | null
  anonymous_id: string | null
  module: string
  event_name: string
  metadata: Record<string, unknown>
  path: string | null
  created_at: string | null
}

export interface DataTradeAdminModuleUsageRow {
  module_code: string
  module_name: string
  events_count: number
  unique_users: number
  anonymous_users: number
  last_event_at: string | null
}

export type DataTradeSessionStatus =
  | 'disabled'
  | 'unauthenticated'
  | 'authenticated'
  | 'expired'
  | 'api_error'

export interface DataTradeSessionState {
  status: DataTradeSessionStatus
  user: DataTradeUser | null
  modules: DataTradeModuleAccess[]
  error: string | null
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

type DataTradeFetch = (input: string, init?: RequestInit) => Promise<Response>

export class DataTradeApiError extends Error {
  readonly status: number
  readonly code: string
  readonly requestId?: string

  constructor(
    status: number,
    code: string,
    message: string,
    requestId?: string,
  ) {
    super(message)
    this.name = 'DataTradeApiError'
    this.status = status
    this.code = code
    this.requestId = requestId
  }
}

const ANONYMOUS_ID_STORAGE_KEY = 'data_trade_anonymous_id'
const SENSITIVE_METADATA_KEYS = new Set([
  'authorization',
  'password',
  'secret',
  'token',
  'accessToken',
  'refreshToken',
  'user_id',
  'userId',
])

function cloneSessionState(state: DataTradeSessionState): DataTradeSessionState {
  return {
    status: state.status,
    user: state.user ? { ...state.user, roles: [...state.user.roles] } : null,
    modules: state.modules.map((entry) => ({ ...entry })),
    error: state.error,
  }
}

function createAnonymousId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }

  return `anon_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`
}

function getAnonymousId() {
  try {
    const stored = window.localStorage.getItem(ANONYMOUS_ID_STORAGE_KEY)
    if (stored) {
      return stored
    }

    const next = createAnonymousId()
    window.localStorage.setItem(ANONYMOUS_ID_STORAGE_KEY, next)
    return next
  } catch {
    return createAnonymousId()
  }
}

function buildQueryString(params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      searchParams.set(key, String(value))
    }
  }

  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

function sanitizeMetadataValue(value: unknown, depth: number): unknown {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') {
    return value
  }

  if (typeof value === 'string') {
    return value.slice(0, 1000)
  }

  if (Array.isArray(value)) {
    if (depth >= 5) {
      return '[max_depth]'
    }

    return value.slice(0, 50).map((entry) => sanitizeMetadataValue(entry, depth + 1))
  }

  if (value && typeof value === 'object') {
    if (depth >= 5) {
      return '[max_depth]'
    }

    const sanitized: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value).slice(0, 30)) {
      if (SENSITIVE_METADATA_KEYS.has(key)) {
        continue
      }
      sanitized[key.slice(0, 120)] = sanitizeMetadataValue(entry, depth + 1)
    }
    return sanitized
  }

  return null
}

export function sanitizeDataTradeMetadata(metadata: Record<string, unknown> = {}) {
  return sanitizeMetadataValue(metadata, 0) as Record<string, unknown>
}

export function canAccessModule(
  modules: DataTradeModuleAccess[],
  moduleCode: string,
): boolean {
  return modules.some(
    (entry) => entry.key === moduleCode && entry.accessLevel !== 'none',
  )
}

export class DataTradeAuthApi {
  private accessToken: string | null = null
  private refreshToken: string | null = null
  private state: DataTradeSessionState
  private readonly config: DataTradeFrontendConfig
  private readonly fetchImpl: DataTradeFetch

  constructor(
    config: DataTradeFrontendConfig,
    fetchImpl: DataTradeFetch = (input, init) => fetch(input, init),
  ) {
    this.config = config
    this.fetchImpl = fetchImpl
    this.state = {
      status: config.authEnabled ? 'unauthenticated' : 'disabled',
      user: null,
      modules: [],
      error: null,
    }
  }

  getSessionSnapshot() {
    return cloneSessionState(this.state)
  }

  getAccessToken() {
    return this.accessToken
  }

  canAccessModule(moduleCode: string) {
    return canAccessModule(this.state.modules, moduleCode)
  }

  async register(input: {
    email: string
    password: string
    displayName?: string
    organizationName?: string
  }) {
    if (!this.config.authEnabled) {
      return this.getSessionSnapshot()
    }

    const response = await this.requestJson<DataTradeAuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    })

    return this.applyAuthResponse(response)
  }

  async login(input: { email: string; password: string }) {
    if (!this.config.authEnabled) {
      return this.getSessionSnapshot()
    }

    const response = await this.requestJson<DataTradeAuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    })

    return this.applyAuthResponse(response)
  }

  async loadCurrentUser() {
    if (!this.config.authEnabled) {
      return this.getSessionSnapshot()
    }

    if (!this.accessToken) {
      this.state = {
        status: 'unauthenticated',
        user: null,
        modules: [],
        error: null,
      }
      return this.getSessionSnapshot()
    }

    try {
      const response = await this.requestJson<DataTradeSessionResponse>('/auth/me', {
        method: 'GET',
      })
      this.state = {
        status: 'authenticated',
        user: response.user,
        modules: this.state.modules,
        error: null,
      }
      await this.loadModules()
    } catch (error) {
      this.clearTokens()
      this.state = {
        status: error instanceof DataTradeApiError && error.status === 401 ? 'expired' : 'api_error',
        user: null,
        modules: [],
        error: error instanceof Error ? error.message : 'Data Trade API error',
      }
    }

    return this.getSessionSnapshot()
  }

  async loadModules() {
    if (!this.config.authEnabled || !this.accessToken) {
      return []
    }

    const response = await this.requestJson<{ modules: DataTradeModuleAccess[] }>(
      '/auth/modules',
      { method: 'GET' },
    )
    this.state = {
      ...this.state,
      modules: response.modules,
    }
    return response.modules
  }

  async refresh() {
    if (!this.config.authEnabled) {
      return this.getSessionSnapshot()
    }

    if (!this.refreshToken) {
      this.clearTokens()
      this.state = {
        status: 'expired',
        user: null,
        modules: [],
        error: 'No hay refresh token activo en memoria.',
      }
      return this.getSessionSnapshot()
    }

    try {
      const response = await this.requestJson<DataTradeAuthResponse>('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      })
      return this.applyAuthResponse(response)
    } catch (error) {
      this.clearTokens()
      this.state = {
        status: 'expired',
        user: null,
        modules: [],
        error: error instanceof Error ? error.message : 'Sesion expirada.',
      }
      return this.getSessionSnapshot()
    }
  }

  async logout() {
    const token = this.refreshToken

    try {
      if (this.config.authEnabled && this.config.apiUrl && (token || this.accessToken)) {
        await this.requestJson<void>('/auth/logout', {
          method: 'POST',
          body: JSON.stringify(token ? { refreshToken: token } : {}),
        })
      }
    } finally {
      this.clearTokens()
      this.state = {
        status: this.config.authEnabled ? 'unauthenticated' : 'disabled',
        user: null,
        modules: [],
        error: null,
      }
    }

    return this.getSessionSnapshot()
  }

  async track(
    eventName: DataTradeEventName,
    metadata: Record<string, unknown> = {},
    path = typeof window === 'undefined' ? undefined : window.location.pathname,
  ) {
    if (!this.config.trackingEnabled || !this.config.apiUrl) {
      return { sent: false, reason: 'disabled' as const }
    }

    const body: Record<string, unknown> = {
      module: this.config.moduleCode,
      eventName,
      metadata: sanitizeDataTradeMetadata(metadata),
      path,
    }

    if (!this.accessToken) {
      body.anonymousId = getAnonymousId()
    }

    try {
      await this.requestJson('/events/track', {
        method: 'POST',
        body: JSON.stringify(body),
        allowAnonymous: true,
      })
      return { sent: true as const }
    } catch {
      return { sent: false, reason: 'api_error' as const }
    }
  }

  async getAdminOverview() {
    return this.requestJson<DataTradeAdminOverview>('/admin/metrics/overview', {
      method: 'GET',
    })
  }

  async getAdminUsers(params: { limit?: number; offset?: number } = {}) {
    return this.requestJson<{
      users: DataTradeAdminUserRow[]
      total: number
      limit: number
      offset: number
    }>(`/admin/users${buildQueryString(params)}`, {
      method: 'GET',
    })
  }

  async getAdminEvents(
    params: {
      module?: string
      eventName?: string
      userId?: string
      anonymousId?: string
      limit?: number
      offset?: number
    } = {},
  ) {
    return this.requestJson<{
      events: DataTradeAdminEventRow[]
      total: number
      limit: number
      offset: number
    }>(
      `/admin/events${buildQueryString({
        module: params.module,
        event_name: params.eventName,
        user_id: params.userId,
        anonymous_id: params.anonymousId,
        limit: params.limit,
        offset: params.offset,
      })}`,
      {
        method: 'GET',
      },
    )
  }

  async getAdminModulesUsage() {
    return this.requestJson<{ modules: DataTradeAdminModuleUsageRow[] }>(
      '/admin/modules/usage',
      {
        method: 'GET',
      },
    )
  }

  private async applyAuthResponse(response: DataTradeAuthResponse) {
    this.accessToken = response.accessToken
    this.refreshToken = response.refreshToken
    this.state = {
      status: 'authenticated',
      user: response.user,
      modules: [],
      error: null,
    }

    try {
      await this.loadModules()
    } catch {
      this.state = {
        ...this.state,
        modules: [],
      }
    }

    return this.getSessionSnapshot()
  }

  private clearTokens() {
    this.accessToken = null
    this.refreshToken = null
  }

  private async requestJson<T = unknown>(
    path: string,
    options: RequestInit & { allowAnonymous?: boolean },
  ): Promise<T> {
    if (!this.config.apiUrl) {
      throw new DataTradeApiError(0, 'API_URL_MISSING', 'Data Trade API URL is not configured.')
    }

    const { allowAnonymous: _allowAnonymous, ...requestInit } = options
    void _allowAnonymous

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> | undefined),
    }

    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`
    }

    const response = await this.fetchImpl(`${this.config.apiUrl}${path}`, {
      ...requestInit,
      headers,
    })

    if (response.status === 204) {
      return undefined as T
    }

    let payload: unknown = null
    try {
      payload = await response.json()
    } catch {
      payload = null
    }

    if (!response.ok) {
      const apiError = payload as {
        error?: { code?: string; message?: string; requestId?: string }
      }
      throw new DataTradeApiError(
        response.status,
        apiError.error?.code ?? 'DATA_TRADE_API_ERROR',
        apiError.error?.message ?? 'Data Trade API request failed.',
        apiError.error?.requestId,
      )
    }

    return payload as T
  }
}

export function createDataTradeClient(
  config: DataTradeFrontendConfig,
  fetchImpl?: DataTradeFetch,
) {
  return new DataTradeAuthApi(config, fetchImpl)
}
