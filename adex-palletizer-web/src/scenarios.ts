import type {
  ContainerInput,
  ContainerResult,
  MultiPreviewInput,
  MultiPreviewResult,
  PackingMode,
  SolverInput,
  SolverResult,
} from './types'
import type { BoxPresetId } from './boxPresets'

export const SCENARIOS_STORAGE_KEY = 'adexPalletizer.scenarios.v1'
export const SCENARIO_LIMIT = 5

interface StoredSingleScenarioData {
  mode: 'single'
  single: {
    input: SolverInput
    result: SolverResult
    boxPresetId?: BoxPresetId
    packingMode?: PackingMode
    labelSkuRefs?: string[]
  }
}

interface StoredMultiScenarioData {
  mode: 'multi'
  multi: {
    input: MultiPreviewInput
    result: MultiPreviewResult
    labelSkuRefs?: string[]
  }
}

interface StoredContainerScenarioData {
  mode: 'container'
  container: {
    input: ContainerInput
    result: ContainerResult
    labelSkuRefs?: string[]
  }
}

export type StoredScenarioData =
  | StoredSingleScenarioData
  | StoredMultiScenarioData
  | StoredContainerScenarioData

export type StoredScenario = StoredScenarioData & {
  id: string
  name: string
  createdAt: string
}

function isStoredScenario(value: unknown): value is StoredScenario {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Record<string, unknown>
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.name !== 'string' ||
    typeof candidate.createdAt !== 'string'
  ) {
    return false
  }

  if (candidate.mode === 'single') {
    return typeof candidate.single === 'object' && candidate.single !== null
  }

  if (candidate.mode === 'multi') {
    return typeof candidate.multi === 'object' && candidate.multi !== null
  }

  if (candidate.mode === 'container') {
    return typeof candidate.container === 'object' && candidate.container !== null
  }

  return false
}

export function loadStoredScenarios(): StoredScenario[] {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const raw = window.localStorage.getItem(SCENARIOS_STORAGE_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter(isStoredScenario)
  } catch {
    return []
  }
}

export function saveStoredScenarios(scenarios: StoredScenario[]) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(SCENARIOS_STORAGE_KEY, JSON.stringify(scenarios))
}

export function getNextScenarioName(scenarios: StoredScenario[]): string {
  let maxIndex = 0

  scenarios.forEach((scenario) => {
    const match = scenario.name.match(/^(Scenario|Escenario)\s+(\d+)$/i)
    if (!match) {
      return
    }

    const parsed = Number(match[2])
    if (Number.isFinite(parsed)) {
      maxIndex = Math.max(maxIndex, parsed)
    }
  })

  return `Escenario ${maxIndex + 1}`
}

export function createScenarioId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
