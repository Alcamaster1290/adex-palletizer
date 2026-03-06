import type { ContainerInput, ContainerResult, SkuLabelsBySku } from '../types'
import type { ContainerDerivedMetrics } from '../metrics/units'

interface ExportContainerPayload {
  input: ContainerInput
  result: ContainerResult
  derivedMetrics?: ContainerDerivedMetrics
  labelsBySku?: SkuLabelsBySku
  generatedAt: string
}

function toTimestampToken(dateValue: string) {
  const date = new Date(dateValue)
  const validDate = Number.isNaN(date.getTime()) ? new Date() : date
  const year = String(validDate.getFullYear())
  const month = String(validDate.getMonth() + 1).padStart(2, '0')
  const day = String(validDate.getDate()).padStart(2, '0')
  const hours = String(validDate.getHours()).padStart(2, '0')
  const minutes = String(validDate.getMinutes()).padStart(2, '0')
  const seconds = String(validDate.getSeconds()).padStart(2, '0')

  return `${year}${month}${day}-${hours}${minutes}${seconds}`
}

export function buildContainerPlanJsonFilename(generatedAt: string) {
  return `container-plan-${toTimestampToken(generatedAt)}.json`
}

export function buildContainerTopViewPngFilename(generatedAt: string) {
  return `container-topview-${toTimestampToken(generatedAt)}.png`
}

export function exportContainerPlanJson(payload: ExportContainerPayload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = buildContainerPlanJsonFilename(payload.generatedAt)
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
