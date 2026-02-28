import type { ContainerInput, SolverInput } from './types'

export type ShareMode = 'single' | 'multi' | 'container'

interface ParseShareResult {
  input: SolverInput
  containerInput: ContainerInput | null
  mode: ShareMode
  warning: string | null
}

const SINGLE_SHARE_KEYS = ['pL', 'pW', 'pH', 'bL', 'bW', 'bH', 'maxH', 'rot', 'ov'] as const
const CONTAINER_SHARE_KEYS = [
  'cPr',
  'cL',
  'cW',
  'cH',
  'ppL',
  'ppW',
  'ppH',
  'cRot',
  'cClr',
  'wpp',
  'pMax',
] as const

function cloneSolverInput(input: SolverInput): SolverInput {
  return {
    pallet: { ...input.pallet },
    box: { ...input.box },
    maxTotalHeight: input.maxTotalHeight,
    allowRotation: input.allowRotation,
    overhang: input.overhang,
  }
}

function cloneContainerInput(input: ContainerInput): ContainerInput {
  return {
    preset: input.preset,
    container: { ...input.container },
    pallet: { ...input.pallet },
    allowRotation: input.allowRotation,
    clearance: input.clearance,
    weightPerPalletKg: input.weightPerPalletKg,
    payloadMaxKg: input.payloadMaxKg,
    allowStacking: input.allowStacking,
  }
}

function parseIntegerParam(value: string | null, min: number): number | null {
  if (value === null) {
    return null
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < min) {
    return NaN
  }

  return parsed
}

function parseOptionalPositiveInteger(value: string | null): number | null {
  if (value === null || value.trim().length === 0) {
    return null
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    return NaN
  }

  return parsed
}

function parseSingleInput(
  params: URLSearchParams,
  defaults: SolverInput,
): { input: SolverInput; warning: string | null } {
  const hasShareParams = SINGLE_SHARE_KEYS.some((key) => params.has(key))
  if (!hasShareParams) {
    return {
      input: cloneSolverInput(defaults),
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

  const invalidValues =
    [pL, pW, pH, bL, bW, bH, maxH, ov].some((value) => Number.isNaN(value)) ||
    rotInvalid

  if (invalidValues) {
    return {
      input: cloneSolverInput(defaults),
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
    warning: null,
  }
}

function parseContainerInput(
  params: URLSearchParams,
  defaults: ContainerInput,
): { input: ContainerInput; warning: string | null } {
  const hasContainerParams = CONTAINER_SHARE_KEYS.some((key) => params.has(key))
  if (!hasContainerParams) {
    return {
      input: cloneContainerInput(defaults),
      warning: null,
    }
  }

  const presetRaw = params.get('cPr')
  const preset =
    presetRaw === '20gp' || presetRaw === '40gp' || presetRaw === '40hc' || presetRaw === 'custom'
      ? presetRaw
      : defaults.preset

  const cL = parseIntegerParam(params.get('cL'), 1)
  const cW = parseIntegerParam(params.get('cW'), 1)
  const cH = parseIntegerParam(params.get('cH'), 1)
  const ppL = parseIntegerParam(params.get('ppL'), 1)
  const ppW = parseIntegerParam(params.get('ppW'), 1)
  const ppH = parseIntegerParam(params.get('ppH'), 1)
  const cClr = parseIntegerParam(params.get('cClr'), 0)
  const wpp = parseOptionalPositiveInteger(params.get('wpp'))
  const pMax = parseOptionalPositiveInteger(params.get('pMax'))

  const cRotRaw = params.get('cRot')
  let cRot: boolean | null = null
  let cRotInvalid = false
  if (cRotRaw === '1') {
    cRot = true
  } else if (cRotRaw === '0') {
    cRot = false
  } else if (cRotRaw !== null) {
    cRotInvalid = true
  }

  const hasInvalidValue =
    [cL, cW, cH, ppL, ppW, ppH, cClr, wpp, pMax].some((value) => Number.isNaN(value)) ||
    cRotInvalid

  if (hasInvalidValue) {
    return {
      input: cloneContainerInput(defaults),
      warning: 'Parametros de enlace invalidos. Se usaron valores por defecto.',
    }
  }

  return {
    input: {
      preset,
      container: {
        length: cL ?? defaults.container.length,
        width: cW ?? defaults.container.width,
        height: cH ?? defaults.container.height,
      },
      pallet: {
        length: ppL ?? defaults.pallet.length,
        width: ppW ?? defaults.pallet.width,
        height: ppH ?? defaults.pallet.height,
      },
      allowRotation: cRot === null ? defaults.allowRotation : cRot,
      clearance: cClr ?? defaults.clearance,
      weightPerPalletKg: wpp ?? undefined,
      payloadMaxKg: pMax ?? undefined,
      allowStacking: defaults.allowStacking,
    },
    warning: null,
  }
}

export function parseShareLinkInput(
  search: string,
  defaults: SolverInput,
  containerDefaults?: ContainerInput,
): ParseShareResult {
  const params = new URLSearchParams(search)
  const modeParam = params.get('mode')
  const mode: ShareMode =
    modeParam === 'multi' ? 'multi' : modeParam === 'container' ? 'container' : 'single'

  const parsedSingle = parseSingleInput(params, defaults)
  const parsedContainer =
    containerDefaults !== undefined
      ? parseContainerInput(params, containerDefaults)
      : { input: null, warning: null }

  const warning = parsedSingle.warning ?? parsedContainer.warning ?? null

  return {
    input: parsedSingle.input,
    containerInput: parsedContainer.input,
    mode,
    warning,
  }
}

function isContainerShareInput(input: SolverInput | ContainerInput): input is ContainerInput {
  return (
    typeof input === 'object' &&
    'container' in input &&
    'pallet' in input &&
    'preset' in input
  )
}

export function buildShareQuery(
  input: SolverInput | ContainerInput,
  mode: ShareMode,
) {
  const params = new URLSearchParams()

  if (mode === 'container' && isContainerShareInput(input)) {
    params.set('mode', 'container')
    params.set('cPr', input.preset)
    params.set('cL', String(input.container.length))
    params.set('cW', String(input.container.width))
    params.set('cH', String(input.container.height))
    params.set('ppL', String(input.pallet.length))
    params.set('ppW', String(input.pallet.width))
    params.set('ppH', String(input.pallet.height))
    params.set('cRot', input.allowRotation ? '1' : '0')
    params.set('cClr', String(input.clearance))
    if (input.weightPerPalletKg !== undefined) {
      params.set('wpp', String(input.weightPerPalletKg))
    }
    if (input.payloadMaxKg !== undefined) {
      params.set('pMax', String(input.payloadMaxKg))
    }
    return `?${params.toString()}`
  }

  if (!isContainerShareInput(input)) {
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

  params.set('mode', mode)
  return `?${params.toString()}`
}
