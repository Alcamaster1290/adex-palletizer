import type { SolverInput } from './types'

export type ShareMode = 'single' | 'multi'

interface ParseShareResult {
  input: SolverInput
  mode: ShareMode
  warning: string | null
}

const SHARE_KEYS = ['pL', 'pW', 'pH', 'bL', 'bW', 'bH', 'maxH', 'rot', 'ov'] as const

function cloneSolverInput(input: SolverInput): SolverInput {
  return {
    pallet: { ...input.pallet },
    box: { ...input.box },
    maxTotalHeight: input.maxTotalHeight,
    allowRotation: input.allowRotation,
    overhang: input.overhang,
  }
}

function parseIntegerParam(
  value: string | null,
  min: number,
): number | null {
  if (value === null) {
    return null
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < min) {
    return NaN
  }

  return parsed
}

export function parseShareLinkInput(
  search: string,
  defaults: SolverInput,
): ParseShareResult {
  const params = new URLSearchParams(search)
  const modeParam = params.get('mode')
  const mode: ShareMode = modeParam === 'multi' ? 'multi' : 'single'
  const hasShareParams = SHARE_KEYS.some((key) => params.has(key))

  if (!hasShareParams) {
    return {
      input: cloneSolverInput(defaults),
      mode,
      warning: null,
    }
  }

  const pL = parseIntegerParam(params.get('pL'), 1)
  const pW = parseIntegerParam(params.get('pW'), 1)
  const pH = parseIntegerParam(params.get('pH'), 1)
  const bL = parseIntegerParam(params.get('bL'), 1)
  const bW = parseIntegerParam(params.get('bW'), 1)
  const bH = parseIntegerParam(params.get('bH'), 1)
  const maxH = parseIntegerParam(params.get('maxH'), 1)
  const ov = parseIntegerParam(params.get('ov'), 0)

  const rotRaw = params.get('rot')
  let rot: boolean | null = null
  let rotInvalid = false

  if (rotRaw === '1') {
    rot = true
  } else if (rotRaw === '0') {
    rot = false
  } else if (rotRaw !== null) {
    rotInvalid = true
  }

  const invalidValues = [pL, pW, pH, bL, bW, bH, maxH, ov].some((value) =>
    Number.isNaN(value),
  ) || rotInvalid

  if (invalidValues) {
    return {
      input: cloneSolverInput(defaults),
      mode,
      warning: 'Parametros de enlace invalidos. Se usaron valores por defecto.',
    }
  }

  return {
    input: {
      pallet: {
        length: pL ?? defaults.pallet.length,
        width: pW ?? defaults.pallet.width,
        height: pH ?? defaults.pallet.height,
      },
      box: {
        length: bL ?? defaults.box.length,
        width: bW ?? defaults.box.width,
        height: bH ?? defaults.box.height,
      },
      maxTotalHeight: maxH ?? defaults.maxTotalHeight,
      allowRotation: rot === null ? defaults.allowRotation : rot,
      overhang: ov ?? defaults.overhang,
    },
    mode,
    warning: null,
  }
}

export function buildShareQuery(input: SolverInput, mode: ShareMode) {
  const params = new URLSearchParams()
  params.set('pL', String(input.pallet.length))
  params.set('pW', String(input.pallet.width))
  params.set('pH', String(input.pallet.height))
  params.set('bL', String(input.box.length))
  params.set('bW', String(input.box.width))
  params.set('bH', String(input.box.height))
  params.set('maxH', String(input.maxTotalHeight))
  params.set('rot', input.allowRotation ? '1' : '0')
  params.set('ov', String(input.overhang))
  params.set('mode', mode)

  return `?${params.toString()}`
}
