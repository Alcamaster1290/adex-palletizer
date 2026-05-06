import { getDataTradeConfig } from './config'
import {
  createDataTradeClient,
  type DataTradeEventName,
  type DataTradeSessionState,
} from './client'
import { getDataTradeAccessToken } from '../auth/authApi'

export const dataTradeClient = createDataTradeClient(getDataTradeConfig())

const DATA_TRADE_SESSION_EVENT = 'data-trade-session-changed'

export function notifyDataTradeSessionChanged() {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(
    new CustomEvent<DataTradeSessionState>(DATA_TRADE_SESSION_EVENT, {
      detail: dataTradeClient.getSessionSnapshot(),
    }),
  )
}

export function subscribeDataTradeSession(
  callback: (session: DataTradeSessionState) => void,
) {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const listener = (event: Event) => {
    callback((event as CustomEvent<DataTradeSessionState>).detail)
  }

  window.addEventListener(DATA_TRADE_SESSION_EVENT, listener)
  return () => {
    window.removeEventListener(DATA_TRADE_SESSION_EVENT, listener)
  }
}

export function trackDataTradeEvent(
  eventName: DataTradeEventName,
  metadata: Record<string, unknown> = {},
  path?: string,
) {
  return dataTradeClient.track(eventName, metadata, path, getDataTradeAccessToken())
}
