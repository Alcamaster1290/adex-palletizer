import { useCallback, useEffect, useMemo, useState } from 'react'
import { AuthScreen } from './auth/AuthScreen'
import { AuthProvider } from './auth/AuthContext'
import {
  AuthApiError,
  fetchCurrentSession,
  isRetryableAuthError,
  loginWithPassword,
  registerWithPassword,
  logoutSession,
  type AuthUser,
} from './auth/authApi'
import {
  createEmptyRegistrationDraft,
  validateRegistrationDraft,
  type AuthMode,
  type RegistrationField,
  type RegistrationFieldErrors,
  type RegistrationJobTitle,
  type RegistrationUseCase,
  type RegistrationVolumeBand,
} from './auth/registrationModel'
import {
  BOX_PRESET_OPTIONS,
  detectBoxPreset,
  getBoxPresetDimensions,
  type BoxPresetId,
} from './boxPresets'
import { CONTAINER_CLEARANCE_MM, MIN_MASTER_BOX } from './constants'
import {
  buildContainerPalletCatalogSignature,
  cloneContainerPalletCatalog,
  cloneContainerPalletCatalogEntry,
  detectPalletCatalogColor,
} from './containerCatalog'
import {
  buildExportedPalletLoadFromMulti,
  buildExportedPalletLoadFromSingle,
} from './containerPalletLoad'
import { ContainerTopView } from './container-view/ContainerTopView'
import { solveContainerLoading } from './containerSolver'
import {
  buildContainerTopViewPngFilename,
  exportContainerPlanJson,
} from './export/exportContainerPlan'
import { exportJson } from './export/exportJson'
import {
  buildTradeCaseMulti,
  buildTradeCaseSingle,
  downloadTradeCase,
} from './export/exportTradeCase'
import { exportPng } from './export/exportPng'
import { exportTopViewPng } from './export/exportTopView'
import { LabelDesignerModal } from './labels/LabelDesignerModal'
import {
  normalizeBaseColor,
  normalizeLabelSkuId,
  SINGLE_BOX_SKU_ID,
} from './labels/labelModel'
import {
  deleteSkuLabel,
  loadSkuLabels,
  saveSkuLabels,
  upsertSkuLabel,
} from './labels/labelStorage'
import {
  buildContainerDerivedMetrics,
  buildContainerWeightMetrics,
  buildSingleDerivedMetrics,
  formatAreaDualFromMm2,
  formatAreaM2FromMm2,
  formatWeightDualFromKg,
  formatVolumeDualFromMm3,
  formatVolumeM3FromMm3,
} from './metrics/units'
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
import { SceneContainer } from './scene/SceneContainer'
import { SceneMulti } from './scene/SceneMulti'
import { buildShareQuery, parseShareLinkInput } from './shareLink'
import { buildBoxInstances, solvePalletization } from './solver'
import { solveSingleAdvancedPacking } from './singleAdvancedPacking'
import { TopViewLayer } from './top-view/TopViewLayer'
import { solveMultiHeuristic } from './multiSolver'
import { solveMultiHeuristicNoMix } from './multiSolverNoMix'
import { EditToggleButton } from './components/3d/EditToggleButton'
import { Header } from './components/ui/Header'
import type {
  BoxSkinMode,
  ContainerInput,
  ContainerPalletCatalogEntry,
  ContainerPresetKey,
  DimensionsMM,
  ExportedPalletLoad,
  MultiBoxTypeInput,
  MultiPreviewInput,
  MultiPreviewResult,
  MultiSkuInput,
  PackingMode,
  SkuLabelConfig,
  SkuLabelsBySku,
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

const SISLOPE_URL =
  import.meta.env.VITE_SISLOPE_URL?.trim() || 'https://sis-lo-pe.vercel.app'

const IMPORT_CALC_URL =
  import.meta.env.VITE_IMPORT_CALC_URL?.trim() || 'http://localhost:8501'

const CONTAINER_PRESET_OPTIONS: Array<{
  key: ContainerPresetKey
  label: string
  dimensions?: DimensionsMM
}> = [
  {
    key: '20gp',
    label: "20' GP (5898 x 2352 x 2393)",
    dimensions: { length: 5898, width: 2352, height: 2393 },
  },
  {
    key: '40gp',
    label: "40' GP (12032 x 2352 x 2393)",
    dimensions: { length: 12032, width: 2352, height: 2393 },
  },
  {
    key: '40hc',
    label: "40' HC (12032 x 2352 x 2698)",
    dimensions: { length: 12032, width: 2352, height: 2698 },
  },
  {
    key: 'custom',
    label: 'Personalizado',
  },
]

const DEFAULT_CONTAINER_INPUT: ContainerInput = {
  preset: '20gp',
  container: { length: 5898, width: 2352, height: 2393 },
  pallet: { length: 1200, width: 1000, height: 150 },
  allowRotation: true,
  clearance: CONTAINER_CLEARANCE_MM,
  rearClearance: 0,
  allowAlternatingPattern: true,
  allowStacking: false,
}

const TEST_AUTH_USER: AuthUser = {
  id: 'test-user-id',
  username: 'admin',
  email: 'admin',
  role: 'admin',
  status: 'active',
  mustChangePassword: true,
}

const MIN_SINGLE_BOX_DIMENSION_MM = 50
const MIN_WEIGHT_KG = 0.001

type BoxSection = 'pallet' | 'box'
type TabKey = 'single' | 'multi' | 'container'
type LabelEditorMode = 'single' | 'multi'
type FieldErrors = Record<string, string>
type PalletPresetKey = 'american' | 'euro' | 'custom'
type ContainerPalletSource = 'single' | 'multi'
type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated'

type SingleFieldId =
  | 'pallet-length'
  | 'pallet-width'
  | 'pallet-height'
  | 'pallet-weight'
  | 'box-length'
  | 'box-width'
  | 'box-height'
  | 'box-unit-weight'
  | 'max-total-height'
  | 'overhang'

type SingleFieldValues = Record<SingleFieldId, string>

type ContainerFieldId =
  | 'container-length'
  | 'container-width'
  | 'container-height'
  | 'container-pallet-length'
  | 'container-pallet-width'
  | 'container-pallet-height'
  | 'container-clearance'
  | 'container-weight-per-pallet'
  | 'container-payload-max'

type ContainerFieldValues = Record<ContainerFieldId, string>

interface MultiDraftState {
  pallet: DimensionsMM
  palletWeightKg?: number
  maxTotalHeight: number
  allowRotation: boolean
  overhang: number
  noMixedSkuStacking: boolean
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

interface DecimalValidationConfig {
  label: string
  min: number
  max?: number
  maxDecimals?: number
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
    label: 'Americano 1200x1000x150',
    pallet: { length: 1200, width: 1000, height: 150 },
  },
  {
    key: 'euro',
    label: 'Euro 1200x800x144',
    pallet: { length: 1200, width: 800, height: 144 },
  },
  {
    key: 'custom',
    label: 'Personalizado',
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

function getContainerPresetDimensions(
  preset: ContainerPresetKey,
): DimensionsMM | null {
  const option = CONTAINER_PRESET_OPTIONS.find((item) => item.key === preset)
  return option?.dimensions ?? null
}

function detectContainerPreset(container: DimensionsMM): ContainerPresetKey {
  const matched = CONTAINER_PRESET_OPTIONS.find((item) => {
    if (!item.dimensions) {
      return false
    }

    return (
      item.dimensions.length === container.length &&
      item.dimensions.width === container.width &&
      item.dimensions.height === container.height
    )
  })

  return matched?.key ?? 'custom'
}

function resolveStandardSinglePackingMode(input: SolverInput): PackingMode {
  const gridResult = solvePalletization(input)
  const hasGridPlacement = gridResult.layers > 0 && gridResult.selected.perLayer > 0
  const leavesFreeArea = hasGridPlacement && gridResult.freeArea > 0
  return leavesFreeArea ? 'advanced' : 'grid'
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
    unitWeightKg: overrides?.unitWeightKg,
    allowRotation: overrides?.allowRotation ?? true,
    color: overrides?.color,
    maxLayers: overrides?.maxLayers,
    noStack: overrides?.noStack ?? false,
  }
}

function resolveMultiSkuId(sku: MultiSkuInput) {
  return normalizeLabelSkuId(sku.skuId, `SKU-${sku.id}`)
}

const DEFAULT_MULTI_STATE: MultiDraftState = {
  pallet: { length: 1200, width: 1000, height: 150 },
  palletWeightKg: undefined,
  maxTotalHeight: 1200,
  allowRotation: true,
  overhang: 0,
  noMixedSkuStacking: true,
  skus: [
    createDefaultMultiSku(1, { name: 'Caja A', quantity: 8, color: '#b88752' }),
    createDefaultMultiSku(2, { name: 'Caja B', quantity: 10, color: '#e67e22' }),
  ],
}

function cloneInput(input: SolverInput): SolverInput {
  return {
    pallet: { ...input.pallet },
    box: { ...input.box },
    palletWeightKg: input.palletWeightKg,
    boxUnitWeightKg: input.boxUnitWeightKg,
    maxTotalHeight: input.maxTotalHeight,
    allowRotation: input.allowRotation,
    overhang: input.overhang,
  }
}

function cloneMultiState(state: MultiDraftState): MultiDraftState {
  return {
    pallet: { ...state.pallet },
    palletWeightKg: state.palletWeightKg,
    maxTotalHeight: state.maxTotalHeight,
    allowRotation: state.allowRotation,
    overhang: state.overhang,
    noMixedSkuStacking: state.noMixedSkuStacking,
    skus: state.skus.map((sku) => ({ ...sku })),
  }
}

function cloneMultiPreviewInput(state: MultiDraftState): MultiPreviewInput {
  return {
    pallet: { ...state.pallet },
    palletWeightKg: state.palletWeightKg,
    maxTotalHeight: state.maxTotalHeight,
    overhang: state.overhang,
    allowRotation: state.allowRotation,
    noMixedSkuStacking: state.noMixedSkuStacking,
    skus: state.skus.map((sku) => ({ ...sku })),
  }
}

function cloneContainerInput(input: ContainerInput): ContainerInput {
  const normalizedClearance = Math.max(0, input.clearance)
  const normalizedRearClearance = Math.max(
    0,
    input.rearClearance ?? input.clearance,
  )
  return {
    preset: input.preset,
    container: { ...input.container },
    pallet: { ...input.pallet },
    pallets: cloneContainerPalletCatalog(input.pallets),
    allowRotation: input.allowRotation,
    clearance: normalizedClearance,
    rearClearance: normalizedRearClearance,
    allowAlternatingPattern: input.allowAlternatingPattern ?? true,
    weightPerPalletKg: input.weightPerPalletKg,
    payloadMaxKg: input.payloadMaxKg,
    allowStacking: input.allowStacking,
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
    palletWeightKg: candidate.palletWeightKg ?? fallback.palletWeightKg,
    maxTotalHeight: candidate.maxTotalHeight ?? fallback.maxTotalHeight,
    allowRotation: candidate.allowRotation ?? fallback.allowRotation,
    overhang: candidate.overhang ?? fallback.overhang,
    noMixedSkuStacking:
      typeof candidate.noMixedSkuStacking === 'boolean'
        ? candidate.noMixedSkuStacking
        : fallback.noMixedSkuStacking,
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
          unitWeightKg: sku.unitWeightKg,
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
          unitWeightKg: undefined,
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
    left.palletWeightKg === right.palletWeightKg &&
    left.boxUnitWeightKg === right.boxUnitWeightKg &&
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
    left.palletWeightKg !== right.palletWeightKg ||
    left.maxTotalHeight !== right.maxTotalHeight ||
    left.allowRotation !== right.allowRotation ||
    left.overhang !== right.overhang ||
    left.noMixedSkuStacking !== right.noMixedSkuStacking ||
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
      leftType.unitWeightKg !== rightType.unitWeightKg ||
      leftType.allowRotation !== rightType.allowRotation ||
      leftType.color !== rightType.color ||
      leftType.maxLayers !== rightType.maxLayers ||
      leftType.noStack !== rightType.noStack
    ) {
      return false
    }
  }

  return true
}

function buildContainerCatalogEntryFingerprint(entry: ContainerPalletCatalogEntry) {
  return JSON.stringify({
    id: entry.id,
    name: entry.name,
    source: entry.source,
    quantity: entry.quantity,
    pallet: entry.pallet,
    weightPerPalletKg: entry.weightPerPalletKg ?? null,
    color: entry.color ?? null,
    load: entry.load
      ? {
          palletLengthMm: entry.load.palletLengthMm,
          palletWidthMm: entry.load.palletWidthMm,
          palletHeightMm: entry.load.palletHeightMm,
          loadTotalHeightMm: entry.load.loadTotalHeightMm,
          source: entry.load.source,
          meta: entry.load.meta ?? null,
          boxesPlacements: entry.load.boxesPlacements,
        }
      : null,
  })
}

function areContainerInputsEqual(left: ContainerInput, right: ContainerInput) {
  const leftCatalog = left.pallets ?? []
  const rightCatalog = right.pallets ?? []
  if (leftCatalog.length !== rightCatalog.length) {
    return false
  }

  for (let index = 0; index < leftCatalog.length; index += 1) {
    if (
      buildContainerCatalogEntryFingerprint(leftCatalog[index]) !==
      buildContainerCatalogEntryFingerprint(rightCatalog[index])
    ) {
      return false
    }
  }

  return (
    left.preset === right.preset &&
    left.container.length === right.container.length &&
    left.container.width === right.container.width &&
    left.container.height === right.container.height &&
    left.pallet.length === right.pallet.length &&
    left.pallet.width === right.pallet.width &&
    left.pallet.height === right.pallet.height &&
    left.allowRotation === right.allowRotation &&
    left.clearance === right.clearance &&
    (left.rearClearance ?? left.clearance) ===
      (right.rearClearance ?? right.clearance) &&
    (left.allowAlternatingPattern ?? true) ===
      (right.allowAlternatingPattern ?? true) &&
    left.weightPerPalletKg === right.weightPerPalletKg &&
    left.payloadMaxKg === right.payloadMaxKg
  )
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

function validateDecimalInput(
  rawValue: string,
  config: DecimalValidationConfig,
): ValidationResult {
  const value = rawValue.trim()

  if (value.length === 0) {
    return {
      value: null,
      error: `${config.label} es obligatorio.`,
    }
  }

  const normalized = value.replace(',', '.')
  if (!/^[+-]?\d+(\.\d+)?$/.test(normalized)) {
    return {
      value: null,
      error: `${config.label} debe ser numerico.`,
    }
  }

  const maxDecimals = config.maxDecimals ?? 3
  const decimalPart = normalized.split('.')[1]
  if (decimalPart && decimalPart.length > maxDecimals) {
    return {
      value: null,
      error: `${config.label} debe tener como maximo ${maxDecimals} decimales.`,
    }
  }

  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) {
    return {
      value: null,
      error: `${config.label} debe ser numerico.`,
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
    'pallet-weight':
      input.palletWeightKg !== undefined ? String(input.palletWeightKg) : '',
    'box-length': String(input.box.length),
    'box-width': String(input.box.width),
    'box-height': String(input.box.height),
    'box-unit-weight':
      input.boxUnitWeightKg !== undefined ? String(input.boxUnitWeightKg) : '',
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
    | 'unitWeight'
    | 'color'
    | 'maxLayers',
) {
  return `multi-sku-${field}-${skuId}`
}

function buildMultiFieldValues(state: MultiDraftState): Record<string, string> {
  const values: Record<string, string> = {
    'multi-pallet-length': String(state.pallet.length),
    'multi-pallet-width': String(state.pallet.width),
    'multi-pallet-height': String(state.pallet.height),
    'multi-pallet-weight':
      typeof state.palletWeightKg === 'number' ? String(state.palletWeightKg) : '',
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
    values[getMultiSkuFieldId(sku.id, 'unitWeight')] =
      typeof sku.unitWeightKg === 'number' ? String(sku.unitWeightKg) : ''
    values[getMultiSkuFieldId(sku.id, 'color')] = sku.color ?? ''
    values[getMultiSkuFieldId(sku.id, 'maxLayers')] =
      typeof sku.maxLayers === 'number' ? String(sku.maxLayers) : ''
  })

  return values
}

function buildMultiAllowedFieldIds(state: MultiDraftState): Set<string> {
  return new Set(Object.keys(buildMultiFieldValues(state)))
}

function buildContainerFieldValues(input: ContainerInput): ContainerFieldValues {
  return {
    'container-length': String(input.container.length),
    'container-width': String(input.container.width),
    'container-height': String(input.container.height),
    'container-pallet-length': String(input.pallet.length),
    'container-pallet-width': String(input.pallet.width),
    'container-pallet-height': String(input.pallet.height),
    'container-clearance': String(input.clearance),
    'container-weight-per-pallet':
      input.weightPerPalletKg !== undefined ? String(input.weightPerPalletKg) : '',
    'container-payload-max':
      input.payloadMaxKg !== undefined ? String(input.payloadMaxKg) : '',
  }
}

function buildMultiNoMixErrorResult(
  input: MultiDraftState,
  message: string,
): MultiPreviewResult {
  const availableHeight = Math.max(0, input.maxTotalHeight - input.pallet.height)
  return {
    algorithm: 'heuristic',
    solverVariant: 'heuristic-columns',
    boxes: [],
    bySku: [],
    placedBySku: {},
    unplacedBySku: {},
    columnsBySku: {},
    layersUsedBySku: {},
    requestedTotal: 0,
    placedTotal: 0,
    unplacedTotal: 0,
    unplaceableTotal: 0,
    totalPlaced: 0,
    totalUnplaced: 0,
    layersUsed: 0,
    utilization: 0,
    availableHeight,
    heightUsed: 0,
    heightFree: availableHeight,
    errors: [message],
    warnings: [],
  }
}

const formatInt = new Intl.NumberFormat('es-ES')
const formatKg = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
})
const percentFormatter = new Intl.NumberFormat('es-ES', {
  maximumFractionDigits: 2,
})
const formatPercent = (value: number) => `${percentFormatter.format(value * 100)}%`

function App() {
  const initialShareState = useMemo(
    () =>
      parseShareLinkInput(
        window.location.search,
        DEFAULT_INPUT,
        DEFAULT_CONTAINER_INPUT,
      ),
    [],
  )
  const initialMultiState = useMemo(() => {
    const next = cloneMultiState(DEFAULT_MULTI_STATE)
    if (initialShareState.multiNoMixedSkuStacking !== null) {
      next.noMixedSkuStacking = initialShareState.multiNoMixedSkuStacking
    }
    return next
  }, [initialShareState.multiNoMixedSkuStacking])
  const testAuthBypass =
    import.meta.env.MODE === 'test' &&
    !(window as Window & { __ADEX_FORCE_LOGIN__?: boolean }).__ADEX_FORCE_LOGIN__

  const [activeTab, setActiveTab] = useState<TabKey>(initialShareState.mode)
  const [shareWarning] = useState<string | null>(initialShareState.warning)
  const [shareStatus, setShareStatus] = useState<string | null>(null)
  const [authStatus, setAuthStatus] = useState<AuthStatus>(
    testAuthBypass ? 'authenticated' : 'checking',
  )
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [authUser, setAuthUser] = useState<AuthUser | null>(testAuthBypass ? TEST_AUTH_USER : null)
  const [authError, setAuthError] = useState<string | null>(null)
  const [authShowRetryConnection, setAuthShowRetryConnection] = useState(false)
  const [authIdentifier, setAuthIdentifier] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [registerDraft, setRegisterDraft] = useState(createEmptyRegistrationDraft)
  const [registerErrors, setRegisterErrors] = useState<RegistrationFieldErrors>({})
  const [authSubmitting, setAuthSubmitting] = useState(false)
  const [authLogoutSubmitting, setAuthLogoutSubmitting] = useState(false)
  const [skuLabelsBySku, setSkuLabelsBySku] = useState<SkuLabelsBySku>(() =>
    loadSkuLabels(),
  )
  const [boxSkinMode, setBoxSkinMode] = useState<BoxSkinMode>(
    () => initialShareState.boxSkinMode ?? 'box',
  )
  const [labelEditorOpen, setLabelEditorOpen] = useState(false)
  const [labelEditorMode, setLabelEditorMode] = useState<LabelEditorMode>('single')
  const [labelEditorSkuId, setLabelEditorSkuId] = useState<string>(SINGLE_BOX_SKU_ID)

  const [draftInput, setDraftInput] = useState<SolverInput>(() =>
    cloneInput(initialShareState.input),
  )
  const [singlePalletPreset, setSinglePalletPreset] =
    useState<PalletPresetKey>(() => detectPalletPreset(initialShareState.input.pallet))
  const [singleBoxPreset, setSingleBoxPreset] = useState<BoxPresetId>(
    () => initialShareState.boxPresetId ?? detectBoxPreset(initialShareState.input.box),
  )
  const [singlePackingModeDraft, setSinglePackingModeDraft] = useState<PackingMode>(
    () =>
      initialShareState.packingMode ??
      resolveStandardSinglePackingMode(initialShareState.input),
  )
  const [singlePackingModeApplied, setSinglePackingModeApplied] = useState<PackingMode>(
    () =>
      initialShareState.packingMode ??
      resolveStandardSinglePackingMode(initialShareState.input),
  )
  const [singleFieldValues, setSingleFieldValues] = useState<SingleFieldValues>(() =>
    buildSingleFieldValues(initialShareState.input),
  )
  const [singleFieldErrors, setSingleFieldErrors] = useState<FieldErrors>({})
  const [appliedInput, setAppliedInput] = useState<SolverInput>(() =>
    cloneInput(initialShareState.input),
  )
  const [singleCanvas, setSingleCanvas] = useState<HTMLCanvasElement | null>(null)
  const [lastCalculatedAt, setLastCalculatedAt] = useState<Date>(new Date())

  const [multiDraft, setMultiDraft] = useState<MultiDraftState>(() =>
    cloneMultiState(initialMultiState),
  )
  const [multiPalletPreset, setMultiPalletPreset] =
    useState<PalletPresetKey>(() => detectPalletPreset(initialMultiState.pallet))
  const [multiFieldValues, setMultiFieldValues] = useState<Record<string, string>>(() =>
    buildMultiFieldValues(initialMultiState),
  )
  const [multiFieldErrors, setMultiFieldErrors] = useState<FieldErrors>({})
  const [multiApplied, setMultiApplied] = useState<MultiDraftState>(() =>
    cloneMultiState(initialMultiState),
  )
  const [lastGeneratedAt, setLastGeneratedAt] = useState<Date>(new Date())
  const [multiShowLabels, setMultiShowLabels] = useState(false)
  const initialMultiNoMixResult = useMemo(() => {
    if (!initialMultiState.noMixedSkuStacking) {
      return null
    }
    return solveMultiHeuristicNoMix(cloneMultiPreviewInput(initialMultiState))
  }, [initialMultiState])
  const [multiAlgorithm, setMultiAlgorithm] = useState<'preview' | 'heuristic'>(
    () => (initialMultiState.noMixedSkuStacking ? 'heuristic' : 'preview'),
  )
  const [multiHeuristicResult, setMultiHeuristicResult] =
    useState<MultiPreviewResult | null>(() => initialMultiNoMixResult)

  const [containerDraft, setContainerDraft] = useState<ContainerInput>(() =>
    cloneContainerInput(initialShareState.containerInput ?? DEFAULT_CONTAINER_INPUT),
  )
  const [containerPreset, setContainerPreset] = useState<ContainerPresetKey>(() =>
    detectContainerPreset(
      (initialShareState.containerInput ?? DEFAULT_CONTAINER_INPUT).container,
    ),
  )
  const [containerFieldValues, setContainerFieldValues] = useState<ContainerFieldValues>(
    () => buildContainerFieldValues(initialShareState.containerInput ?? DEFAULT_CONTAINER_INPUT),
  )
  const [containerFieldErrors, setContainerFieldErrors] = useState<FieldErrors>({})
  const [containerApplied, setContainerApplied] = useState<ContainerInput>(() =>
    cloneContainerInput(initialShareState.containerInput ?? DEFAULT_CONTAINER_INPUT),
  )
  const [containerPalletLoad, setContainerPalletLoad] =
    useState<ExportedPalletLoad | null>(null)
  const [containerPalletSource, setContainerPalletSource] =
    useState<ContainerPalletSource>('single')
  const [containerShowTechnical, setContainerShowTechnical] = useState(true)
  const [containerTopViewSvg, setContainerTopViewSvg] = useState<SVGSVGElement | null>(null)
  const [lastContainerCalculatedAt, setLastContainerCalculatedAt] = useState<Date>(
    new Date(),
  )

  const [scenarios, setScenarios] = useState<StoredScenario[]>(() =>
    loadStoredScenarios(),
  )
  const [scenarioNotice, setScenarioNotice] = useState<string | null>(null)

  useEffect(() => {
    if (testAuthBypass) {
      return
    }

    let isMounted = true

    const restoreSession = async () => {
      try {
        const sessionPayload = await fetchCurrentSession()
        if (!isMounted) {
          return
        }

        setAuthUser(sessionPayload.user)
        setAuthStatus('authenticated')
        setAuthError(null)
        setAuthShowRetryConnection(false)
      } catch (error) {
        if (!isMounted) {
          return
        }

        setAuthUser(null)
        setAuthStatus('unauthenticated')
        setAuthShowRetryConnection(isRetryableAuthError(error))
        setAuthError(
          error instanceof AuthApiError && error.status !== 401 ? error.message : null,
        )
      }
    }

    void restoreSession()

    return () => {
      isMounted = false
    }
  }, [testAuthBypass])

  const runAuthLogin = async () => {
    const identifier = authIdentifier.trim()
    const password = authPassword

    if (!identifier || !password) {
      setAuthError('Ingresa usuario/correo y contrasena para continuar.')
      setAuthShowRetryConnection(false)
      return
    }

    setAuthSubmitting(true)
    setAuthError(null)
    setAuthShowRetryConnection(false)

    try {
      const sessionPayload = await loginWithPassword(identifier, password)
      setAuthUser(sessionPayload.user)
      setAuthStatus('authenticated')
      setAuthPassword('')
      setAuthShowRetryConnection(false)
    } catch (error) {
      setAuthShowRetryConnection(isRetryableAuthError(error))
      setAuthError(
        error instanceof AuthApiError
          ? error.message
          : 'No se pudo iniciar sesion. Intenta nuevamente.',
      )
      setAuthStatus('unauthenticated')
    } finally {
      setAuthSubmitting(false)
    }
  }

  const handleRegisterFieldChange = (field: RegistrationField, value: string) => {
    setRegisterDraft((current) => ({
      ...current,
      [field]: value,
    }))
    setAuthError(null)
    setAuthShowRetryConnection(false)

    setRegisterErrors((current) => {
      if (!current[field]) {
        return current
      }

      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const handleAuthIdentifierChange = (value: string) => {
    setAuthIdentifier(value)
    setAuthError(null)
    setAuthShowRetryConnection(false)
  }

  const handleAuthPasswordChange = (value: string) => {
    setAuthPassword(value)
    setAuthError(null)
    setAuthShowRetryConnection(false)
  }

  const runAuthRegister = async () => {
    const nextErrors = validateRegistrationDraft(registerDraft)
    if (Object.keys(nextErrors).length > 0) {
      setRegisterErrors(nextErrors)
      setAuthError('Corrige los campos marcados para crear tu cuenta.')
      setAuthShowRetryConnection(false)
      return
    }

    setAuthSubmitting(true)
    setAuthError(null)
    setRegisterErrors({})
    setAuthShowRetryConnection(false)

    try {
      const sessionPayload = await registerWithPassword({
        fullName: registerDraft.fullName.trim(),
        email: registerDraft.email.trim(),
        companyName: registerDraft.companyName.trim(),
        useCase: registerDraft.useCase as RegistrationUseCase,
        monthlyVolumeBand: registerDraft.monthlyVolumeBand as RegistrationVolumeBand,
        phone: registerDraft.phone.trim() || undefined,
        jobTitle: (registerDraft.jobTitle as RegistrationJobTitle) || undefined,
        password: registerDraft.password,
      })

      setAuthUser(sessionPayload.user)
      setAuthStatus('authenticated')
      setAuthMode('login')
      setAuthIdentifier(registerDraft.email.trim())
      setAuthPassword('')
      setRegisterDraft(createEmptyRegistrationDraft())
      setRegisterErrors({})
      setAuthShowRetryConnection(false)
    } catch (error) {
      setAuthShowRetryConnection(isRetryableAuthError(error))
      setAuthError(
        error instanceof AuthApiError
          ? error.message
          : 'No se pudo crear la cuenta. Intenta nuevamente en unos segundos.',
      )
      setAuthStatus('unauthenticated')
    } finally {
      setAuthSubmitting(false)
    }
  }

  const handleAuthModeChange = (nextMode: AuthMode) => {
    setAuthMode(nextMode)
    setAuthError(null)
    setAuthShowRetryConnection(false)

    if (nextMode === 'login') {
      setRegisterErrors({})
      return
    }

    setAuthPassword('')
  }

  const retryAuthSession = async () => {
    setAuthStatus('checking')
    setAuthError(null)
    setAuthShowRetryConnection(false)

    try {
      const sessionPayload = await fetchCurrentSession()
      setAuthUser(sessionPayload.user)
      setAuthStatus('authenticated')
      setAuthShowRetryConnection(false)
    } catch (error) {
      setAuthStatus('unauthenticated')
      setAuthShowRetryConnection(isRetryableAuthError(error))
      setAuthError(
        error instanceof AuthApiError && error.status !== 401 ? error.message : null,
      )
    }
  }

  const handleLogout = async () => {
    setAuthLogoutSubmitting(true)
    try {
      await logoutSession()
    } finally {
      setAuthUser(null)
      setAuthStatus('unauthenticated')
      setAuthMode('login')
      setAuthPassword('')
      setRegisterDraft(createEmptyRegistrationDraft())
      setRegisterErrors({})
      setAuthError(null)
      setAuthShowRetryConnection(false)
      setAuthLogoutSubmitting(false)
    }
  }

  const result = useMemo(() => solvePalletization(appliedInput), [appliedInput])
  const singleAdvancedResult = useMemo(
    () => solveSingleAdvancedPacking(appliedInput),
    [appliedInput],
  )
  const singleIsAdvanced = singlePackingModeApplied === 'advanced'
  const singleBoxes = useMemo(() => {
    if (singleIsAdvanced) {
      return singleAdvancedResult.boxes
    }
    return buildBoxInstances(appliedInput, result)
  }, [singleIsAdvanced, singleAdvancedResult.boxes, appliedInput, result])
  const singlePerLayer = singleIsAdvanced ? singleAdvancedResult.perLayer : result.selected.perLayer
  const singleTotalBoxes = singleIsAdvanced ? singleAdvancedResult.totalBoxes : result.totalBoxes
  const singleTotalHeight = singleIsAdvanced ? singleAdvancedResult.totalHeight : result.totalHeight
  const singleBoxesWeightKg =
    appliedInput.boxUnitWeightKg !== undefined
      ? singleTotalBoxes * appliedInput.boxUnitWeightKg
      : null
  const singlePalletBaseWeightKg = appliedInput.palletWeightKg ?? null
  const singlePalletizedWeightKg =
    singleBoxesWeightKg !== null || singlePalletBaseWeightKg !== null
      ? (singleBoxesWeightKg ?? 0) + (singlePalletBaseWeightKg ?? 0)
      : null
  const singleUsedArea = singleIsAdvanced ? singleAdvancedResult.usedAreaPerLayer : result.usedArea
  const singleFreeArea = singleIsAdvanced ? singleAdvancedResult.freeAreaPerLayer : result.freeArea
  const singleAreaUtilization = singleIsAdvanced
    ? singleAdvancedResult.utilizationPerLayer
    : result.selected.utilization
  const singleTotalBoxVolume =
    singleTotalBoxes * appliedInput.box.length * appliedInput.box.width * appliedInput.box.height
  const singleVolumeUtilization =
    result.maxLoadVolume > 0 ? singleTotalBoxVolume / result.maxLoadVolume : 0
  const singleDerivedMetrics = useMemo(
    () =>
      buildSingleDerivedMetrics(
        appliedInput,
        singleUsedArea,
        singleFreeArea,
        singleTotalBoxVolume,
      ),
    [appliedInput, singleUsedArea, singleFreeArea, singleTotalBoxVolume],
  )
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
  const multiBoxesWeightKg = useMemo(() => {
    let hasWeightData = false
    let totalWeight = 0

    multiApplied.skus.forEach((sku) => {
      if (sku.unitWeightKg === undefined) {
        return
      }

      const skuId = resolveMultiSkuId(sku)
      const placed = multiResult.placedBySku[skuId] ?? 0
      if (placed <= 0) {
        return
      }

      hasWeightData = true
      totalWeight += placed * sku.unitWeightKg
    })

    return hasWeightData ? totalWeight : null
  }, [multiApplied.skus, multiResult.placedBySku])
  const multiPalletBaseWeightKg = multiApplied.palletWeightKg ?? null
  const multiPalletizedWeightKg =
    multiBoxesWeightKg !== null || multiPalletBaseWeightKg !== null
      ? (multiBoxesWeightKg ?? 0) + (multiPalletBaseWeightKg ?? 0)
      : null
  const containerResult = useMemo(
    () => solveContainerLoading(containerApplied),
    [containerApplied],
  )
  const containerCatalogEntries = useMemo(
    () => containerApplied.pallets ?? [],
    [containerApplied.pallets],
  )
  const containerIsConsolidated = containerCatalogEntries.length > 0
  const containerDerivedMetrics = useMemo(
    () => buildContainerDerivedMetrics(containerApplied, containerResult),
    [containerApplied, containerResult],
  )
  const containerWeightMetrics = useMemo(
    () => buildContainerWeightMetrics(containerApplied, containerResult),
    [containerApplied, containerResult],
  )

  const singleHasValidationErrors = Object.keys(singleFieldErrors).length > 0
  const multiHasValidationErrors = Object.keys(multiFieldErrors).length > 0
  const containerHasValidationErrors = Object.keys(containerFieldErrors).length > 0

  const handleExportTradeCase = useCallback(() => {
    if (activeTab === 'multi') {
      const tradeCase = buildTradeCaseMulti(
        { input: multiAppliedInput, result: multiResult },
        containerApplied,
        containerResult,
        containerWeightMetrics,
      )
      downloadTradeCase(tradeCase)
    } else {
      const tradeCase = buildTradeCaseSingle(
        { input: appliedInput, result },
        containerApplied,
        containerResult,
        containerWeightMetrics,
      )
      downloadTradeCase(tradeCase)
    }
  }, [activeTab, appliedInput, result, multiAppliedInput, multiResult, containerApplied, containerResult, containerWeightMetrics])

  const hasPendingSingle = useMemo(
    () =>
      singleHasValidationErrors ||
      !areInputsEqual(draftInput, appliedInput) ||
      singlePackingModeDraft !== singlePackingModeApplied,
    [draftInput, appliedInput, singleHasValidationErrors, singlePackingModeDraft, singlePackingModeApplied],
  )
  const hasPendingMulti = useMemo(
    () => multiHasValidationErrors || !areMultiStatesEqual(multiDraft, multiApplied),
    [multiDraft, multiApplied, multiHasValidationErrors],
  )
  const hasPendingContainer = useMemo(
    () =>
      containerHasValidationErrors ||
      !areContainerInputsEqual(containerDraft, containerApplied),
    [containerDraft, containerApplied, containerHasValidationErrors],
  )

  const singleLabelRefs = useMemo(() => {
    return skuLabelsBySku[SINGLE_BOX_SKU_ID] ? [SINGLE_BOX_SKU_ID] : []
  }, [skuLabelsBySku])

  const multiLabelRefs = useMemo(() => {
    const refs = new Set<string>()
    multiApplied.skus.forEach((sku) => {
      const skuId = resolveMultiSkuId(sku)
      if (skuLabelsBySku[skuId]) {
        refs.add(skuId)
      }
    })
    return Array.from(refs)
  }, [multiApplied.skus, skuLabelsBySku])

  const containerLabelRefs = useMemo(() => {
    const refs = new Set<string>()
    if (containerCatalogEntries.length > 0) {
      containerCatalogEntries.forEach((entry) => {
        entry.load?.boxesPlacements.forEach((box) => {
          if (!box.skuId) {
            return
          }
          if (skuLabelsBySku[box.skuId]) {
            refs.add(box.skuId)
          }
        })
      })
      return Array.from(refs)
    }

    containerPalletLoad?.boxesPlacements.forEach((box) => {
      if (!box.skuId) {
        return
      }
      if (skuLabelsBySku[box.skuId]) {
        refs.add(box.skuId)
      }
    })
    return Array.from(refs)
  }, [containerCatalogEntries, containerPalletLoad, skuLabelsBySku])

  const multiLabelSkuOptions = useMemo(
    () =>
      multiDraft.skus.map((sku) => ({
        skuId: resolveMultiSkuId(sku),
        name: sku.name.trim().length > 0 ? sku.name : `SKU ${sku.id}`,
        color: normalizeBaseColor(sku.color ?? ''),
      })),
    [multiDraft.skus],
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

  const applySingleBoxPreset = (preset: BoxPresetId) => {
    setSingleBoxPreset(preset)
    const presetBox = getBoxPresetDimensions(preset)
    if (presetBox === null) {
      return
    }

    setDraftInput((current) => ({
      ...current,
      box: { ...presetBox },
    }))
    setAppliedInput((current) => ({
      ...current,
      box: { ...presetBox },
    }))
    setSingleFieldValues((current) => ({
      ...current,
      'box-length': String(presetBox.length),
      'box-width': String(presetBox.width),
      'box-height': String(presetBox.height),
    }))
    setSingleFieldErrors((current) => {
      const next = { ...current }
      delete next['box-length']
      delete next['box-width']
      delete next['box-height']
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
    if (section === 'box' && singleBoxPreset !== 'custom') {
      setSingleBoxPreset('custom')
    }

    const minValue = section === 'box' ? MIN_SINGLE_BOX_DIMENSION_MM : 1
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

  const updateSingleBoxUnitWeight = (value: string) => {
    const fieldId: SingleFieldId = 'box-unit-weight'
    setSingleFieldValues((current) => ({
      ...current,
      [fieldId]: value,
    }))

    const trimmed = value.trim()
    if (trimmed.length === 0) {
      setSingleFieldErrors((current) => upsertFieldError(current, fieldId, null))
      setDraftInput((current) => ({
        ...current,
        boxUnitWeightKg: undefined,
      }))
      return
    }

    const validation = validateDecimalInput(value, {
      label: 'El peso por caja/saco',
      min: MIN_WEIGHT_KG,
      maxDecimals: 3,
    })
    setSingleFieldErrors((current) =>
      upsertFieldError(current, fieldId, validation.error),
    )

    if (validation.value === null) {
      return
    }

    setDraftInput((current) => ({
      ...current,
      boxUnitWeightKg: validation.value ?? undefined,
    }))
  }

  const updateSinglePalletWeight = (value: string) => {
    const fieldId: SingleFieldId = 'pallet-weight'
    setSingleFieldValues((current) => ({
      ...current,
      [fieldId]: value,
    }))

    const trimmed = value.trim()
    if (trimmed.length === 0) {
      setSingleFieldErrors((current) => upsertFieldError(current, fieldId, null))
      setDraftInput((current) => ({
        ...current,
        palletWeightKg: undefined,
      }))
      return
    }

    const validation = validateDecimalInput(value, {
      label: 'El peso del pallet base',
      min: MIN_WEIGHT_KG,
      maxDecimals: 3,
    })
    setSingleFieldErrors((current) =>
      upsertFieldError(current, fieldId, validation.error),
    )

    if (validation.value === null) {
      return
    }

    setDraftInput((current) => ({
      ...current,
      palletWeightKg: validation.value ?? undefined,
    }))
  }

  const runSingleCalculation = () => {
    if (singleHasValidationErrors) {
      return
    }

    setAppliedInput(cloneInput(draftInput))
    setSinglePackingModeApplied(singlePackingModeDraft)
    setLastCalculatedAt(new Date())
    setShareStatus(null)
  }

  const resetSingle = () => {
    const next = cloneInput(DEFAULT_INPUT)
    const nextDefaultMode = resolveStandardSinglePackingMode(next)
    setDraftInput(next)
    setAppliedInput(next)
    setSinglePalletPreset('american')
    setSingleBoxPreset('standard-600-400-200')
    setSinglePackingModeDraft(nextDefaultMode)
    setSinglePackingModeApplied(nextDefaultMode)
    setSingleFieldValues(buildSingleFieldValues(next))
    setSingleFieldErrors({})
    setLastCalculatedAt(new Date())
    setShareStatus(null)
  }

  const setContainerValueAndValidation = (
    fieldId: ContainerFieldId,
    rawValue: string,
    config: IntegerValidationConfig,
    applyValue: (value: number) => void,
  ) => {
    setContainerFieldValues((current) => ({
      ...current,
      [fieldId]: rawValue,
    }))

    const validation = validateIntegerInput(rawValue, config)
    setContainerFieldErrors((current) =>
      upsertFieldError(current, fieldId, validation.error),
    )

    if (validation.value !== null) {
      applyValue(validation.value)
    }
  }

  const applyContainerPreset = (preset: ContainerPresetKey) => {
    setContainerPreset(preset)
    const presetDimensions = getContainerPresetDimensions(preset)
    if (presetDimensions === null) {
      setContainerDraft((current) => ({
        ...current,
        preset,
      }))
      return
    }

    setContainerDraft((current) => ({
      ...current,
      preset,
      container: { ...presetDimensions },
    }))
    setContainerApplied((current) => ({
      ...current,
      preset,
      container: { ...presetDimensions },
    }))
    setContainerFieldValues((current) => ({
      ...current,
      'container-length': String(presetDimensions.length),
      'container-width': String(presetDimensions.width),
      'container-height': String(presetDimensions.height),
    }))
    setContainerFieldErrors((current) => {
      const next = { ...current }
      delete next['container-length']
      delete next['container-width']
      delete next['container-height']
      return next
    })
    setLastContainerCalculatedAt(new Date())
    setShareStatus(null)
  }

  const updateContainerDimensions = (
    fieldId: ContainerFieldId,
    section: 'container' | 'pallet',
    key: keyof DimensionsMM,
    value: string,
  ) => {
    if (section === 'container' && containerPreset !== 'custom') {
      setContainerPreset('custom')
      setContainerDraft((current) => ({
        ...current,
        preset: 'custom',
      }))
    }
    if (section === 'pallet') {
      setContainerPalletLoad(null)
    }

    const label =
      section === 'container'
        ? `La dimension interna de ${
            key === 'length' ? 'largo' : key === 'width' ? 'ancho' : 'alto'
          } del contenedor`
        : `La dimension de ${
            key === 'length' ? 'largo' : key === 'width' ? 'ancho' : 'alto'
          } del pallet de carga`

    setContainerValueAndValidation(
      fieldId,
      value,
      {
        label,
        min: 1,
      },
      (nextValue) => {
        setContainerDraft((current) => ({
          ...current,
          [section]: {
            ...current[section],
            [key]: nextValue,
          },
        }))
      },
    )
  }

  const updateContainerCommonField = (
    fieldId: ContainerFieldId,
    field: 'clearance' | 'weightPerPalletKg' | 'payloadMaxKg',
    value: string,
  ) => {
    setContainerFieldValues((current) => ({
      ...current,
      [fieldId]: value,
    }))

    if (field !== 'clearance' && value.trim().length === 0) {
      setContainerFieldErrors((current) => upsertFieldError(current, fieldId, null))
      setContainerDraft((current) => ({
        ...current,
        [field]: undefined,
      }))
      return
    }

    const validation = validateDecimalInput(value, {
      label:
        field === 'clearance'
          ? 'La separacion entre pallets'
          : field === 'weightPerPalletKg'
            ? 'El peso por pallet'
            : 'El payload maximo',
      min: field === 'clearance' ? 0 : MIN_WEIGHT_KG,
      maxDecimals: field === 'clearance' ? 0 : 3,
    })
    setContainerFieldErrors((current) =>
      upsertFieldError(current, fieldId, validation.error),
    )

    if (validation.value === null) {
      return
    }

    setContainerDraft((current) => ({
      ...current,
      [field]: validation.value,
    }))
  }

  const runContainerCalculation = () => {
    if (containerHasValidationErrors) {
      return
    }

    const nextInput = cloneContainerInput(containerDraft)
    setContainerApplied(nextInput)
    if ((nextInput.pallets?.length ?? 0) > 0) {
      setContainerPalletLoad(null)
    }
    setLastContainerCalculatedAt(new Date())
    setShareStatus(null)
  }

  const resolveCurrentPalletLoadFromSource = (
    source: ContainerPalletSource,
  ): ExportedPalletLoad => {
    if (source === 'multi') {
      return buildExportedPalletLoadFromMulti(multiAppliedInput, multiResult)
    }

    return buildExportedPalletLoadFromSingle(appliedInput, result, singleBoxes)
  }

  const mutateContainerCatalog = (
    updater: (
      current: ContainerPalletCatalogEntry[],
    ) => ContainerPalletCatalogEntry[],
  ) => {
    setContainerDraft((current) => ({
      ...current,
      pallets: updater(current.pallets ?? []),
    }))
    setContainerApplied((current) => ({
      ...current,
      pallets: updater(current.pallets ?? []),
    }))
    setContainerPalletLoad(null)
    setLastContainerCalculatedAt(new Date())
    setShareStatus(null)
  }

  const buildCurrentContainerCatalogEntry = (
    source: ContainerPalletSource,
  ): ContainerPalletCatalogEntry => {
    const importedLoad = resolveCurrentPalletLoadFromSource(source)
    const estimatedPalletWeightKg =
      source === 'multi'
        ? multiPalletizedWeightKg
        : singlePalletizedWeightKg
    const sourcePallet: DimensionsMM = {
      length: importedLoad.palletLengthMm,
      width: importedLoad.palletWidthMm,
      height: importedLoad.loadTotalHeightMm,
    }

    const signature = buildContainerPalletCatalogSignature(
      source,
      importedLoad,
      estimatedPalletWeightKg ?? undefined,
    )

    return {
      id: signature,
      name: `${
        source === 'multi' ? 'Pallet multiples cajas' : 'Pallet caja unica'
      } ${sourcePallet.length}x${sourcePallet.width}x${sourcePallet.height}`,
      source,
      quantity: 1,
      pallet: { ...sourcePallet },
      weightPerPalletKg: estimatedPalletWeightKg ?? undefined,
      load: importedLoad,
      color: detectPalletCatalogColor(importedLoad),
    }
  }

  const addCurrentPalletToCatalog = () => {
    const nextEntry = buildCurrentContainerCatalogEntry(containerPalletSource)

    mutateContainerCatalog((current) => {
      const existingIndex = current.findIndex((entry) => entry.id === nextEntry.id)
      if (existingIndex >= 0) {
        return current.map((entry, index) =>
          index === existingIndex
            ? {
                ...cloneContainerPalletCatalogEntry(entry),
                quantity: entry.quantity + 1,
              }
            : cloneContainerPalletCatalogEntry(entry),
        )
      }

      return [...current.map(cloneContainerPalletCatalogEntry), nextEntry]
    })
  }

  const adjustContainerCatalogQuantity = (entryId: string, delta: number) => {
    mutateContainerCatalog((current) =>
      current
        .map((entry) =>
          entry.id === entryId
            ? {
                ...cloneContainerPalletCatalogEntry(entry),
                quantity: Math.max(0, entry.quantity + delta),
              }
            : cloneContainerPalletCatalogEntry(entry),
        )
        .filter((entry) => entry.quantity > 0),
    )
  }

  const removeContainerCatalogEntry = (entryId: string) => {
    mutateContainerCatalog((current) =>
      current
        .filter((entry) => entry.id !== entryId)
        .map(cloneContainerPalletCatalogEntry),
    )
  }

  const resetContainer = () => {
    const next = cloneContainerInput(DEFAULT_CONTAINER_INPUT)
    setContainerDraft(next)
    setContainerApplied(next)
    setContainerPreset(next.preset)
    setContainerFieldValues(buildContainerFieldValues(next))
    setContainerFieldErrors({})
    setContainerPalletLoad(null)
    setContainerPalletSource('single')
    setContainerShowTechnical(true)
    setLastContainerCalculatedAt(new Date())
    setShareStatus(null)
  }

  const openSingleLabelEditor = () => {
    setLabelEditorMode('single')
    setLabelEditorSkuId(SINGLE_BOX_SKU_ID)
    setLabelEditorOpen(true)
  }

  const openMultiLabelEditor = () => {
    const firstSkuId =
      multiLabelSkuOptions.length > 0
        ? multiLabelSkuOptions[0].skuId
        : SINGLE_BOX_SKU_ID
    setLabelEditorMode('multi')
    setLabelEditorSkuId(firstSkuId)
    setLabelEditorOpen(true)
  }

  const closeLabelEditor = () => {
    setLabelEditorOpen(false)
  }

  const saveLabelConfig = (config: SkuLabelConfig) => {
    const nextMap = upsertSkuLabel(skuLabelsBySku, config)
    setSkuLabelsBySku(nextMap)
    saveSkuLabels(nextMap)
    setLabelEditorOpen(false)
    setScenarioNotice(`Etiqueta guardada para SKU ${config.skuId}.`)
  }

  const resetLabelConfig = (skuId: string) => {
    const nextMap = deleteSkuLabel(skuLabelsBySku, skuId)
    setSkuLabelsBySku(nextMap)
    saveSkuLabels(nextMap)
    setScenarioNotice(`Etiqueta reiniciada para SKU ${skuId}.`)
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

  const updateMultiPalletWeight = (value: string) => {
    const fieldId = 'multi-pallet-weight'
    setMultiFieldValues((current) => ({
      ...current,
      [fieldId]: value,
    }))

    const trimmed = value.trim()
    if (trimmed.length === 0) {
      setMultiFieldErrors((current) => upsertFieldError(current, fieldId, null))
      setMultiDraft((current) => ({
        ...current,
        palletWeightKg: undefined,
      }))
      return
    }

    const validation = validateDecimalInput(value, {
      label: 'El peso del pallet base',
      min: MIN_WEIGHT_KG,
      maxDecimals: 3,
    })
    setMultiFieldErrors((current) =>
      upsertFieldError(current, fieldId, validation.error),
    )

    if (validation.value === null) {
      return
    }

    setMultiDraft((current) => ({
      ...current,
      palletWeightKg: validation.value ?? undefined,
    }))
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
          isValidColor ? null : 'Color invalido. Usa formato HEX, por ejemplo #b88752.',
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

  const updateMultiSkuUnitWeight = (index: number, value: string) => {
    const currentSku = multiDraft.skus[index]
    if (!currentSku) {
      return
    }

    const fieldId = getMultiSkuFieldId(currentSku.id, 'unitWeight')
    setMultiFieldValues((current) => ({
      ...current,
      [fieldId]: value,
    }))

    const trimmed = value.trim()
    if (trimmed.length === 0) {
      setMultiFieldErrors((current) => upsertFieldError(current, fieldId, null))
      setMultiDraft((current) => ({
        ...current,
        skus: current.skus.map((sku, rowIndex) =>
          rowIndex === index
            ? {
                ...sku,
                unitWeightKg: undefined,
              }
            : sku,
        ),
      }))
      return
    }

    const validation = validateDecimalInput(value, {
      label: `Peso unitario del SKU ${index + 1}`,
      min: MIN_WEIGHT_KG,
      maxDecimals: 3,
    })
    setMultiFieldErrors((current) =>
      upsertFieldError(current, fieldId, validation.error),
    )

    if (validation.value === null) {
      return
    }

    setMultiDraft((current) => ({
      ...current,
      skus: current.skus.map((sku, rowIndex) =>
        rowIndex === index
          ? {
              ...sku,
              unitWeightKg: validation.value ?? undefined,
            }
          : sku,
      ),
    }))
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

  const updateMultiSkuMaxLayers = (index: number, value: string) => {
    const currentSku = multiDraft.skus[index]
    if (!currentSku) {
      return
    }

    const fieldId = getMultiSkuFieldId(currentSku.id, 'maxLayers')
    setMultiFieldValues((current) => ({
      ...current,
      [fieldId]: value,
    }))

    const trimmed = value.trim()
    if (trimmed.length === 0) {
      setMultiFieldErrors((current) => upsertFieldError(current, fieldId, null))
      setMultiDraft((current) => ({
        ...current,
        skus: current.skus.map((sku, rowIndex) =>
          rowIndex === index
            ? {
                ...sku,
                maxLayers: undefined,
              }
            : sku,
        ),
      }))
      return
    }

    const validation = validateIntegerInput(value, {
      label: `Capas maximas del SKU ${index + 1}`,
      min: 1,
    })
    setMultiFieldErrors((current) =>
      upsertFieldError(current, fieldId, validation.error),
    )
    if (validation.value === null) {
      return
    }

    setMultiDraft((current) => ({
      ...current,
      skus: current.skus.map((sku, rowIndex) =>
        rowIndex === index
          ? {
              ...sku,
              maxLayers: validation.value ?? undefined,
            }
          : sku,
      ),
    }))
  }

  const updateMultiSkuNoStack = (index: number, checked: boolean) => {
    setMultiDraft((current) => ({
      ...current,
      skus: current.skus.map((item, rowIndex) =>
        rowIndex === index
          ? {
              ...item,
              noStack: checked,
              maxLayers: checked ? 1 : item.maxLayers,
            }
          : item,
      ),
    }))

    if (checked) {
      const currentSku = multiDraft.skus[index]
      if (currentSku) {
        setMultiFieldValues((current) => ({
          ...current,
          [getMultiSkuFieldId(currentSku.id, 'maxLayers')]: '1',
        }))
        setMultiFieldErrors((current) =>
          upsertFieldError(current, getMultiSkuFieldId(currentSku.id, 'maxLayers'), null),
        )
      }
    }
  }

  const addMultiSku = () => {
    if (multiDraft.skus.length >= 20) {
      setScenarioNotice('Limite de 20 SKUs alcanzado para la vista previa multicaja.')
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

    if (multiDraft.noMixedSkuStacking) {
      const input = cloneMultiPreviewInput(multiDraft)
      const result = solveMultiHeuristicNoMix(input)
      setMultiApplied(cloneMultiState(multiDraft))
      setMultiAlgorithm('heuristic')
      setMultiHeuristicResult(result)
      setLastGeneratedAt(new Date())
      setShareStatus(null)
      setScenarioNotice(
        result.errors.length > 0
          ? 'La heuristica no-mix encontro errores. No se aplico vista previa.'
          : null,
      )
      return
    }

    setMultiApplied(cloneMultiState(multiDraft))
    setMultiAlgorithm('preview')
    setMultiHeuristicResult(null)
    setLastGeneratedAt(new Date())
    setShareStatus(null)
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
      if (multiDraft.noMixedSkuStacking) {
        const result = solveMultiHeuristicNoMix(input)
        setMultiApplied(cloneMultiState(multiDraft))
        setMultiAlgorithm('heuristic')
        setMultiHeuristicResult(result)
        setLastGeneratedAt(new Date())
        setShareStatus(null)
        setScenarioNotice(
          result.errors.length > 0
            ? 'La heuristica no-mix encontro errores. Se mantiene el resultado no-mix para revision.'
            : null,
        )
        return
      }

      const result = solveMultiHeuristic(input)
      if (result.errors.length > 0) {
        setScenarioNotice('La heuristica encontro errores de entrada. Se mantiene la vista previa.')
        return
      }

      setMultiApplied(cloneMultiState(multiDraft))
      setMultiAlgorithm('heuristic')
      setMultiHeuristicResult(result)
      setScenarioNotice(null)
      setLastGeneratedAt(new Date())
      setShareStatus(null)
    } catch {
      if (multiDraft.noMixedSkuStacking) {
        setMultiApplied(cloneMultiState(multiDraft))
        setMultiAlgorithm('heuristic')
        setMultiHeuristicResult(
          buildMultiNoMixErrorResult(
            multiDraft,
            'No se pudo ejecutar la heuristica no-mix.',
          ),
        )
        setScenarioNotice('No se pudo ejecutar la heuristica no-mix.')
        return
      }

      setScenarioNotice('No se pudo ejecutar la heuristica. Se mantiene la vista previa multicaja.')
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
    if (next.noMixedSkuStacking) {
      setMultiAlgorithm('heuristic')
      setMultiHeuristicResult(solveMultiHeuristicNoMix(cloneMultiPreviewInput(next)))
    } else {
      setMultiAlgorithm('preview')
      setMultiHeuristicResult(null)
    }
    setLastGeneratedAt(new Date())
    setScenarioNotice(null)
    setShareStatus(null)
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
              boxPresetId: singleBoxPreset,
              packingMode: singlePackingModeApplied,
              boxSkinMode,
              labelSkuRefs: singleLabelRefs,
            },
          }
        : activeTab === 'multi'
          ? {
              ...baseScenario,
              mode: 'multi',
              multi: {
                input: cloneMultiPreviewInput(multiApplied),
                result: multiResult,
                boxSkinMode,
                labelSkuRefs: multiLabelRefs,
              },
            }
          : {
              ...baseScenario,
              mode: 'container',
              container: {
                input: cloneContainerInput(containerApplied),
                result: containerResult,
                boxSkinMode,
                labelSkuRefs: containerLabelRefs,
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
      setSingleBoxPreset(scenario.single.boxPresetId ?? detectBoxPreset(nextInput.box))
      const nextPackingMode =
        scenario.single.packingMode ?? resolveStandardSinglePackingMode(nextInput)
      setSinglePackingModeDraft(nextPackingMode)
      setSinglePackingModeApplied(nextPackingMode)
      setDraftInput(nextInput)
      setAppliedInput(nextInput)
      setSingleFieldValues(buildSingleFieldValues(nextInput))
      setSingleFieldErrors({})
      setMultiAlgorithm('preview')
      setMultiHeuristicResult(null)
      setBoxSkinMode(scenario.single.boxSkinMode ?? 'box')
      setLastCalculatedAt(new Date())
      return
    }

    if (scenario.mode === 'multi') {
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
      setBoxSkinMode(scenario.multi.boxSkinMode ?? 'box')
      setLastGeneratedAt(new Date())
      return
    }

    const nextContainer = cloneContainerInput(scenario.container.input)
    setActiveTab('container')
    setContainerDraft(nextContainer)
    setContainerApplied(nextContainer)
    setContainerPreset(detectContainerPreset(nextContainer.container))
    setContainerFieldValues(buildContainerFieldValues(nextContainer))
    setContainerFieldErrors({})
    setBoxSkinMode(scenario.container.boxSkinMode ?? 'box')
    setContainerPalletLoad(null)
    setLastContainerCalculatedAt(new Date())
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

  const areaUtilizationText = formatPercent(singleAreaUtilization)
  const volumeUtilizationText = formatPercent(singleVolumeUtilization)

  const shareCurrentSingle = async () => {
    const query = buildShareQuery(appliedInput, 'single', {
      boxPresetId: singleBoxPreset,
      packingMode: singlePackingModeApplied,
      boxSkinMode,
    })
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

  const shareCurrentMulti = async () => {
    const query = buildShareQuery(appliedInput, 'multi', {
      noMixedSkuStacking: multiDraft.noMixedSkuStacking,
      boxSkinMode,
    })
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

  const shareCurrentContainer = async () => {
    if ((containerApplied.pallets?.length ?? 0) > 0) {
      setShareStatus(
        'El modo consolidado no se serializa en enlace. Guarda un escenario para compartir el catalogo.',
      )
      return
    }

    const query = buildShareQuery(containerApplied, 'container', { boxSkinMode })
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

  const exportContainerJsonPlan = () => {
    const generatedAt = new Date().toISOString()
    exportContainerPlanJson({
      input: cloneContainerInput(containerApplied),
      result: containerResult,
      derivedMetrics: containerDerivedMetrics,
      weightMetrics: containerWeightMetrics,
      labelsBySku: skuLabelsBySku,
      generatedAt,
    })
  }

  const exportContainerTopViewPlan = () => {
    const generatedAt = new Date().toISOString()
    void exportTopViewPng(
      containerTopViewSvg,
      buildContainerTopViewPngFilename(generatedAt),
    )
  }

  const authContextValue = useMemo(
    () => ({
      user: authUser ?? TEST_AUTH_USER,
      logout: handleLogout,
      logoutPending: authLogoutSubmitting,
    }),
    [authLogoutSubmitting, authUser],
  )

  if (authStatus !== 'authenticated' || authUser === null) {
    return (
      <AuthScreen
        status={authStatus === 'checking' ? 'checking' : 'unauthenticated'}
        mode={authMode}
        identifier={authIdentifier}
        password={authPassword}
        registerDraft={registerDraft}
        registerErrors={registerErrors}
        error={authError}
        showRetryConnection={authShowRetryConnection}
        submitting={authSubmitting}
        onIdentifierChange={handleAuthIdentifierChange}
        onPasswordChange={handleAuthPasswordChange}
        onRegisterFieldChange={handleRegisterFieldChange}
        onSubmit={() => {
          if (authMode === 'register') {
            void runAuthRegister()
            return
          }

          void runAuthLogin()
        }}
        onModeChange={(nextMode) => {
          handleAuthModeChange(nextMode)
        }}
        onRetrySession={() => {
          void retryAuthSession()
        }}
        sislopeUrl={SISLOPE_URL}
      />
    )
  }

  return (
    <AuthProvider value={authContextValue}>
      <main className="app-shell">
        <Header
          sislopeUrl={SISLOPE_URL}
          importCalcUrl={IMPORT_CALC_URL}
          boxSkinMode={boxSkinMode}
          onBoxSkinModeChange={setBoxSkinMode}
          onExportTradeCase={handleExportTradeCase}
        />

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
        <button
          type="button"
          className={`tab-button ${activeTab === 'container' ? 'active' : ''}`}
          onClick={() => setActiveTab('container')}
        >
          Contenedores
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
                    Preset de pallet
                    <strong>predef.</strong>
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
                <NumberField
                  id="pallet-weight"
                  label="Peso pallet base"
                  min={MIN_WEIGHT_KG}
                  step={0.001}
                  unit="kg"
                  value={singleFieldValues['pallet-weight']}
                  error={singleFieldErrors['pallet-weight']}
                  onChange={updateSinglePalletWeight}
                />
              </div>

              <div className="field-group">
                <h3>Caja maestra</h3>
                <label className="field" htmlFor="single-box-preset">
                  <span>
                    Preset de caja maestra
                    <strong>predef.</strong>
                  </span>
                  <select
                    id="single-box-preset"
                    value={singleBoxPreset}
                    onChange={(event) =>
                      applySingleBoxPreset(event.target.value as BoxPresetId)
                    }
                  >
                    {BOX_PRESET_OPTIONS.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </label>
                <NumberField
                  id="box-length"
                  label="Largo"
                  min={MIN_SINGLE_BOX_DIMENSION_MM}
                  value={singleFieldValues['box-length']}
                  error={singleFieldErrors['box-length']}
                  onChange={(value) =>
                    updateSingleDimensions('box-length', 'box', 'length', value)
                  }
                />
                <NumberField
                  id="box-width"
                  label="Ancho"
                  min={MIN_SINGLE_BOX_DIMENSION_MM}
                  value={singleFieldValues['box-width']}
                  error={singleFieldErrors['box-width']}
                  onChange={(value) =>
                    updateSingleDimensions('box-width', 'box', 'width', value)
                  }
                />
                <NumberField
                  id="box-height"
                  label="Alto"
                  min={MIN_SINGLE_BOX_DIMENSION_MM}
                  value={singleFieldValues['box-height']}
                  error={singleFieldErrors['box-height']}
                  onChange={(value) =>
                    updateSingleDimensions('box-height', 'box', 'height', value)
                  }
                />
                <NumberField
                  id="box-unit-weight"
                  label="Peso por caja/saco"
                  min={MIN_WEIGHT_KG}
                  step={0.001}
                  unit="kg"
                  value={singleFieldValues['box-unit-weight']}
                  error={singleFieldErrors['box-unit-weight']}
                  onChange={updateSingleBoxUnitWeight}
                />
              </div>

              <div className="field-group">
                <h3>Modo de empaque</h3>
                <label className="field" htmlFor="single-packing-mode">
                  <span>
                    Modo de empaque
                    <strong>modo</strong>
                  </span>
                  <select
                    id="single-packing-mode"
                    value={singlePackingModeDraft}
                    onChange={(event) =>
                      setSinglePackingModeDraft(event.target.value as PackingMode)
                    }
                  >
                    <option value="grid">Regular</option>
                    <option value="advanced">Optimizado</option>
                  </select>
                </label>
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
                  label="Voladizo"
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

            <div className="scene-column">
              <article className="panel scene-panel">
                <div className="scene-toolbar">
                  <EditToggleButton onClick={openSingleLabelEditor} />
                </div>
                <div className="scene-panel-stack">
                  <Scene
                    input={appliedInput}
                    result={result}
                    boxesOverride={singleBoxes}
                    labelsBySku={skuLabelsBySku}
                    defaultSkuId={SINGLE_BOX_SKU_ID}
                    boxSkinMode={boxSkinMode}
                    onCanvasReady={setSingleCanvas}
                  />
                </div>
              </article>

              <article className="panel scene-summary-panel">
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
                      Compartir enlace
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() =>
                        exportJson({
                          input: appliedInput,
                          result,
                          derivedMetrics: singleDerivedMetrics,
                          labelsBySku: skuLabelsBySku,
                          generatedAt: new Date().toISOString(),
                        })
                      }
                    >
                      Exportar JSON
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => exportPng(singleCanvas)}
                      disabled={singleCanvas === null}
                    >
                      Exportar PNG
                    </button>
                  </div>
                </div>

                {shareStatus && <p className="meta-text">{shareStatus}</p>}

                <div className="kpi-grid summary-kpi-grid">
                  <article className="kpi">
                    <span>Total cajas</span>
                    <strong>{formatInt.format(singleTotalBoxes)}</strong>
                  </article>
                  <article className="kpi">
                    <span>Cajas por capa</span>
                    <strong>{formatInt.format(singlePerLayer)}</strong>
                  </article>
                  <article className="kpi">
                    <span>Capas</span>
                    <strong>{formatInt.format(result.layers)}</strong>
                  </article>
                  <article className="kpi">
                    <span>Altura total</span>
                    <strong>{formatInt.format(singleTotalHeight)} mm</strong>
                  </article>
                  <article className="kpi">
                    <span>Area ocupada por capa</span>
                    <strong>{formatAreaM2FromMm2(singleDerivedMetrics.usedAreaPerLayerMm2)}</strong>
                  </article>
                  <article className="kpi">
                    <span>Volumen de cajas</span>
                    <strong>{formatVolumeM3FromMm3(singleDerivedMetrics.totalBoxesVolumeMm3)}</strong>
                  </article>
                  <article className="kpi">
                    <span>Peso total palletizado</span>
                    <strong>
                      {singlePalletizedWeightKg !== null
                        ? `${formatKg.format(singlePalletizedWeightKg)} kg`
                        : 'No definido'}
                    </strong>
                  </article>
                </div>
              </article>
            </div>
          </section>

          <section className="panel outputs-panel outputs-panel-technical">
            <div className="outputs-header">
              <h2>Dibujo tecnico y detalle</h2>
            </div>

            <TopViewLayer
              palletLength={appliedInput.pallet.length}
              palletWidth={appliedInput.pallet.width}
              selected={result.selected}
              layers={result.layers}
              placements2D={
                singleIsAdvanced ? singleAdvancedResult.layerPlacements2D : undefined
              }
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
                    {singleIsAdvanced
                      ? 'Mixta por item (0/90 grados)'
                      : `${result.selected.orientation} (${result.selected.boxFootprintL} x ${result.selected.boxFootprintW})`}
                  </td>
                </tr>
                <tr>
                  <th>nx</th>
                  <td>{singleIsAdvanced ? '-' : formatInt.format(result.selected.nx)}</td>
                </tr>
                <tr>
                  <th>ny</th>
                  <td>{singleIsAdvanced ? '-' : formatInt.format(result.selected.ny)}</td>
                </tr>
                <tr>
                  <th>Cajas por capa</th>
                  <td>{formatInt.format(singlePerLayer)}</td>
                </tr>
                <tr>
                  <th>Capas</th>
                  <td>{formatInt.format(result.layers)}</td>
                </tr>
                <tr>
                  <th>Total cajas</th>
                  <td>{formatInt.format(singleTotalBoxes)}</td>
                </tr>
                <tr>
                  <th>Altura total (mm)</th>
                  <td>{formatInt.format(singleTotalHeight)}</td>
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
                  <th>Area pallet (mÃ‚Â² / mmÃ‚Â²)</th>
                  <td>{formatAreaDualFromMm2(singleDerivedMetrics.palletAreaMm2)}</td>
                </tr>
                <tr>
                  <th>Area ocupada por capa (mÃ‚Â² / mmÃ‚Â²)</th>
                  <td>{formatAreaDualFromMm2(singleDerivedMetrics.usedAreaPerLayerMm2)}</td>
                </tr>
                <tr>
                  <th>Area libre por capa (mÃ‚Â² / mmÃ‚Â²)</th>
                  <td>{formatAreaDualFromMm2(singleDerivedMetrics.freeAreaPerLayerMm2)}</td>
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
                  <th>Volumen total de cajas (mÃ‚Â³ / mmÃ‚Â³)</th>
                  <td>{formatVolumeDualFromMm3(singleDerivedMetrics.totalBoxesVolumeMm3)}</td>
                </tr>
                <tr>
                  <th>Volumen base de pallet (mÃ‚Â³ / mmÃ‚Â³)</th>
                  <td>{formatVolumeDualFromMm3(singleDerivedMetrics.palletBaseVolumeMm3)}</td>
                </tr>
                <tr>
                  <th>Volumen total unitarizado (mÃ‚Â³ / mmÃ‚Â³)</th>
                  <td>{formatVolumeDualFromMm3(singleDerivedMetrics.totalUnitizedVolumeMm3)}</td>
                </tr>
                <tr>
                  <th>Peso pallet base (kg)</th>
                  <td>
                    {singlePalletBaseWeightKg !== null
                      ? formatKg.format(singlePalletBaseWeightKg)
                      : 'No definido'}
                  </td>
                </tr>
                <tr>
                  <th>Peso carga (kg)</th>
                  <td>
                    {singleBoxesWeightKg !== null
                      ? formatKg.format(singleBoxesWeightKg)
                      : 'No definido'}
                  </td>
                </tr>
                <tr>
                  <th>Peso total palletizado (kg)</th>
                  <td>
                    {singlePalletizedWeightKg !== null
                      ? formatKg.format(singlePalletizedWeightKg)
                      : 'No definido'}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        </>
      ) : activeTab === 'multi' ? (
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
                    Preset de pallet
                    <strong>predef.</strong>
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
                <NumberField
                  id="multi-pallet-weight"
                  label="Peso pallet base"
                  min={MIN_WEIGHT_KG}
                  step={0.001}
                  unit="kg"
                  value={multiFieldValues['multi-pallet-weight']}
                  error={multiFieldErrors['multi-pallet-weight']}
                  onChange={updateMultiPalletWeight}
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
                  label="Voladizo"
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
                <label className="checkbox-row" htmlFor="multi-no-mix-stacking">
                  <input
                    id="multi-no-mix-stacking"
                    type="checkbox"
                    checked={multiDraft.noMixedSkuStacking}
                    onChange={(event) =>
                      setMultiDraft((current) => ({
                        ...current,
                        noMixedSkuStacking: event.target.checked,
                      }))
                    }
                  />
                  <span>No mezclar SKU en apilado (columnas por SKU)</span>
                </label>
                <label className="checkbox-row" htmlFor="multi-show-labels">
                  <input
                    id="multi-show-labels"
                    type="checkbox"
                    checked={multiShowLabels}
                    onChange={(event) => setMultiShowLabels(event.target.checked)}
                  />
                  <span>Mostrar etiquetas de SKU en 3D</span>
                </label>
              </div>

              <div className="field-group">
                <h3>Catalogo de SKUs</h3>
                <div className="action-row">
                  <button type="button" className="btn-secondary" onClick={addMultiSku}>
                    Agregar SKU
                  </button>
                  <button type="button" className="btn-secondary" onClick={clearMultiSkus}>
                    Limpiar
                  </button>
                  <button type="button" className="btn-secondary" onClick={openMultiLabelEditor}>
                    Editar caja (SKU)
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
                        Quitar SKU
                      </button>
                    </div>
                    <label className="field" htmlFor={getMultiSkuFieldId(item.id, 'skuId')}>
                      {(() => {
                        const skuIdField = getMultiSkuFieldId(item.id, 'skuId')
                        return (
                          <>
                            <span>
                              ID SKU
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
                    <NumberField
                      id={getMultiSkuFieldId(item.id, 'unitWeight')}
                      label="Peso unitario"
                      min={MIN_WEIGHT_KG}
                      step={0.001}
                      unit="kg"
                      value={multiFieldValues[getMultiSkuFieldId(item.id, 'unitWeight')] ?? ''}
                      error={multiFieldErrors[getMultiSkuFieldId(item.id, 'unitWeight')]}
                      onChange={(value) => updateMultiSkuUnitWeight(index, value)}
                    />
                    <NumberField
                      id={getMultiSkuFieldId(item.id, 'maxLayers')}
                      label="Capas maximas SKU"
                      min={1}
                      unit="capas"
                      value={multiFieldValues[getMultiSkuFieldId(item.id, 'maxLayers')] ?? ''}
                      error={multiFieldErrors[getMultiSkuFieldId(item.id, 'maxLayers')]}
                      onChange={(value) => updateMultiSkuMaxLayers(index, value)}
                    />
                    <label className="field" htmlFor={getMultiSkuFieldId(item.id, 'color')}>
                      {(() => {
                        const colorField = getMultiSkuFieldId(item.id, 'color')
                        return (
                          <>
                            <span>
                              Color hexadecimal
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
                    <label className="checkbox-row" htmlFor={`multi-sku-nostack-${item.id}`}>
                      <input
                        id={`multi-sku-nostack-${item.id}`}
                        type="checkbox"
                        checked={Boolean(item.noStack)}
                        onChange={(event) =>
                          updateMultiSkuNoStack(index, event.target.checked)
                        }
                      />
                      <span>No apilar (solo capa 0)</span>
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
                  Resolver (heuristica)
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
                labelsBySku={skuLabelsBySku}
                boxSkinMode={boxSkinMode}
              />
            </article>
          </section>

          <section className="panel outputs-panel">
            <div className="outputs-header">
              <h2>Resultados multicaja</h2>
              <div className="button-row">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    void shareCurrentMulti()
                  }}
                >
                  Compartir enlace
                </button>
                <span className={multiResult.unplacedTotal > 0 ? 'chip pending' : 'chip ready'}>
                  {multiResult.algorithm === 'heuristic'
                    ? multiResult.solverVariant === 'heuristic-columns'
                      ? 'Heuristica por columnas SKU'
                      : 'Heuristica FFD'
                    : 'Vista previa por grilla'}
                </span>
              </div>
            </div>

            {shareStatus && <p className="meta-text">{shareStatus}</p>}

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
              <article className="kpi">
                <span>Peso total palletizado</span>
                <strong>
                  {multiPalletizedWeightKg !== null
                    ? `${formatKg.format(multiPalletizedWeightKg)} kg`
                    : 'No definido'}
                </strong>
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
                    <th>Peso pallet base (kg)</th>
                    <td>
                      {multiPalletBaseWeightKg !== null
                        ? formatKg.format(multiPalletBaseWeightKg)
                        : 'No definido'}
                    </td>
                  </tr>
                  <tr>
                    <th>Peso carga (kg)</th>
                    <td>
                      {multiBoxesWeightKg !== null
                        ? formatKg.format(multiBoxesWeightKg)
                        : 'No definido'}
                    </td>
                  </tr>
                  <tr>
                    <th>Peso total palletizado (kg)</th>
                    <td>
                      {multiPalletizedWeightKg !== null
                        ? formatKg.format(multiPalletizedWeightKg)
                        : 'No definido'}
                    </td>
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
      ) : (
        <>
          <section className="top-grid">
            <form
              className="panel form-panel"
              onSubmit={(event) => {
                event.preventDefault()
                runContainerCalculation()
              }}
            >
              <div className="form-title-row">
                <h2>Carga en contenedor</h2>
                <span className={hasPendingContainer ? 'chip pending' : 'chip ready'}>
                  {hasPendingContainer ? 'Cambios sin calcular' : 'Calculo al dia'}
                </span>
              </div>

              <div className="field-group">
                <h3>Contenedor</h3>
                <label className="field" htmlFor="container-preset">
                  <span>
                    Preset de contenedor
                    <strong>predef.</strong>
                  </span>
                  <select
                    id="container-preset"
                    value={containerPreset}
                    onChange={(event) =>
                      applyContainerPreset(event.target.value as ContainerPresetKey)
                    }
                  >
                    {CONTAINER_PRESET_OPTIONS.map((preset) => (
                      <option key={preset.key} value={preset.key}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </label>
                <NumberField
                  id="container-length"
                  label="Largo interno"
                  min={1}
                  value={containerFieldValues['container-length']}
                  error={containerFieldErrors['container-length']}
                  onChange={(value) =>
                    updateContainerDimensions('container-length', 'container', 'length', value)
                  }
                />
                <NumberField
                  id="container-width"
                  label="Ancho interno"
                  min={1}
                  value={containerFieldValues['container-width']}
                  error={containerFieldErrors['container-width']}
                  onChange={(value) =>
                    updateContainerDimensions('container-width', 'container', 'width', value)
                  }
                />
                <NumberField
                  id="container-height"
                  label="Alto interno"
                  min={1}
                  value={containerFieldValues['container-height']}
                  error={containerFieldErrors['container-height']}
                  onChange={(value) =>
                    updateContainerDimensions('container-height', 'container', 'height', value)
                  }
                />
              </div>

              <div className="field-group">
                <h3>Pallet de carga</h3>
                <label className="field" htmlFor="container-pallet-source">
                  <span>
                    Fuente de pallet
                    <strong>origen</strong>
                  </span>
                  <select
                    id="container-pallet-source"
                    value={containerPalletSource}
                    onChange={(event) =>
                      setContainerPalletSource(event.target.value as ContainerPalletSource)
                    }
                  >
                    <option value="single">Resultado caja unica</option>
                    <option value="multi">Resultado multiples cajas</option>
                  </select>
                </label>
                <button
                  id="container-use-current"
                  type="button"
                  className="btn-secondary"
                  onClick={addCurrentPalletToCatalog}
                >
                  Agregar pallet actual
                </button>
                <p className="meta-text">
                  Cada clic agrega 1 unidad del pallet aplicado al catalogo consolidado.
                </p>
                <NumberField
                  id="container-pallet-length"
                  label="Largo pallet"
                  min={1}
                  value={containerFieldValues['container-pallet-length']}
                  error={containerFieldErrors['container-pallet-length']}
                  onChange={(value) =>
                    updateContainerDimensions(
                      'container-pallet-length',
                      'pallet',
                      'length',
                      value,
                    )
                  }
                />
                <NumberField
                  id="container-pallet-width"
                  label="Ancho pallet"
                  min={1}
                  value={containerFieldValues['container-pallet-width']}
                  error={containerFieldErrors['container-pallet-width']}
                  onChange={(value) =>
                    updateContainerDimensions('container-pallet-width', 'pallet', 'width', value)
                  }
                />
                <NumberField
                  id="container-pallet-height"
                  label="Alto pallet carga"
                  min={1}
                  value={containerFieldValues['container-pallet-height']}
                  error={containerFieldErrors['container-pallet-height']}
                  onChange={(value) =>
                    updateContainerDimensions(
                      'container-pallet-height',
                      'pallet',
                      'height',
                      value,
                    )
                  }
                />
              </div>

              <div className="field-group">
                <h3>Catalogo consolidado</h3>
                {containerDraft.pallets && containerDraft.pallets.length > 0 ? (
                  <div className="scenario-list" data-testid="container-pallet-catalog">
                    {containerDraft.pallets.map((entry) => (
                      <article key={entry.id} className="scenario-card">
                        <div>
                          <strong>{entry.name}</strong>
                          <p className="meta-text">
                            {entry.source === 'multi' ? 'Origen: multiples cajas' : 'Origen: caja unica'}
                          </p>
                          <p className="meta-text">
                            {entry.pallet.length} x {entry.pallet.width} x {entry.pallet.height} mm
                          </p>
                          <p className="meta-text">
                            Peso por pallet:{' '}
                            {entry.weightPerPalletKg === undefined
                              ? 'No definido'
                              : formatWeightDualFromKg(entry.weightPerPalletKg)}
                          </p>
                        </div>
                        <div className="button-row">
                          <span className="meta-text">Cantidad: {entry.quantity}</span>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => adjustContainerCatalogQuantity(entry.id, 1)}
                          >
                            +1
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => adjustContainerCatalogQuantity(entry.id, -1)}
                          >
                            -1
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => removeContainerCatalogEntry(entry.id)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="meta-text">
                    Sin pallets agregados. Si el catalogo queda vacio, el modo contenedor simple
                    sigue usando el pallet unico manual.
                  </p>
                )}
              </div>

              <div className="field-group">
                <h3>Reglas operativas</h3>
                <NumberField
                  id="container-clearance"
                  label="Separacion entre pallets"
                  min={0}
                  value={containerFieldValues['container-clearance']}
                  error={containerFieldErrors['container-clearance']}
                  onChange={(value) =>
                    updateContainerCommonField('container-clearance', 'clearance', value)
                  }
                />
                <NumberField
                  id="container-weight-per-pallet"
                  label="Peso por pallet"
                  min={MIN_WEIGHT_KG}
                  step={0.001}
                  unit="kg"
                  value={containerFieldValues['container-weight-per-pallet']}
                  error={containerFieldErrors['container-weight-per-pallet']}
                  onChange={(value) =>
                    updateContainerCommonField(
                      'container-weight-per-pallet',
                      'weightPerPalletKg',
                      value,
                    )
                  }
                />
                <NumberField
                  id="container-payload-max"
                  label="Carga util maxima"
                  min={MIN_WEIGHT_KG}
                  step={0.001}
                  unit="kg"
                  value={containerFieldValues['container-payload-max']}
                  error={containerFieldErrors['container-payload-max']}
                  onChange={(value) =>
                    updateContainerCommonField('container-payload-max', 'payloadMaxKg', value)
                  }
                />
                <label className="checkbox-row" htmlFor="container-allow-rotation">
                  <input
                    id="container-allow-rotation"
                    type="checkbox"
                    checked={containerDraft.allowRotation}
                    onChange={(event) =>
                      setContainerDraft((current) => ({
                        ...current,
                        allowRotation: event.target.checked,
                      }))
                    }
                  />
                  <span>Permitir rotacion 90 grados</span>
                </label>
                <label className="checkbox-row" htmlFor="container-allow-alternating-pattern">
                  <input
                    id="container-allow-alternating-pattern"
                    type="checkbox"
                    checked={containerDraft.allowAlternatingPattern ?? true}
                    onChange={(event) =>
                      setContainerDraft((current) => ({
                        ...current,
                        allowAlternatingPattern: event.target.checked,
                      }))
                    }
                  />
                  <span>Permitir patron alternado</span>
                </label>
              </div>

              {containerHasValidationErrors && (
                <p className="form-error">Corrige los campos marcados antes de calcular.</p>
              )}

              <div className="action-row">
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={containerHasValidationErrors}
                >
                  {hasPendingContainer ? 'Calcular contenedor' : 'Recalcular contenedor'}
                </button>
                <button type="button" className="btn-secondary" onClick={resetContainer}>
                  Restablecer
                </button>
              </div>

              <p className="meta-text">
                Ultimo calculo:{' '}
                {lastContainerCalculatedAt.toLocaleTimeString('es-ES', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </p>
            </form>

            <article className="panel scene-panel">
              <SceneContainer
                input={containerApplied}
                result={containerResult}
                palletLoad={containerPalletLoad}
                palletCatalog={containerCatalogEntries}
                labelsBySku={skuLabelsBySku}
                boxSkinMode={boxSkinMode}
              />
            </article>
          </section>

          <section className="panel outputs-panel">
            <div className="outputs-header">
              <h2>Resultados contenedor</h2>
              <div className="button-row">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    void shareCurrentContainer()
                  }}
                >
                  Compartir enlace
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={exportContainerJsonPlan}
                >
                  Exportar plan JSON
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={exportContainerTopViewPlan}
                  disabled={containerTopViewSvg === null}
                >
                  Exportar plan PNG
                </button>
              </div>
            </div>

            {shareStatus && <p className="meta-text">{shareStatus}</p>}

            <div className="kpi-grid">
              <article className="kpi">
                <span>{containerIsConsolidated ? 'Pallets colocados por espacio' : 'Pallets por cama'}</span>
                <strong>{formatInt.format(containerResult.totalPalletsBySpace)}</strong>
              </article>
              <article className="kpi">
                <span>Total de pallets</span>
                <strong>{formatInt.format(containerResult.totalPallets)}</strong>
              </article>
              <article className="kpi">
                <span>Utilizacion area</span>
                <strong>{formatPercent(containerResult.utilizationArea)}</strong>
              </article>
              <article className="kpi">
                <span>Utilizacion volumen</span>
                <strong>{formatPercent(containerResult.utilizationVolume)}</strong>
              </article>
              <article className="kpi">
                <span>Area ocupada pallets</span>
                <strong>{formatAreaM2FromMm2(containerDerivedMetrics.occupiedFootprintAreaMm2)}</strong>
              </article>
              <article className="kpi">
                <span>Volumen carga</span>
                <strong>{formatVolumeM3FromMm3(containerDerivedMetrics.loadVolumeMm3)}</strong>
              </article>
              <article className="kpi">
                <span>Peso por pallet</span>
                <strong>
                  {containerWeightMetrics.weightPerPalletKg === null
                    ? 'No definido'
                    : formatWeightDualFromKg(containerWeightMetrics.weightPerPalletKg)}
                </strong>
              </article>
              <article className="kpi">
                <span>Peso total de carga</span>
                <strong>
                  {containerWeightMetrics.totalLoadWeightKg === null
                    ? 'No definido'
                    : formatWeightDualFromKg(containerWeightMetrics.totalLoadWeightKg)}
                </strong>
              </article>
              <article className="kpi">
                <span>Payload permitido</span>
                <strong>
                  {containerWeightMetrics.payloadLimitKg === null
                    ? 'No definido'
                    : formatWeightDualFromKg(containerWeightMetrics.payloadLimitKg)}
                </strong>
              </article>
              <article className="kpi">
                <span>Utilizacion de payload</span>
                <strong>
                  {containerWeightMetrics.payloadUtilizationRatio === null
                    ? '-'
                    : formatPercent(containerWeightMetrics.payloadUtilizationRatio)}
                </strong>
              </article>
              <article className="kpi">
                <span>Margen de payload</span>
                <strong>
                  {containerWeightMetrics.payloadMarginKg === null
                    ? '-'
                    : formatWeightDualFromKg(containerWeightMetrics.payloadMarginKg)}
                </strong>
              </article>
            </div>

            <ContainerTopView
              input={containerApplied}
              result={containerResult}
              technical={containerShowTechnical}
              onTechnicalChange={setContainerShowTechnical}
              onSvgReady={setContainerTopViewSvg}
            />

            {containerResult.errors.length > 0 && (
              <div className="error-box">
                {containerResult.errors.map((error) => (
                  <p key={error}>{error}</p>
                ))}
              </div>
            )}
            {containerResult.warnings.length > 0 && (
              <div className="notice-box">
                {containerResult.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            )}

            <table>
              <tbody>
                <tr>
                  <th>Patron seleccionado</th>
                  <td>{containerResult.patternLabel}</td>
                </tr>
                <tr>
                  <th>Variante solver</th>
                  <td>
                    {containerResult.solverVariant === 'alternating'
                      ? 'Alternado por filas'
                      : containerResult.solverVariant === 'consolidated'
                        ? 'Consolidado por catalogo'
                        : 'Homogeneo'}
                  </td>
                </tr>
                <tr>
                  <th>Plan de filas</th>
                  <td>
                    {(containerResult.rowPattern ?? [])
                      .map((orientation) => (orientation === 'LxW' ? 'A' : 'B'))
                      .join('-') || '-'}
                  </td>
                </tr>
                <tr>
                  <th>Orientacion base</th>
                  <td>
                    {containerResult.solverVariant === 'consolidated'
                      ? '-'
                      : containerResult.selected.orientation}
                  </td>
                </tr>
                <tr>
                  <th>nx</th>
                  <td>
                    {containerResult.solverVariant === 'consolidated'
                      ? '-'
                      : formatInt.format(containerResult.selected.nx)}
                  </td>
                </tr>
                <tr>
                  <th>ny</th>
                  <td>
                    {containerResult.solverVariant === 'consolidated'
                      ? '-'
                      : formatInt.format(containerResult.selected.ny)}
                  </td>
                </tr>
                <tr>
                  <th>Pallets por espacio</th>
                  <td>{formatInt.format(containerResult.totalPalletsBySpace)}</td>
                </tr>
                <tr>
                  <th>Pallets por peso</th>
                  <td>
                    {containerResult.totalPalletsByWeight === null
                      ? '-'
                      : formatInt.format(containerResult.totalPalletsByWeight)}
                  </td>
                </tr>
                <tr>
                  <th>Total de pallets final</th>
                  <td>{formatInt.format(containerResult.totalPallets)}</td>
                </tr>
                <tr>
                  <th>Area interna contenedor (mÃ‚Â² / mmÃ‚Â²)</th>
                  <td>{formatAreaDualFromMm2(containerDerivedMetrics.containerAreaMm2)}</td>
                </tr>
                <tr>
                  <th>Area ocupada pallets - suma huellas (mÃ‚Â² / mmÃ‚Â²)</th>
                  <td>{formatAreaDualFromMm2(containerDerivedMetrics.occupiedFootprintAreaMm2)}</td>
                </tr>
                <tr>
                  <th>Area ocupada pallets - bloque envolvente (mÃ‚Â² / mmÃ‚Â²)</th>
                  <td>{formatAreaDualFromMm2(containerDerivedMetrics.occupiedBlockAreaMm2)}</td>
                </tr>
                <tr>
                  <th>Area libre interna (mÃ‚Â² / mmÃ‚Â²)</th>
                  <td>{formatAreaDualFromMm2(containerDerivedMetrics.freeAreaMm2)}</td>
                </tr>
                <tr>
                  <th>Volumen interno contenedor (mÃ‚Â³ / mmÃ‚Â³)</th>
                  <td>{formatVolumeDualFromMm3(containerDerivedMetrics.containerVolumeMm3)}</td>
                </tr>
                <tr>
                  <th>Volumen carga palletizada (mÃ‚Â³ / mmÃ‚Â³)</th>
                  <td>{formatVolumeDualFromMm3(containerDerivedMetrics.loadVolumeMm3)}</td>
                </tr>
                <tr>
                  <th>Volumen libre interno (mÃ‚Â³ / mmÃ‚Â³)</th>
                  <td>{formatVolumeDualFromMm3(containerDerivedMetrics.freeVolumeMm3)}</td>
                </tr>
                <tr>
                  <th>Residual interno eje largo (mm)</th>
                  <td>{formatInt.format(containerResult.selected.trailingResidualLength)}</td>
                </tr>
                <tr>
                  <th>Residual interno eje ancho (mm)</th>
                  <td>{formatInt.format(containerResult.selected.trailingResidualWidth)}</td>
                </tr>
                <tr>
                  <th>Gap entre pallets (mm)</th>
                  <td>{formatInt.format(containerResult.palletGapMm)}</td>
                </tr>
                <tr>
                  <th>Altura disponible (mm)</th>
                  <td>{formatInt.format(containerResult.availableHeight)}</td>
                </tr>
                <tr>
                  <th>Holgura altura (mm)</th>
                  <td>{formatInt.format(containerResult.freeHeight)}</td>
                </tr>
                <tr>
                  <th>Cabe en altura</th>
                  <td>{containerResult.heightFits ? 'Si' : 'No'}</td>
                </tr>
                <tr>
                  <th>Peso por pallet (kg / t)</th>
                  <td>
                    {containerWeightMetrics.weightPerPalletKg === null
                      ? '-'
                      : formatWeightDualFromKg(containerWeightMetrics.weightPerPalletKg)}
                  </td>
                </tr>
                <tr>
                  <th>Peso total estimado (kg / t)</th>
                  <td>
                    {containerWeightMetrics.totalLoadWeightKg === null
                      ? '-'
                      : formatWeightDualFromKg(containerWeightMetrics.totalLoadWeightKg)}
                  </td>
                </tr>
                <tr>
                  <th>Payload maximo (kg / t)</th>
                  <td>
                    {containerWeightMetrics.payloadLimitKg === null
                      ? '-'
                      : formatWeightDualFromKg(containerWeightMetrics.payloadLimitKg)}
                  </td>
                </tr>
                <tr>
                  <th>Utilizacion de payload (%)</th>
                  <td>
                    {containerWeightMetrics.payloadUtilizationRatio === null
                      ? '-'
                      : formatPercent(containerWeightMetrics.payloadUtilizationRatio)}
                  </td>
                </tr>
                <tr>
                  <th>Margen a payload (kg / t)</th>
                  <td>
                    {containerWeightMetrics.payloadMarginKg === null
                      ? '-'
                      : formatWeightDualFromKg(containerWeightMetrics.payloadMarginKg)}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        </>
      )}

      <section className="panel outputs-panel">
        <div className="outputs-header">
          <h2>Escenarios guardados</h2>
          <button type="button" className="btn-secondary" onClick={saveCurrentScenario}>
            Guardar escenario
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
                <th>Patron / nx x ny</th>
                <th>Capas/Niveles</th>
                <th>Total unidades</th>
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
                    : scenario.mode === 'container'
                      ? scenario.container.result.patternLabel
                      : '-'
                const layers =
                  scenario.mode === 'single'
                    ? String(scenario.single.result.layers)
                    : scenario.mode === 'multi'
                      ? String(scenario.multi.result.layersUsed ?? '-')
                      : String(scenario.container.result.floors)
                const totalBoxes =
                  scenario.mode === 'single'
                    ? scenario.single.result.totalBoxes
                    : scenario.mode === 'multi'
                      ? scenario.multi.result.placedTotal
                      : scenario.container.result.totalPallets
                const utilization =
                  scenario.mode === 'single'
                    ? formatPercent(scenario.single.result.selected.utilization)
                    : scenario.mode === 'multi'
                      ? formatPercent(scenario.multi.result.utilization ?? 0)
                      : formatPercent(scenario.container.result.utilizationArea ?? 0)
                const totalHeight =
                  scenario.mode === 'single'
                    ? scenario.single.result.totalHeight
                    : scenario.mode === 'multi'
                      ? scenario.multi.input.pallet.height + (scenario.multi.result.heightUsed ?? 0)
                      : scenario.container.input.pallet.height
                const modeLabel =
                  scenario.mode === 'single'
                    ? 'Caja unica'
                    : scenario.mode === 'multi'
                      ? 'Multiples cajas'
                      : 'Contenedores'

                return (
                  <tr key={scenario.id}>
                    <td>{scenario.name}</td>
                    <td>{modeLabel}</td>
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
                          Cargar
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => renameScenario(scenario)}
                        >
                          Renombrar
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => deleteScenario(scenario.id)}
                        >
                          Eliminar
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

      <LabelDesignerModal
        isOpen={labelEditorOpen}
        mode={labelEditorMode}
        title={labelEditorMode === 'single' ? 'Editar caja maestra' : 'Editar caja (SKU)'}
        labelsBySku={skuLabelsBySku}
        skuOptions={
          labelEditorMode === 'single'
            ? [
                {
                  skuId: SINGLE_BOX_SKU_ID,
                  name: 'Caja maestra',
                  color: normalizeBaseColor(singleBoxes[0]?.color ?? '#b88752'),
                },
              ]
            : multiLabelSkuOptions
        }
        initialSkuId={labelEditorSkuId}
        skinMode={boxSkinMode}
        onClose={closeLabelEditor}
        onSave={saveLabelConfig}
        onReset={resetLabelConfig}
      />
      </main>
    </AuthProvider>
  )
}

export default App

