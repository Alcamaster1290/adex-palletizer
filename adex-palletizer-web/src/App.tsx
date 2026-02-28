import { useMemo, useState } from 'react'
import { MIN_MASTER_BOX } from './constants'
import { exportJson } from './export/exportJson'
import { exportPng } from './export/exportPng'
import { buildMultiPreview } from './multiPreview'
import {
  SCENARIO_LIMIT,
  createScenarioId,
  getNextScenarioName,
  loadStoredScenarios,
  saveStoredScenarios,
  type StoredScenario,
} from './scenarios'
import { Scene } from './scene/Scene'
import { SceneMulti } from './scene/SceneMulti'
import { buildShareQuery, parseShareLinkInput } from './shareLink'
import { solvePalletization } from './solver'
import { TopViewLayer } from './top-view/TopViewLayer'
import { solveMultiHeuristic } from './multiSolver'
import type {
  DimensionsMM,
  MultiBoxTypeInput,
  MultiPreviewInput,
  MultiPreviewResult,
  MultiSkuInput,
  SolverInput,
} from './types'

const DEFAULT_INPUT: SolverInput = {
  pallet: { length: 1200, width: 1000, height: 150 },
  box: {
    length: MIN_MASTER_BOX.length,
    width: MIN_MASTER_BOX.width,
    height: MIN_MASTER_BOX.height,
  },
  maxTotalHeight: 1200,
  allowRotation: true,
  overhang: 0,
}

type BoxSection = 'pallet' | 'box'
type TabKey = 'single' | 'multi'
type FieldErrors = Record<string, string>
type PalletPresetKey = 'american' | 'euro' | 'custom'

type SingleFieldId =
  | 'pallet-length'
  | 'pallet-width'
  | 'pallet-height'
  | 'box-length'
  | 'box-width'
  | 'box-height'
  | 'max-total-height'
  | 'overhang'

type SingleFieldValues = Record<SingleFieldId, string>

interface MultiDraftState {
  pallet: DimensionsMM
  maxTotalHeight: number
  allowRotation: boolean
  overhang: number
  skus: MultiSkuInput[]
}

interface NumberFieldProps {
  id: string
  label: string
  value: string
  error?: string
  min?: number
  max?: number
  step?: number
  unit?: string
  onChange: (value: string) => void
}

interface IntegerValidationConfig {
  label: string
  min: number
  max?: number
}

interface ValidationResult {
  value: number | null
  error: string | null
}

const PALLET_PRESET_OPTIONS: Array<{
  key: PalletPresetKey
  label: string
  pallet?: DimensionsMM
}> = [
  {
    key: 'american',
    label: 'American 1200x1000x150',
    pallet: { length: 1200, width: 1000, height: 150 },
  },
  {
    key: 'euro',
    label: 'Euro 1200x800x144',
    pallet: { length: 1200, width: 800, height: 144 },
  },
  {
    key: 'custom',
    label: 'Custom',
  },
]

function getPresetPalletDimensions(
  preset: PalletPresetKey,
): DimensionsMM | null {
  const option = PALLET_PRESET_OPTIONS.find((item) => item.key === preset)
  return option?.pallet ?? null
}

function detectPalletPreset(pallet: DimensionsMM): PalletPresetKey {
  const matched = PALLET_PRESET_OPTIONS.find((item) => {
    if (!item.pallet) {
      return false
    }

    return (
      item.pallet.length === pallet.length &&
      item.pallet.width === pallet.width &&
      item.pallet.height === pallet.height
    )
  })

  return matched?.key ?? 'custom'
}

function NumberField({
  id,
  label,
  value,
  error,
  min,
  max,
  step = 1,
  unit = 'mm',
  onChange,
}: NumberFieldProps) {
  return (
    <label className="field" htmlFor={id}>
      <span>
        {label}
        <strong>{unit}</strong>
      </span>
      <input
        id={id}
        type="number"
        step={step}
        min={min}
        max={max}
        value={value}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => {
          onChange(event.target.value)
        }}
      />
      {error && (
        <small id={`${id}-error`} className="field-error" role="alert">
          {error}
        </small>
      )}
    </label>
  )
}

function createDefaultMultiSku(
  id: number,
  overrides?: Partial<MultiSkuInput>,
): MultiSkuInput {
  const normalizedId = overrides?.id ?? id
  const skuId = overrides?.skuId ?? `SKU-${normalizedId}`

  return {
    id: normalizedId,
    skuId,
    name: overrides?.name ?? `Producto ${normalizedId}`,
    length: overrides?.length ?? MIN_MASTER_BOX.length,
    width: overrides?.width ?? MIN_MASTER_BOX.width,
    height: overrides?.height ?? MIN_MASTER_BOX.height,
    quantity: overrides?.quantity ?? 4,
    allowRotation: overrides?.allowRotation ?? true,
    color: overrides?.color,
    maxLayers: overrides?.maxLayers,
    noStack: overrides?.noStack,
  }
}

const DEFAULT_MULTI_STATE: MultiDraftState = {
  pallet: { length: 1200, width: 1000, height: 150 },
  maxTotalHeight: 1200,
  allowRotation: true,
  overhang: 0,
  skus: [
    createDefaultMultiSku(1, { name: 'Caja A', quantity: 8, color: '#2f8f9d' }),
    createDefaultMultiSku(2, { name: 'Caja B', quantity: 10, color: '#e67e22' }),
  ],
}

function cloneInput(input: SolverInput): SolverInput {
  return {
    pallet: { ...input.pallet },
    box: { ...input.box },
    maxTotalHeight: input.maxTotalHeight,
    allowRotation: input.allowRotation,
    overhang: input.overhang,
  }
}

function cloneMultiState(state: MultiDraftState): MultiDraftState {
  return {
    pallet: { ...state.pallet },
    maxTotalHeight: state.maxTotalHeight,
    allowRotation: state.allowRotation,
    overhang: state.overhang,
    skus: state.skus.map((sku) => ({ ...sku })),
  }
}

function cloneMultiPreviewInput(state: MultiDraftState): MultiPreviewInput {
  return {
    pallet: { ...state.pallet },
    maxTotalHeight: state.maxTotalHeight,
    overhang: state.overhang,
    allowRotation: state.allowRotation,
    skus: state.skus.map((sku) => ({ ...sku })),
  }
}

function isLegacyMultiBoxType(value: unknown): value is MultiBoxTypeInput {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.id === 'number' &&
    typeof candidate.length === 'number' &&
    typeof candidate.width === 'number' &&
    typeof candidate.height === 'number' &&
    typeof candidate.units === 'number'
  )
}

function normalizeMultiInput(input: MultiPreviewInput | Record<string, unknown>): MultiDraftState {
  const candidate = input as Partial<MultiPreviewInput>
  const fallback = DEFAULT_MULTI_STATE
  const base = {
    pallet: { ...(candidate.pallet ?? fallback.pallet) },
    maxTotalHeight: candidate.maxTotalHeight ?? fallback.maxTotalHeight,
    allowRotation: candidate.allowRotation ?? fallback.allowRotation,
    overhang: candidate.overhang ?? fallback.overhang,
  }

  const rawSkus = candidate.skus
  if (Array.isArray(rawSkus) && rawSkus.length > 0) {
    return {
      ...base,
      skus: rawSkus.map((sku, index) =>
        createDefaultMultiSku(index + 1, {
          id: sku.id,
          skuId: sku.skuId,
          name: sku.name,
          length: sku.length,
          width: sku.width,
          height: sku.height,
          quantity: sku.quantity,
          allowRotation: sku.allowRotation,
          color: sku.color,
          maxLayers: sku.maxLayers,
          noStack: sku.noStack,
        }),
      ),
    }
  }

  const rawLegacy = (input as { boxTypes?: unknown[] }).boxTypes
  if (Array.isArray(rawLegacy) && rawLegacy.length > 0) {
    const legacySkus = rawLegacy
      .filter(isLegacyMultiBoxType)
      .map((boxType, index) =>
        createDefaultMultiSku(index + 1, {
          id: boxType.id,
          skuId: `SKU-${boxType.id}`,
          name: `SKU ${index + 1}`,
          length: boxType.length,
          width: boxType.width,
          height: boxType.height,
          quantity: boxType.units,
          allowRotation: true,
        }),
      )

    return {
      ...base,
      skus: legacySkus,
    }
  }

  return {
    ...base,
    skus: [],
  }
}

function areInputsEqual(left: SolverInput, right: SolverInput) {
  return (
    left.pallet.length === right.pallet.length &&
    left.pallet.width === right.pallet.width &&
    left.pallet.height === right.pallet.height &&
    left.box.length === right.box.length &&
    left.box.width === right.box.width &&
    left.box.height === right.box.height &&
    left.maxTotalHeight === right.maxTotalHeight &&
    left.allowRotation === right.allowRotation &&
    left.overhang === right.overhang
  )
}

function areMultiStatesEqual(left: MultiDraftState, right: MultiDraftState) {
  if (
    left.pallet.length !== right.pallet.length ||
    left.pallet.width !== right.pallet.width ||
    left.pallet.height !== right.pallet.height ||
    left.maxTotalHeight !== right.maxTotalHeight ||
    left.allowRotation !== right.allowRotation ||
    left.overhang !== right.overhang ||
    left.skus.length !== right.skus.length
  ) {
    return false
  }

  for (let index = 0; index < left.skus.length; index += 1) {
    const leftType = left.skus[index]
    const rightType = right.skus[index]
    if (
      leftType.id !== rightType.id ||
      leftType.skuId !== rightType.skuId ||
      leftType.name !== rightType.name ||
      leftType.length !== rightType.length ||
      leftType.width !== rightType.width ||
      leftType.height !== rightType.height ||
      leftType.quantity !== rightType.quantity ||
      leftType.allowRotation !== rightType.allowRotation ||
      leftType.color !== rightType.color
    ) {
      return false
    }
  }

  return true
}

function validateIntegerInput(
  rawValue: string,
  config: IntegerValidationConfig,
): ValidationResult {
  const value = rawValue.trim()

  if (value.length === 0) {
    return {
      value: null,
      error: `${config.label} es obligatorio.`,
    }
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return {
      value: null,
      error: `${config.label} debe ser numerico.`,
    }
  }

  if (!Number.isInteger(parsed)) {
    return {
      value: null,
      error: `${config.label} debe ser un entero.`,
    }
  }

  if (parsed < config.min) {
    return {
      value: null,
      error: `${config.label} debe ser mayor o igual a ${config.min}.`,
    }
  }

  if (config.max !== undefined && parsed > config.max) {
    return {
      value: null,
      error: `${config.label} debe ser menor o igual a ${config.max}.`,
    }
  }

  return {
    value: parsed,
    error: null,
  }
}

function upsertFieldError(
  currentErrors: FieldErrors,
  fieldId: string,
  error: string | null,
): FieldErrors {
  const next = { ...currentErrors }
  if (error) {
    next[fieldId] = error
  } else {
    delete next[fieldId]
  }
  return next
}

function buildSingleFieldValues(input: SolverInput): SingleFieldValues {
  return {
    'pallet-length': String(input.pallet.length),
    'pallet-width': String(input.pallet.width),
    'pallet-height': String(input.pallet.height),
    'box-length': String(input.box.length),
    'box-width': String(input.box.width),
    'box-height': String(input.box.height),
    'max-total-height': String(input.maxTotalHeight),
    overhang: String(input.overhang),
  }
}

function getMultiSkuFieldId(
  skuId: number,
  field:
    | 'skuId'
    | 'name'
    | 'length'
    | 'width'
    | 'height'
    | 'quantity'
    | 'color',
) {
  return `multi-sku-${field}-${skuId}`
}

function buildMultiFieldValues(state: MultiDraftState): Record<string, string> {
  const values: Record<string, string> = {
    'multi-pallet-length': String(state.pallet.length),
    'multi-pallet-width': String(state.pallet.width),
    'multi-pallet-height': String(state.pallet.height),
    'multi-max-total-height': String(state.maxTotalHeight),
    'multi-overhang': String(state.overhang),
  }

  state.skus.forEach((sku) => {
    values[getMultiSkuFieldId(sku.id, 'skuId')] = sku.skuId
    values[getMultiSkuFieldId(sku.id, 'name')] = sku.name
    values[getMultiSkuFieldId(sku.id, 'length')] = String(sku.length)
    values[getMultiSkuFieldId(sku.id, 'width')] = String(sku.width)
    values[getMultiSkuFieldId(sku.id, 'height')] = String(sku.height)
    values[getMultiSkuFieldId(sku.id, 'quantity')] = String(sku.quantity)
    values[getMultiSkuFieldId(sku.id, 'color')] = sku.color ?? ''
  })

  return values
}

function buildMultiAllowedFieldIds(state: MultiDraftState): Set<string> {
  return new Set(Object.keys(buildMultiFieldValues(state)))
}

const formatInt = new Intl.NumberFormat('es-ES')
const percentFormatter = new Intl.NumberFormat('es-ES', {
  maximumFractionDigits: 2,
})
const formatPercent = (value: number) => `${percentFormatter.format(value * 100)}%`

function App() {
  const initialShareState = useMemo(
    () => parseShareLinkInput(window.location.search, DEFAULT_INPUT),
    [],
  )

  const [activeTab, setActiveTab] = useState<TabKey>(initialShareState.mode)
  const [shareWarning] = useState<string | null>(initialShareState.warning)
  const [shareStatus, setShareStatus] = useState<string | null>(null)

  const [draftInput, setDraftInput] = useState<SolverInput>(() =>
    cloneInput(initialShareState.input),
  )
  const [singlePalletPreset, setSinglePalletPreset] =
    useState<PalletPresetKey>(() => detectPalletPreset(initialShareState.input.pallet))
  const [singleFieldValues, setSingleFieldValues] = useState<SingleFieldValues>(() =>
    buildSingleFieldValues(initialShareState.input),
  )
  const [singleFieldErrors, setSingleFieldErrors] = useState<FieldErrors>({})
  const [appliedInput, setAppliedInput] = useState<SolverInput>(() =>
    cloneInput(initialShareState.input),
  )
  const [singleCanvas, setSingleCanvas] = useState<HTMLCanvasElement | null>(null)
  const [lastCalculatedAt, setLastCalculatedAt] = useState<Date>(new Date())

  const [multiDraft, setMultiDraft] = useState<MultiDraftState>(DEFAULT_MULTI_STATE)
  const [multiPalletPreset, setMultiPalletPreset] =
    useState<PalletPresetKey>('american')
  const [multiFieldValues, setMultiFieldValues] = useState<Record<string, string>>(() =>
    buildMultiFieldValues(DEFAULT_MULTI_STATE),
  )
  const [multiFieldErrors, setMultiFieldErrors] = useState<FieldErrors>({})
  const [multiApplied, setMultiApplied] = useState<MultiDraftState>(DEFAULT_MULTI_STATE)
  const [lastGeneratedAt, setLastGeneratedAt] = useState<Date>(new Date())
  const [multiShowLabels, setMultiShowLabels] = useState(false)
  const [multiAlgorithm, setMultiAlgorithm] = useState<'preview' | 'heuristic'>(
    'preview',
  )
  const [multiHeuristicResult, setMultiHeuristicResult] =
    useState<MultiPreviewResult | null>(null)
  const [scenarios, setScenarios] = useState<StoredScenario[]>(() =>
    loadStoredScenarios(),
  )
  const [scenarioNotice, setScenarioNotice] = useState<string | null>(null)

  const result = useMemo(() => solvePalletization(appliedInput), [appliedInput])
  const multiAppliedInput = useMemo(
    () => cloneMultiPreviewInput(multiApplied),
    [multiApplied],
  )
  const multiPreviewResult = useMemo(
    () => buildMultiPreview(multiAppliedInput),
    [multiAppliedInput],
  )
  const multiResult =
    multiAlgorithm === 'heuristic' && multiHeuristicResult
      ? multiHeuristicResult
      : multiPreviewResult

  const singleHasValidationErrors = Object.keys(singleFieldErrors).length > 0
  const multiHasValidationErrors = Object.keys(multiFieldErrors).length > 0

  const hasPendingSingle = useMemo(
    () => singleHasValidationErrors || !areInputsEqual(draftInput, appliedInput),
    [draftInput, appliedInput, singleHasValidationErrors],
  )
  const hasPendingMulti = useMemo(
    () => multiHasValidationErrors || !areMultiStatesEqual(multiDraft, multiApplied),
    [multiDraft, multiApplied, multiHasValidationErrors],
  )

  const setSingleValueAndValidation = (
    fieldId: SingleFieldId,
    rawValue: string,
    config: IntegerValidationConfig,
    applyValue: (value: number) => void,
  ) => {
    setSingleFieldValues((current) => ({
      ...current,
      [fieldId]: rawValue,
    }))

    const validation = validateIntegerInput(rawValue, config)
    setSingleFieldErrors((current) =>
      upsertFieldError(current, fieldId, validation.error),
    )

    if (validation.value !== null) {
      applyValue(validation.value)
    }
  }

  const applySinglePalletPreset = (preset: PalletPresetKey) => {
    setSinglePalletPreset(preset)
    const presetPallet = getPresetPalletDimensions(preset)
    if (presetPallet === null) {
      return
    }

    setDraftInput((current) => ({
      ...current,
      pallet: { ...presetPallet },
    }))
    setAppliedInput((current) => ({
      ...current,
      pallet: { ...presetPallet },
    }))
    setSingleFieldValues((current) => ({
      ...current,
      'pallet-length': String(presetPallet.length),
      'pallet-width': String(presetPallet.width),
      'pallet-height': String(presetPallet.height),
    }))
    setSingleFieldErrors((current) => {
      const next = { ...current }
      delete next['pallet-length']
      delete next['pallet-width']
      delete next['pallet-height']
      return next
    })
    setLastCalculatedAt(new Date())
  }

  const updateSingleDimensions = (
    fieldId: SingleFieldId,
    section: BoxSection,
    key: keyof DimensionsMM,
    value: string,
  ) => {
    if (section === 'pallet' && singlePalletPreset !== 'custom') {
      setSinglePalletPreset('custom')
    }

    const minValue = section === 'box' ? MIN_MASTER_BOX[key] : 1
    const label =
      section === 'box'
        ? `El ${key === 'length' ? 'largo' : key === 'width' ? 'ancho' : 'alto'} de la caja`
        : `El ${key === 'length' ? 'largo' : key === 'width' ? 'ancho' : 'alto'} del pallet`

    setSingleValueAndValidation(
      fieldId,
      value,
      {
        label,
        min: minValue,
      },
      (nextValue) => {
        setDraftInput((current) => ({
          ...current,
          [section]: {
            ...current[section],
            [key]: nextValue,
          },
        }))
      },
    )
  }

  const updateSingleInputField = (
    fieldId: SingleFieldId,
    field: 'maxTotalHeight' | 'overhang',
    value: string,
  ) => {
    const config: IntegerValidationConfig =
      field === 'maxTotalHeight'
        ? {
            label: 'La altura maxima total',
            min: 1,
          }
        : {
            label: 'El overhang',
            min: 0,
          }

    setSingleValueAndValidation(fieldId, value, config, (nextValue) => {
      setDraftInput((current) => ({
        ...current,
        [field]: nextValue,
      }))
    })
  }

  const runSingleCalculation = () => {
    if (singleHasValidationErrors) {
      return
    }

    setAppliedInput(cloneInput(draftInput))
    setLastCalculatedAt(new Date())
    setShareStatus(null)
  }

  const resetSingle = () => {
    const next = cloneInput(DEFAULT_INPUT)
    setDraftInput(next)
    setAppliedInput(next)
    setSinglePalletPreset('american')
    setSingleFieldValues(buildSingleFieldValues(next))
    setSingleFieldErrors({})
    setLastCalculatedAt(new Date())
    setShareStatus(null)
  }

  const setMultiValueAndValidation = (
    fieldId: string,
    rawValue: string,
    config: IntegerValidationConfig,
    applyValue: (value: number) => void,
  ) => {
    setMultiFieldValues((current) => ({
      ...current,
      [fieldId]: rawValue,
    }))

    const validation = validateIntegerInput(rawValue, config)
    setMultiFieldErrors((current) =>
      upsertFieldError(current, fieldId, validation.error),
    )

    if (validation.value !== null) {
      applyValue(validation.value)
    }
  }

  const updateMultiPallet = (field: keyof DimensionsMM, value: string) => {
    if (multiPalletPreset !== 'custom') {
      setMultiPalletPreset('custom')
    }

    const fieldId = `multi-pallet-${field}`
    const label = `El ${field === 'length' ? 'largo' : field === 'width' ? 'ancho' : 'alto'} del pallet`

    setMultiValueAndValidation(
      fieldId,
      value,
      {
        label,
        min: 1,
      },
      (nextValue) => {
        setMultiDraft((current) => ({
          ...current,
          pallet: {
            ...current.pallet,
            [field]: nextValue,
          },
        }))
      },
    )
  }

  const updateMultiCommon = (
    field: 'maxTotalHeight' | 'overhang' | 'allowRotation',
    value: string | boolean,
  ) => {
    if (field === 'allowRotation') {
      setMultiDraft((current) => ({
        ...current,
        allowRotation: Boolean(value),
      }))
      return
    }

    const fieldId =
      field === 'maxTotalHeight' ? 'multi-max-total-height' : 'multi-overhang'
    const config: IntegerValidationConfig =
      field === 'maxTotalHeight'
        ? {
            label: 'La altura maxima total',
            min: 1,
          }
        : {
            label: 'El overhang',
            min: 0,
          }

    setMultiValueAndValidation(fieldId, String(value), config, (nextValue) => {
      setMultiDraft((current) => ({
        ...current,
        [field]: nextValue,
      }))
    })
  }

  const applyMultiPalletPreset = (preset: PalletPresetKey) => {
    setMultiPalletPreset(preset)
    const presetPallet = getPresetPalletDimensions(preset)
    if (presetPallet === null) {
      return
    }

    setMultiDraft((current) => ({
      ...current,
      pallet: { ...presetPallet },
    }))
    setMultiApplied((current) => ({
      ...current,
      pallet: { ...presetPallet },
    }))
    setMultiFieldValues((current) => ({
      ...current,
      'multi-pallet-length': String(presetPallet.length),
      'multi-pallet-width': String(presetPallet.width),
      'multi-pallet-height': String(presetPallet.height),
    }))
    setMultiFieldErrors((current) => {
      const next = { ...current }
      delete next['multi-pallet-length']
      delete next['multi-pallet-width']
      delete next['multi-pallet-height']
      return next
    })
    setLastGeneratedAt(new Date())
  }

  const updateMultiSkuText = (
    index: number,
    field: 'skuId' | 'name' | 'color',
    value: string,
  ) => {
    const currentSku = multiDraft.skus[index]
    if (!currentSku) {
      return
    }

    const fieldId = getMultiSkuFieldId(currentSku.id, field)
    setMultiFieldValues((current) => ({
      ...current,
      [fieldId]: value,
    }))

    if (field === 'color') {
      const normalizedColor = value.trim()
      const isValidColor =
        normalizedColor.length === 0 || /^#?[0-9a-fA-F]{6}$/.test(normalizedColor)
      setMultiFieldErrors((current) =>
        upsertFieldError(
          current,
          fieldId,
          isValidColor ? null : 'Color invalido. Usa formato HEX, por ejemplo #2f8f9d.',
        ),
      )
      if (!isValidColor) {
        return
      }
    } else {
      const isValid = value.trim().length > 0
      setMultiFieldErrors((current) =>
        upsertFieldError(
          current,
          fieldId,
          isValid ? null : `${field === 'name' ? 'Nombre' : 'SKU ID'} es obligatorio.`,
        ),
      )
      if (!isValid) {
        return
      }
    }

    setMultiDraft((current) => ({
      ...current,
      skus: current.skus.map((item, rowIndex) => {
        if (rowIndex !== index) {
          return item
        }

        if (field === 'color') {
          const normalized = value.trim()
          return {
            ...item,
            color:
              normalized.length > 0
                ? normalized.startsWith('#')
                  ? normalized
                  : `#${normalized}`
                : undefined,
          }
        }

        return {
          ...item,
          [field]: value,
        }
      }),
    }))
  }

  const updateMultiSkuNumber = (
    index: number,
    field: 'length' | 'width' | 'height' | 'quantity',
    value: string,
  ) => {
    const currentSku = multiDraft.skus[index]
    if (!currentSku) {
      return
    }

    const fieldId = getMultiSkuFieldId(currentSku.id, field)
    const config: IntegerValidationConfig =
      field === 'quantity'
        ? {
            label: `Cantidad del SKU ${index + 1}`,
            min: 1,
          }
        : {
            label: `${
              field === 'length' ? 'Largo' : field === 'width' ? 'Ancho' : 'Alto'
            } del SKU ${index + 1}`,
            min: 1,
          }

    setMultiValueAndValidation(fieldId, value, config, (nextValue) => {
      setMultiDraft((current) => ({
        ...current,
        skus: current.skus.map((item, rowIndex) => {
          if (rowIndex !== index) {
            return item
          }

          return {
            ...item,
            [field]: nextValue,
          }
        }),
      }))
    })
  }

  const updateMultiSkuRotation = (index: number, checked: boolean) => {
    setMultiDraft((current) => ({
      ...current,
      skus: current.skus.map((item, rowIndex) =>
        rowIndex === index
          ? {
              ...item,
              allowRotation: checked,
            }
          : item,
      ),
    }))
  }

  const addMultiSku = () => {
    if (multiDraft.skus.length >= 20) {
      setScenarioNotice('Limite de 20 SKUs alcanzado para el preview multicaja.')
      return
    }

    const nextId =
      multiDraft.skus.reduce((maxId, sku) => Math.max(maxId, sku.id), 0) + 1
    const nextSku = createDefaultMultiSku(nextId, {
      quantity: 1,
      name: `Producto ${nextId}`,
    })

    const nextDraft: MultiDraftState = {
      ...multiDraft,
      skus: [...multiDraft.skus, nextSku],
    }
    setMultiDraft(nextDraft)
    setMultiFieldValues(buildMultiFieldValues(nextDraft))
    setMultiFieldErrors((current) => {
      const next = { ...current }
      delete next['multi-skus-empty']
      return next
    })
    setScenarioNotice(null)
  }

  const removeMultiSku = (index: number) => {
    const target = multiDraft.skus[index]
    if (!target) {
      return
    }

    const nextDraft: MultiDraftState = {
      ...multiDraft,
      skus: multiDraft.skus.filter((_, rowIndex) => rowIndex !== index),
    }

    setMultiDraft(nextDraft)
    setMultiFieldValues(buildMultiFieldValues(nextDraft))

    const allowedKeys = buildMultiAllowedFieldIds(nextDraft)
    setMultiFieldErrors((current) => {
      const filtered: FieldErrors = {}
      Object.entries(current).forEach(([key, error]) => {
        if (allowedKeys.has(key)) {
          filtered[key] = error
        }
      })
      if (nextDraft.skus.length > 0) {
        delete filtered['multi-skus-empty']
      }
      return filtered
    })
    setScenarioNotice(null)
  }

  const clearMultiSkus = () => {
    const nextDraft: MultiDraftState = {
      ...multiDraft,
      skus: [],
    }
    setMultiDraft(nextDraft)
    setMultiFieldValues(buildMultiFieldValues(nextDraft))
    setMultiFieldErrors((current) => ({
      ...current,
      'multi-skus-empty': 'Agrega al menos un SKU para generar la vista.',
    }))
  }

  const generateMulti3D = () => {
    if (multiHasValidationErrors || multiDraft.skus.length === 0) {
      if (multiDraft.skus.length === 0) {
        setMultiFieldErrors((current) => ({
          ...current,
          'multi-skus-empty': 'Agrega al menos un SKU para generar la vista.',
        }))
      }
      return
    }

    setMultiFieldErrors((current) => {
      const next = { ...current }
      delete next['multi-skus-empty']
      return next
    })
    setMultiApplied(cloneMultiState(multiDraft))
    setMultiAlgorithm('preview')
    setMultiHeuristicResult(null)
    setLastGeneratedAt(new Date())
  }

  const solveMulti3DHeuristic = () => {
    if (multiHasValidationErrors || multiDraft.skus.length === 0) {
      if (multiDraft.skus.length === 0) {
        setMultiFieldErrors((current) => ({
          ...current,
          'multi-skus-empty': 'Agrega al menos un SKU para resolver.',
        }))
      }
      return
    }

    try {
      const input = cloneMultiPreviewInput(multiDraft)
      const result = solveMultiHeuristic(input)
      if (result.errors.length > 0) {
        setScenarioNotice('La heuristica encontro errores de entrada. Se mantiene el preview.')
        return
      }

      setMultiApplied(cloneMultiState(multiDraft))
      setMultiAlgorithm('heuristic')
      setMultiHeuristicResult(result)
      setScenarioNotice(null)
      setLastGeneratedAt(new Date())
    } catch {
      setScenarioNotice('No se pudo ejecutar la heuristica. Se mantiene el preview multicaja.')
      setMultiAlgorithm('preview')
      setMultiHeuristicResult(null)
    }
  }

  const resetMulti = () => {
    const next = cloneMultiState(DEFAULT_MULTI_STATE)
    setMultiDraft(next)
    setMultiApplied(next)
    setMultiPalletPreset('american')
    setMultiFieldValues(buildMultiFieldValues(next))
    setMultiFieldErrors({})
    setMultiAlgorithm('preview')
    setMultiHeuristicResult(null)
    setLastGeneratedAt(new Date())
    setScenarioNotice(null)
  }

  const persistScenarios = (nextScenarios: StoredScenario[]) => {
    setScenarios(nextScenarios)
    saveStoredScenarios(nextScenarios)
  }

  const saveCurrentScenario = () => {
    if (scenarios.length >= SCENARIO_LIMIT) {
      setScenarioNotice(
        `Limite de ${SCENARIO_LIMIT} escenarios alcanzado. Elimina uno para continuar.`,
      )
      return
    }

    const baseScenario = {
      id: createScenarioId(),
      name: getNextScenarioName(scenarios),
      createdAt: new Date().toISOString(),
    }

    const scenario: StoredScenario =
      activeTab === 'single'
        ? {
            ...baseScenario,
            mode: 'single',
            single: {
              input: cloneInput(appliedInput),
              result: solvePalletization(cloneInput(appliedInput)),
            },
          }
        : {
            ...baseScenario,
            mode: 'multi',
            multi: {
              input: cloneMultiPreviewInput(multiApplied),
              result: multiResult,
            },
          }

    const nextScenarios = [scenario, ...scenarios]
    persistScenarios(nextScenarios)
    setScenarioNotice(`Escenario guardado: ${scenario.name}`)
  }

  const loadScenario = (scenario: StoredScenario) => {
    setScenarioNotice(null)

    if (scenario.mode === 'single') {
      const nextInput = cloneInput(scenario.single.input)
      setActiveTab('single')
      setSinglePalletPreset(detectPalletPreset(nextInput.pallet))
      setDraftInput(nextInput)
      setAppliedInput(nextInput)
      setSingleFieldValues(buildSingleFieldValues(nextInput))
      setSingleFieldErrors({})
      setMultiAlgorithm('preview')
      setMultiHeuristicResult(null)
      setLastCalculatedAt(new Date())
      return
    }

    const nextMulti = normalizeMultiInput(
      scenario.multi.input as MultiPreviewInput | Record<string, unknown>,
    )
    setActiveTab('multi')
    setMultiPalletPreset(detectPalletPreset(nextMulti.pallet))
    setMultiDraft(nextMulti)
    setMultiApplied(nextMulti)
    setMultiFieldValues(buildMultiFieldValues(nextMulti))
    setMultiFieldErrors({})
    const loadedAlgorithm = scenario.multi.result.algorithm ?? 'preview'
    setMultiAlgorithm(loadedAlgorithm === 'heuristic' ? 'heuristic' : 'preview')
    setMultiHeuristicResult(
      loadedAlgorithm === 'heuristic' ? scenario.multi.result : null,
    )
    setLastGeneratedAt(new Date())
  }

  const renameScenario = (scenario: StoredScenario) => {
    const nextName = window.prompt('Nuevo nombre del escenario', scenario.name)
    if (!nextName) {
      return
    }

    const cleaned = nextName.trim()
    if (!cleaned) {
      return
    }

    const nextScenarios = scenarios.map((item) =>
      item.id === scenario.id
        ? {
            ...item,
            name: cleaned,
          }
        : item,
    )
    persistScenarios(nextScenarios)
    setScenarioNotice('Escenario renombrado.')
  }

  const deleteScenario = (scenarioId: string) => {
    const nextScenarios = scenarios.filter((scenario) => scenario.id !== scenarioId)
    persistScenarios(nextScenarios)
    setScenarioNotice('Escenario eliminado.')
  }

  const areaUtilizationText = formatPercent(result.selected.utilization)
  const volumeUtilizationText = formatPercent(result.volumeUtilization)

  const shareCurrentSingle = async () => {
    const query = buildShareQuery(appliedInput, 'single')
    const relativeUrl = `${window.location.pathname}${query}`
    const absoluteUrl = `${window.location.origin}${relativeUrl}`
    window.history.replaceState(window.history.state, '', relativeUrl)

    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(absoluteUrl)
        setShareStatus('Enlace copiado al portapapeles.')
        return
      } catch {
        // Si falla el portapapeles, dejamos el enlace en pantalla.
      }
    }

    setShareStatus(`Enlace listo: ${absoluteUrl}`)
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <p className="eyebrow">ADEX PALLETIZER WEB</p>
        <h1>Palletizer con escenarios por tab</h1>
        <p>
          Usa <strong>Caja unica</strong> para solver homogeneo y{' '}
          <strong>Multiples cajas</strong> para preview 3D multicaja.
        </p>
      </header>

      {shareWarning && (
        <div className="notice-box" role="alert">
          <p>{shareWarning}</p>
        </div>
      )}

      <nav className="tab-row" aria-label="Modos de palletizado">
        <button
          type="button"
          className={`tab-button ${activeTab === 'single' ? 'active' : ''}`}
          onClick={() => setActiveTab('single')}
        >
          Caja unica
        </button>
        <button
          type="button"
          className={`tab-button ${activeTab === 'multi' ? 'active' : ''}`}
          onClick={() => setActiveTab('multi')}
        >
          Multiples cajas
        </button>
      </nav>

      {activeTab === 'single' ? (
        <>
          <section className="top-grid">
            <form
              className="panel form-panel"
              onSubmit={(event) => {
                event.preventDefault()
                runSingleCalculation()
              }}
            >
              <div className="form-title-row">
                <h2>Parametros</h2>
                <span className={hasPendingSingle ? 'chip pending' : 'chip ready'}>
                  {hasPendingSingle ? 'Cambios sin calcular' : 'Calculo al dia'}
                </span>
              </div>

              <div className="field-group">
                <h3>Pallet</h3>
                <label className="field" htmlFor="single-pallet-preset">
                  <span>
                    Pallet preset
                    <strong>preset</strong>
                  </span>
                  <select
                    id="single-pallet-preset"
                    value={singlePalletPreset}
                    onChange={(event) =>
                      applySinglePalletPreset(event.target.value as PalletPresetKey)
                    }
                  >
                    {PALLET_PRESET_OPTIONS.map((preset) => (
                      <option key={preset.key} value={preset.key}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </label>
                <NumberField
                  id="pallet-length"
                  label="Largo"
                  min={1}
                  value={singleFieldValues['pallet-length']}
                  error={singleFieldErrors['pallet-length']}
                  onChange={(value) =>
                    updateSingleDimensions('pallet-length', 'pallet', 'length', value)
                  }
                />
                <NumberField
                  id="pallet-width"
                  label="Ancho"
                  min={1}
                  value={singleFieldValues['pallet-width']}
                  error={singleFieldErrors['pallet-width']}
                  onChange={(value) =>
                    updateSingleDimensions('pallet-width', 'pallet', 'width', value)
                  }
                />
                <NumberField
                  id="pallet-height"
                  label="Alto"
                  min={1}
                  value={singleFieldValues['pallet-height']}
                  error={singleFieldErrors['pallet-height']}
                  onChange={(value) =>
                    updateSingleDimensions('pallet-height', 'pallet', 'height', value)
                  }
                />
              </div>

              <div className="field-group">
                <h3>Caja maestra</h3>
                <NumberField
                  id="box-length"
                  label="Largo"
                  min={MIN_MASTER_BOX.length}
                  value={singleFieldValues['box-length']}
                  error={singleFieldErrors['box-length']}
                  onChange={(value) =>
                    updateSingleDimensions('box-length', 'box', 'length', value)
                  }
                />
                <NumberField
                  id="box-width"
                  label="Ancho"
                  min={MIN_MASTER_BOX.width}
                  value={singleFieldValues['box-width']}
                  error={singleFieldErrors['box-width']}
                  onChange={(value) =>
                    updateSingleDimensions('box-width', 'box', 'width', value)
                  }
                />
                <NumberField
                  id="box-height"
                  label="Alto"
                  min={MIN_MASTER_BOX.height}
                  value={singleFieldValues['box-height']}
                  error={singleFieldErrors['box-height']}
                  onChange={(value) =>
                    updateSingleDimensions('box-height', 'box', 'height', value)
                  }
                />
              </div>

              <div className="field-group">
                <h3>Restricciones</h3>
                <NumberField
                  id="max-total-height"
                  label="Altura maxima total"
                  min={1}
                  value={singleFieldValues['max-total-height']}
                  error={singleFieldErrors['max-total-height']}
                  onChange={(value) =>
                    updateSingleInputField('max-total-height', 'maxTotalHeight', value)
                  }
                />
                <NumberField
                  id="overhang"
                  label="Overhang"
                  min={0}
                  value={singleFieldValues.overhang}
                  error={singleFieldErrors.overhang}
                  onChange={(value) =>
                    updateSingleInputField('overhang', 'overhang', value)
                  }
                />
                <label className="checkbox-row" htmlFor="allow-rotation">
                  <input
                    id="allow-rotation"
                    type="checkbox"
                    checked={draftInput.allowRotation}
                    onChange={(event) =>
                      setDraftInput((current) => ({
                        ...current,
                        allowRotation: event.target.checked,
                      }))
                    }
                  />
                  <span>Permitir rotacion 90 grados</span>
                </label>
              </div>

              {singleHasValidationErrors && (
                <p className="form-error">Corrige los campos marcados antes de calcular.</p>
              )}

              <div className="action-row">
                <button type="submit" className="btn-primary" disabled={singleHasValidationErrors}>
                  {hasPendingSingle ? 'Calcular' : 'Recalcular'}
                </button>
                <button type="button" className="btn-secondary" onClick={resetSingle}>
                  Restablecer
                </button>
              </div>
              <p className="meta-text">
                Ultimo calculo:{' '}
                {lastCalculatedAt.toLocaleTimeString('es-ES', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </p>
            </form>

            <article className="panel scene-panel">
              <Scene input={appliedInput} result={result} onCanvasReady={setSingleCanvas} />
            </article>
          </section>

          <section className="panel outputs-panel">
            <div className="outputs-header">
              <h2>Resultados</h2>
              <div className="button-row">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    void shareCurrentSingle()
                  }}
                >
                  Share link
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() =>
                    exportJson({
                      input: appliedInput,
                      result,
                      generatedAt: new Date().toISOString(),
                    })
                  }
                >
                  Export JSON
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => exportPng(singleCanvas)}
                  disabled={singleCanvas === null}
                >
                  Export PNG
                </button>
              </div>
            </div>

            {shareStatus && <p className="meta-text">{shareStatus}</p>}

            <div className="kpi-grid">
              <article className="kpi">
                <span>Total cajas</span>
                <strong>{formatInt.format(result.totalBoxes)}</strong>
              </article>
              <article className="kpi">
                <span>Cajas por capa</span>
                <strong>{formatInt.format(result.selected.perLayer)}</strong>
              </article>
              <article className="kpi">
                <span>Capas</span>
                <strong>{formatInt.format(result.layers)}</strong>
              </article>
              <article className="kpi">
                <span>Altura total</span>
                <strong>{formatInt.format(result.totalHeight)} mm</strong>
              </article>
            </div>

            <TopViewLayer
              palletLength={appliedInput.pallet.length}
              palletWidth={appliedInput.pallet.width}
              selected={result.selected}
              layers={result.layers}
            />

            {result.errors.length > 0 && (
              <div className="error-box">
                {result.errors.map((error) => (
                  <p key={error}>{error}</p>
                ))}
              </div>
            )}

            <table>
              <tbody>
                <tr>
                  <th>Orientacion elegida</th>
                  <td>
                    {result.selected.orientation} ({result.selected.boxFootprintL} x{' '}
                    {result.selected.boxFootprintW})
                  </td>
                </tr>
                <tr>
                  <th>nx</th>
                  <td>{formatInt.format(result.selected.nx)}</td>
                </tr>
                <tr>
                  <th>ny</th>
                  <td>{formatInt.format(result.selected.ny)}</td>
                </tr>
                <tr>
                  <th>Cajas por capa</th>
                  <td>{formatInt.format(result.selected.perLayer)}</td>
                </tr>
                <tr>
                  <th>Capas</th>
                  <td>{formatInt.format(result.layers)}</td>
                </tr>
                <tr>
                  <th>Total cajas</th>
                  <td>{formatInt.format(result.totalBoxes)}</td>
                </tr>
                <tr>
                  <th>Altura total (mm)</th>
                  <td>{formatInt.format(result.totalHeight)}</td>
                </tr>
                <tr>
                  <th>Utilizacion de area (%)</th>
                  <td>{areaUtilizationText}</td>
                </tr>
                <tr>
                  <th>Utilizacion volumetrica (%)</th>
                  <td>{volumeUtilizationText}</td>
                </tr>
                <tr>
                  <th>Area pallet (mm2)</th>
                  <td>{formatInt.format(result.palletArea)}</td>
                </tr>
                <tr>
                  <th>Area ocupada por capa (mm2)</th>
                  <td>{formatInt.format(result.usedArea)}</td>
                </tr>
                <tr>
                  <th>Area libre por capa (mm2)</th>
                  <td>{formatInt.format(result.freeArea)}</td>
                </tr>
                <tr>
                  <th>Altura disponible (mm)</th>
                  <td>{formatInt.format(result.availableHeight)}</td>
                </tr>
                <tr>
                  <th>Holgura de altura (mm)</th>
                  <td>{formatInt.format(result.freeHeight)}</td>
                </tr>
                <tr>
                  <th>Volumen total de cajas (mm3)</th>
                  <td>{formatInt.format(result.totalBoxVolume)}</td>
                </tr>
              </tbody>
            </table>
          </section>
        </>
      ) : (
        <>
          <section className="top-grid">
            <form
              className="panel form-panel"
              onSubmit={(event) => {
                event.preventDefault()
                generateMulti3D()
              }}
            >
              <div className="form-title-row">
                <h2>Configurar multiples cajas</h2>
                <span className={hasPendingMulti ? 'chip pending' : 'chip ready'}>
                  {hasPendingMulti ? 'Cambios sin generar' : 'Vista al dia'}
                </span>
              </div>

              <div className="field-group">
                <h3>Pallet base</h3>
                <label className="field" htmlFor="multi-pallet-preset">
                  <span>
                    Pallet preset
                    <strong>preset</strong>
                  </span>
                  <select
                    id="multi-pallet-preset"
                    value={multiPalletPreset}
                    onChange={(event) =>
                      applyMultiPalletPreset(event.target.value as PalletPresetKey)
                    }
                  >
                    {PALLET_PRESET_OPTIONS.map((preset) => (
                      <option key={preset.key} value={preset.key}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </label>
                <NumberField
                  id="multi-pallet-length"
                  label="Largo"
                  min={1}
                  value={multiFieldValues['multi-pallet-length']}
                  error={multiFieldErrors['multi-pallet-length']}
                  onChange={(value) => updateMultiPallet('length', value)}
                />
                <NumberField
                  id="multi-pallet-width"
                  label="Ancho"
                  min={1}
                  value={multiFieldValues['multi-pallet-width']}
                  error={multiFieldErrors['multi-pallet-width']}
                  onChange={(value) => updateMultiPallet('width', value)}
                />
                <NumberField
                  id="multi-pallet-height"
                  label="Alto"
                  min={1}
                  value={multiFieldValues['multi-pallet-height']}
                  error={multiFieldErrors['multi-pallet-height']}
                  onChange={(value) => updateMultiPallet('height', value)}
                />
              </div>

              <div className="field-group">
                <h3>Restricciones comunes</h3>
                <NumberField
                  id="multi-max-total-height"
                  label="Altura maxima total"
                  min={1}
                  value={multiFieldValues['multi-max-total-height']}
                  error={multiFieldErrors['multi-max-total-height']}
                  onChange={(value) => updateMultiCommon('maxTotalHeight', value)}
                />
                <NumberField
                  id="multi-overhang"
                  label="Overhang"
                  min={0}
                  value={multiFieldValues['multi-overhang']}
                  error={multiFieldErrors['multi-overhang']}
                  onChange={(value) => updateMultiCommon('overhang', value)}
                />
                <label className="checkbox-row" htmlFor="multi-allow-rotation">
                  <input
                    id="multi-allow-rotation"
                    type="checkbox"
                    checked={multiDraft.allowRotation}
                    onChange={(event) =>
                      updateMultiCommon('allowRotation', event.target.checked)
                    }
                  />
                  <span>Permitir rotacion 90 grados por tipo</span>
                </label>
                <label className="checkbox-row" htmlFor="multi-show-labels">
                  <input
                    id="multi-show-labels"
                    type="checkbox"
                    checked={multiShowLabels}
                    onChange={(event) => setMultiShowLabels(event.target.checked)}
                  />
                  <span>Mostrar labels de SKU en 3D</span>
                </label>
              </div>

              <div className="field-group">
                <h3>Catalogo de SKUs</h3>
                <div className="action-row">
                  <button type="button" className="btn-secondary" onClick={addMultiSku}>
                    Add SKU
                  </button>
                  <button type="button" className="btn-secondary" onClick={clearMultiSkus}>
                    Clear
                  </button>
                </div>
              </div>

              <div className="multi-box-list">
                {multiDraft.skus.map((item, index) => (
                  <article key={item.id} className="multi-box-card">
                    <div className="form-title-row">
                      <h4>SKU {index + 1}</h4>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => removeMultiSku(index)}
                      >
                        Remove SKU
                      </button>
                    </div>
                    <label className="field" htmlFor={getMultiSkuFieldId(item.id, 'skuId')}>
                      {(() => {
                        const skuIdField = getMultiSkuFieldId(item.id, 'skuId')
                        return (
                          <>
                            <span>
                              SKU ID
                              <strong>texto</strong>
                            </span>
                            <input
                              id={skuIdField}
                              type="text"
                              value={multiFieldValues[skuIdField] ?? ''}
                              onChange={(event) =>
                                updateMultiSkuText(index, 'skuId', event.target.value)
                              }
                            />
                            {multiFieldErrors[skuIdField] && (
                              <small className="field-error" role="alert">
                                {multiFieldErrors[skuIdField]}
                              </small>
                            )}
                          </>
                        )
                      })()}
                    </label>
                    <label className="field" htmlFor={getMultiSkuFieldId(item.id, 'name')}>
                      {(() => {
                        const nameField = getMultiSkuFieldId(item.id, 'name')
                        return (
                          <>
                            <span>
                              Nombre
                              <strong>texto</strong>
                            </span>
                            <input
                              id={nameField}
                              type="text"
                              value={multiFieldValues[nameField] ?? ''}
                              onChange={(event) =>
                                updateMultiSkuText(index, 'name', event.target.value)
                              }
                            />
                            {multiFieldErrors[nameField] && (
                              <small className="field-error" role="alert">
                                {multiFieldErrors[nameField]}
                              </small>
                            )}
                          </>
                        )
                      })()}
                    </label>
                    <NumberField
                      id={getMultiSkuFieldId(item.id, 'length')}
                      label="Largo"
                      min={1}
                      value={multiFieldValues[getMultiSkuFieldId(item.id, 'length')] ?? ''}
                      error={multiFieldErrors[getMultiSkuFieldId(item.id, 'length')]}
                      onChange={(value) => updateMultiSkuNumber(index, 'length', value)}
                    />
                    <NumberField
                      id={getMultiSkuFieldId(item.id, 'width')}
                      label="Ancho"
                      min={1}
                      value={multiFieldValues[getMultiSkuFieldId(item.id, 'width')] ?? ''}
                      error={multiFieldErrors[getMultiSkuFieldId(item.id, 'width')]}
                      onChange={(value) => updateMultiSkuNumber(index, 'width', value)}
                    />
                    <NumberField
                      id={getMultiSkuFieldId(item.id, 'height')}
                      label="Alto"
                      min={1}
                      value={multiFieldValues[getMultiSkuFieldId(item.id, 'height')] ?? ''}
                      error={multiFieldErrors[getMultiSkuFieldId(item.id, 'height')]}
                      onChange={(value) => updateMultiSkuNumber(index, 'height', value)}
                    />
                    <NumberField
                      id={getMultiSkuFieldId(item.id, 'quantity')}
                      label="Cantidad"
                      min={1}
                      unit="uds"
                      value={multiFieldValues[getMultiSkuFieldId(item.id, 'quantity')] ?? ''}
                      error={multiFieldErrors[getMultiSkuFieldId(item.id, 'quantity')]}
                      onChange={(value) => updateMultiSkuNumber(index, 'quantity', value)}
                    />
                    <label className="field" htmlFor={getMultiSkuFieldId(item.id, 'color')}>
                      {(() => {
                        const colorField = getMultiSkuFieldId(item.id, 'color')
                        return (
                          <>
                            <span>
                              Color HEX
                              <strong>#RRGGBB</strong>
                            </span>
                            <input
                              id={colorField}
                              type="text"
                              value={multiFieldValues[colorField] ?? ''}
                              onChange={(event) =>
                                updateMultiSkuText(index, 'color', event.target.value)
                              }
                            />
                            {multiFieldErrors[colorField] && (
                              <small className="field-error" role="alert">
                                {multiFieldErrors[colorField]}
                              </small>
                            )}
                          </>
                        )
                      })()}
                    </label>
                    <label className="checkbox-row" htmlFor={`multi-sku-rotation-${item.id}`}>
                      <input
                        id={`multi-sku-rotation-${item.id}`}
                        type="checkbox"
                        checked={item.allowRotation}
                        onChange={(event) =>
                          updateMultiSkuRotation(index, event.target.checked)
                        }
                      />
                      <span>Permitir rotacion SKU</span>
                    </label>
                  </article>
                ))}
              </div>

              {multiFieldErrors['multi-skus-empty'] && (
                <p className="form-error">{multiFieldErrors['multi-skus-empty']}</p>
              )}

              {multiHasValidationErrors && (
                <p className="form-error">Corrige los campos marcados antes de generar la vista 3D.</p>
              )}

              <div className="action-row">
                <button type="submit" className="btn-primary" disabled={multiHasValidationErrors}>
                  {hasPendingMulti ? 'Generar 3D' : 'Regenerar 3D'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={solveMulti3DHeuristic}
                  disabled={multiHasValidationErrors}
                >
                  Solve (heuristic)
                </button>
                <button type="button" className="btn-secondary" onClick={resetMulti}>
                  Restablecer
                </button>
              </div>

              <p className="meta-text">
                Ultima generacion:{' '}
                {lastGeneratedAt.toLocaleTimeString('es-ES', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </p>
            </form>

            <article className="panel scene-panel">
              <SceneMulti
                pallet={multiApplied.pallet}
                boxes={multiResult.boxes}
                showLabels={multiShowLabels}
              />
            </article>
          </section>

          <section className="panel outputs-panel">
            <div className="outputs-header">
              <h2>Resultados multicaja</h2>
              <span className={multiResult.unplacedTotal > 0 ? 'chip pending' : 'chip ready'}>
                {multiResult.algorithm === 'heuristic'
                  ? 'Heuristica FFD'
                  : 'Preview por grilla'}
              </span>
            </div>

            <div className="kpi-grid">
              <article className="kpi">
                <span>Solicitadas</span>
                <strong>{formatInt.format(multiResult.requestedTotal)}</strong>
              </article>
              <article className="kpi">
                <span>Ubicadas</span>
                <strong>{formatInt.format(multiResult.placedTotal)}</strong>
              </article>
              <article className="kpi">
                <span>Sin ubicar</span>
                <strong>{formatInt.format(multiResult.unplacedTotal)}</strong>
              </article>
              <article className="kpi">
                <span>Capas usadas</span>
                <strong>{formatInt.format(multiResult.layersUsed)}</strong>
              </article>
            </div>

            {multiResult.errors.length > 0 && (
              <div className="error-box">
                {multiResult.errors.map((error) => (
                  <p key={error}>{error}</p>
                ))}
              </div>
            )}
            {multiResult.warnings.length > 0 && (
              <div className="notice-box">
                {multiResult.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            )}

            <table className="comparison-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Descripcion</th>
                  <th>Solicitadas</th>
                  <th>Ubicadas</th>
                  <th>Sin ubicar</th>
                  <th>No ubicable</th>
                  <th>Capas usadas</th>
                  <th>Rotaciones</th>
                </tr>
              </thead>
              <tbody>
                {multiResult.bySku.map((item) => (
                  <tr key={`multi-summary-${item.id}`}>
                    <td>
                      <span
                        className="color-dot"
                        style={{ backgroundColor: item.color }}
                        aria-hidden="true"
                      />{' '}
                      {item.skuId}
                    </td>
                    <td>{item.name}</td>
                    <td>{formatInt.format(item.requested)}</td>
                    <td>{formatInt.format(item.placed)}</td>
                    <td>{formatInt.format(item.unplaced)}</td>
                    <td>{formatInt.format(item.unplaceable)}</td>
                    <td>{formatInt.format(item.layersUsed)}</td>
                    <td>{formatInt.format(item.rotationsUsed)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="comparison-block">
              <h3>Altura de carga</h3>
              <table>
                <tbody>
                  <tr>
                    <th>Altura disponible (mm)</th>
                    <td>{formatInt.format(multiResult.availableHeight)}</td>
                  </tr>
                  <tr>
                    <th>Altura usada (mm)</th>
                    <td>{formatInt.format(multiResult.heightUsed)}</td>
                  </tr>
                  <tr>
                    <th>Altura libre (mm)</th>
                    <td>{formatInt.format(multiResult.heightFree)}</td>
                  </tr>
                  <tr>
                    <th>Utilizacion aproximada (%)</th>
                    <td>{formatPercent(multiResult.utilization)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <section className="panel outputs-panel">
        <div className="outputs-header">
          <h2>Escenarios guardados</h2>
          <button type="button" className="btn-secondary" onClick={saveCurrentScenario}>
            Save scenario
          </button>
        </div>

        {scenarioNotice && <p className="scenario-note">{scenarioNotice}</p>}

        {scenarios.length === 0 ? (
          <p className="top-view-empty">No hay escenarios guardados.</p>
        ) : (
          <table className="comparison-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Modo</th>
                <th>nx x ny</th>
                <th>Capas</th>
                <th>Total cajas</th>
                <th>Utilizacion</th>
                <th>Altura total</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((scenario) => {
                const nxNy =
                  scenario.mode === 'single'
                    ? `${scenario.single.result.selected.nx} x ${scenario.single.result.selected.ny}`
                    : '-'
                const layers =
                  scenario.mode === 'single'
                    ? String(scenario.single.result.layers)
                    : String(scenario.multi.result.layersUsed ?? '-')
                const totalBoxes =
                  scenario.mode === 'single'
                    ? scenario.single.result.totalBoxes
                    : scenario.multi.result.placedTotal
                const utilization =
                  scenario.mode === 'single'
                    ? formatPercent(scenario.single.result.selected.utilization)
                    : formatPercent(scenario.multi.result.utilization ?? 0)
                const totalHeight =
                  scenario.mode === 'single'
                    ? scenario.single.result.totalHeight
                    : scenario.multi.input.pallet.height + (scenario.multi.result.heightUsed ?? 0)

                return (
                  <tr key={scenario.id}>
                    <td>{scenario.name}</td>
                    <td>{scenario.mode}</td>
                    <td>{nxNy}</td>
                    <td>{layers}</td>
                    <td>{formatInt.format(totalBoxes)}</td>
                    <td>{utilization}</td>
                    <td>{formatInt.format(totalHeight)} mm</td>
                    <td>
                      <div className="scenario-actions">
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => loadScenario(scenario)}
                        >
                          Load
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => renameScenario(scenario)}
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => deleteScenario(scenario.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>
    </main>
  )
}

export default App
