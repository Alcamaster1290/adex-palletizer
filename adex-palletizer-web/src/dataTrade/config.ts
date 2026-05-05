export interface DataTradeFrontendConfig {
  authEnabled: boolean
  trackingEnabled: boolean
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
