import type { SolverInput, SolverResult } from '../types'

interface ExportPayload {
  input: SolverInput
  result: SolverResult
  generatedAt: string
}

export function exportJson(payload: ExportPayload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'pallet-layout.json'
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
