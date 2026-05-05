export interface DataTradeFrontendConfig {
  authEnabled: boolean
  trackingEnabled: boolean
  adminDashboardEnabled: boolean
  apiUrl: string
  moduleCode: string
}

function parseBooleanFlag(value: string | undefined): boolean {
  return value === 'true' || value === '1'
}

function normalizeApiUrl(value: string | undefined): string {
  return (value ?? '').trim().replace(/\/+$/, '')
}

export function getDataTradeConfig(): DataTradeFrontendConfig {
  const apiUrl = normalizeApiUrl(import.meta.env.VITE_DATA_TRADE_API_URL)

  return {
    authEnabled: parseBooleanFlag(import.meta.env.VITE_DATA_TRADE_AUTH_ENABLED),
    trackingEnabled: parseBooleanFlag(import.meta.env.VITE_DATA_TRADE_TRACKING_ENABLED),
    adminDashboardEnabled: parseBooleanFlag(import.meta.env.VITE_DATA_TRADE_ADMIN_DASHBOARD_ENABLED),
    apiUrl,
    moduleCode:
      import.meta.env.VITE_DATA_TRADE_MODULE_CODE?.trim() || 'adex_palletizer',
  }
}

export function isDataTradeAuthEnabled() {
  return getDataTradeConfig().authEnabled
}

export function isDataTradeTrackingEnabled() {
  return getDataTradeConfig().trackingEnabled
}

export function isDataTradeAdminDashboardEnabled() {
  return getDataTradeConfig().adminDashboardEnabled
}
