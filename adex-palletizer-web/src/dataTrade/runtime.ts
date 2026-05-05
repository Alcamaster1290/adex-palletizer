import { getDataTradeConfig } from './config'
import {
  createDataTradeClient,
  type DataTradeEventName,
} from './client'

export const dataTradeClient = createDataTradeClient(getDataTradeConfig())

export function trackDataTradeEvent(
  eventName: DataTradeEventName,
  metadata: Record<string, unknown> = {},
  path?: string,
) {
  return dataTradeClient.track(eventName, metadata, path)
}
