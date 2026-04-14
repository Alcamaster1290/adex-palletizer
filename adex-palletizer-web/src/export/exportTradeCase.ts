import type {
  ContainerInput,
  ContainerResult,
  MultiPreviewInput,
  MultiPreviewResult,
  MultiSkuInput,
  SolverInput,
  SolverResult,
} from '../types'
import type { ContainerWeightMetrics } from '../metrics/units'

interface TradeCaseSku {
  skuId: string
  name: string
  unit: string
  quantity: number
  fobUnitPrice: number
  weightKg: number
  dimensions: { lengthMm: number; widthMm: number; heightMm: number }
}

interface TradeCasePackagingSummary {
  totalBoxes: number
  totalWeightKg: number | null
  totalVolumeMm3: number
}

interface TradeCasePalletSummary {
  palletSpec: { lengthMm: number; widthMm: number; heightMm: number }
  palletsRequired: number
  boxesPerPallet: number
  layersPerPallet: number
  utilizationPercent: number
  totalHeightMm: number
  weightPerPalletKg: number | null
}

interface TradeCaseContainerSummary {
  containerType: string
  containerSpec: { lengthMm: number; widthMm: number; heightMm: number }
  palletsPerContainer: number
  containersRequired: number
  areaUtilizationPercent: number
  volumeUtilizationPercent: number
  totalLoadWeightKg: number | null
  payloadLimitKg: number | null
}

export interface TradeCaseV1 {
  version: 'trade-case.v1'
  caseId: string
  createdAt: string
  operationType: 'import' | 'export'
  skus: TradeCaseSku[]
  packagingSummary: TradeCasePackagingSummary
  palletSummary: TradeCasePalletSummary
  containerSummary?: TradeCaseContainerSummary
  company?: string
  origin?: string
  destination?: string
  incoterm?: string
  modePreference?: string
  sourceModule: 'adex-palletizer'
}

interface BuildTradeCaseSingleParams {
  input: SolverInput
  result: SolverResult
}

interface BuildTradeCaseMultiParams {
  input: MultiPreviewInput
  result: MultiPreviewResult
}

function buildSkusFromSingle(input: SolverInput, result: SolverResult): TradeCaseSku[] {
  return [
    {
      skuId: 'SKU-1',
      name: 'Caja unica',
      unit: 'UND',
      quantity: result.totalBoxes,
      fobUnitPrice: 0,
      weightKg: input.boxUnitWeightKg ?? 0,
      dimensions: {
        lengthMm: input.box.length,
        widthMm: input.box.width,
        heightMm: input.box.height,
      },
    },
  ]
}

function buildSkusFromMulti(skus: MultiSkuInput[], result: MultiPreviewResult): TradeCaseSku[] {
  return skus.map((sku) => {
    const skuId = sku.skuId || `SKU-${sku.id}`
    const placed = result.placedBySku[skuId] ?? sku.quantity
    return {
      skuId,
      name: sku.name,
      unit: 'UND',
      quantity: placed,
      fobUnitPrice: 0,
      weightKg: sku.unitWeightKg ?? 0,
      dimensions: {
        lengthMm: sku.length,
        widthMm: sku.width,
        heightMm: sku.height,
      },
    }
  })
}

function buildPackagingSummaryFromSingle(
  input: SolverInput,
  result: SolverResult,
): TradeCasePackagingSummary {
  const totalBoxes = result.totalBoxes
  const boxVolume = input.box.length * input.box.width * input.box.height
  const totalVolumeMm3 = totalBoxes * boxVolume
  const totalWeightKg =
    input.boxUnitWeightKg !== undefined ? totalBoxes * input.boxUnitWeightKg : null
  return { totalBoxes, totalWeightKg, totalVolumeMm3 }
}

function buildPackagingSummaryFromMulti(
  skus: MultiSkuInput[],
  result: MultiPreviewResult,
): TradeCasePackagingSummary {
  let totalVolumeMm3 = 0
  let totalWeightKg: number | null = null

  for (const sku of skus) {
    const skuId = sku.skuId || `SKU-${sku.id}`
    const placed = result.placedBySku[skuId] ?? sku.quantity
    totalVolumeMm3 += placed * sku.length * sku.width * sku.height
    if (sku.unitWeightKg !== undefined) {
      totalWeightKg = (totalWeightKg ?? 0) + placed * sku.unitWeightKg
    }
  }

  return { totalBoxes: result.placedTotal, totalWeightKg, totalVolumeMm3 }
}

function buildPalletSummarySingle(
  input: SolverInput,
  result: SolverResult,
): TradeCasePalletSummary {
  return {
    palletSpec: {
      lengthMm: input.pallet.length,
      widthMm: input.pallet.width,
      heightMm: input.pallet.height,
    },
    palletsRequired: 1,
    boxesPerPallet: result.totalBoxes,
    layersPerPallet: result.layers,
    utilizationPercent: result.selected.utilization * 100,
    totalHeightMm: result.totalHeight,
    weightPerPalletKg: input.palletWeightKg ?? null,
  }
}

function buildPalletSummaryMulti(
  input: MultiPreviewInput,
  result: MultiPreviewResult,
): TradeCasePalletSummary {
  return {
    palletSpec: {
      lengthMm: input.pallet.length,
      widthMm: input.pallet.width,
      heightMm: input.pallet.height,
    },
    palletsRequired: 1,
    boxesPerPallet: result.placedTotal,
    layersPerPallet: result.layersUsed,
    utilizationPercent: result.utilization * 100,
    totalHeightMm: result.heightUsed,
    weightPerPalletKg: input.palletWeightKg ?? null,
  }
}

function buildContainerSummary(
  containerInput: ContainerInput,
  containerResult: ContainerResult,
  weightMetrics?: ContainerWeightMetrics,
): TradeCaseContainerSummary {
  return {
    containerType: containerInput.preset,
    containerSpec: {
      lengthMm: containerInput.container.length,
      widthMm: containerInput.container.width,
      heightMm: containerInput.container.height,
    },
    palletsPerContainer: containerResult.totalPallets,
    containersRequired: 1,
    areaUtilizationPercent: containerResult.utilizationArea * 100,
    volumeUtilizationPercent: containerResult.utilizationVolume * 100,
    totalLoadWeightKg: weightMetrics?.totalLoadWeightKg ?? containerResult.weightTotalKg,
    payloadLimitKg: weightMetrics?.payloadLimitKg ?? null,
  }
}

export function buildTradeCaseSingle(
  params: BuildTradeCaseSingleParams,
  containerInput?: ContainerInput,
  containerResult?: ContainerResult,
  weightMetrics?: ContainerWeightMetrics,
): TradeCaseV1 {
  const { input, result } = params

  const tradeCase: TradeCaseV1 = {
    version: 'trade-case.v1',
    caseId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    operationType: 'import',
    skus: buildSkusFromSingle(input, result),
    packagingSummary: buildPackagingSummaryFromSingle(input, result),
    palletSummary: buildPalletSummarySingle(input, result),
    sourceModule: 'adex-palletizer',
  }

  if (containerInput && containerResult) {
    tradeCase.containerSummary = buildContainerSummary(
      containerInput,
      containerResult,
      weightMetrics,
    )
  }

  return tradeCase
}

export function buildTradeCaseMulti(
  params: BuildTradeCaseMultiParams,
  containerInput?: ContainerInput,
  containerResult?: ContainerResult,
  weightMetrics?: ContainerWeightMetrics,
): TradeCaseV1 {
  const { input, result } = params

  const tradeCase: TradeCaseV1 = {
    version: 'trade-case.v1',
    caseId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    operationType: 'import',
    skus: buildSkusFromMulti(input.skus, result),
    packagingSummary: buildPackagingSummaryFromMulti(input.skus, result),
    palletSummary: buildPalletSummaryMulti(input, result),
    sourceModule: 'adex-palletizer',
  }

  if (containerInput && containerResult) {
    tradeCase.containerSummary = buildContainerSummary(
      containerInput,
      containerResult,
      weightMetrics,
    )
  }

  return tradeCase
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

export function downloadTradeCase(tradeCase: TradeCaseV1) {
  const json = JSON.stringify(tradeCase, null, 2)
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `trade-case-${toTimestampToken(tradeCase.createdAt)}.json`
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
