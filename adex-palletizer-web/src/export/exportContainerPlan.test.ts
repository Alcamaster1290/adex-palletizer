import {
  buildContainerPlanJsonFilename,
  buildContainerTopViewPngFilename,
  exportContainerPlanJson,
} from './exportContainerPlan'
import { CONTAINER_CLEARANCE_MM } from '../constants'
import type { ContainerInput, ContainerResult } from '../types'
import type { ContainerDerivedMetrics, ContainerWeightMetrics } from '../metrics/units'

const sampleInput: ContainerInput = {
  preset: '20gp',
  container: { length: 5898, width: 2352, height: 2393 },
  pallet: { length: 1200, width: 1000, height: 1150 },
  allowRotation: true,
  clearance: CONTAINER_CLEARANCE_MM,
  rearClearance: CONTAINER_CLEARANCE_MM,
  allowAlternatingPattern: true,
}

const sampleResult: ContainerResult = {
  selected: {
    orientation: 'LxW',
    palletFootprintL: 1200,
    palletFootprintW: 1000,
    pitchLength: 1250,
    pitchWidth: 1050,
    marginToWall: 50,
    nx: 4,
    ny: 2,
    perFloor: 8,
    occupiedLength: 4950,
    occupiedWidth: 2050,
    trailingResidualLength: 848,
    trailingResidualWidth: 202,
    utilizationArea: 0.7,
    residualLength: 948,
    residualWidth: 302,
  },
  candidates: [],
  solverVariant: 'homogeneous',
  patternLabel: 'Homogeneo LxW',
  rowPattern: ['LxW'],
  wallClearanceMm: 50,
  rearClearanceMm: 50,
  palletGapMm: 50,
  floors: 1,
  totalPalletsBySpace: 8,
  totalPalletsByWeight: null,
  totalPallets: 8,
  utilizationArea: 0.7,
  utilizationVolume: 0.5,
  heightFits: true,
  availableHeight: 2393,
  freeHeight: 1243,
  weightTotalKg: null,
  containerVolume: 1,
  loadVolume: 1,
  placements: [],
  errors: [],
  warnings: [],
}

describe('exportContainerPlan', () => {
  it('construye nombre de archivo JSON con timestamp', () => {
    expect(buildContainerPlanJsonFilename('2026-03-01T14:05:09.000Z')).toMatch(
      /^container-plan-\d{8}-\d{6}\.json$/,
    )
  })

  it('construye nombre de archivo PNG con timestamp', () => {
    expect(buildContainerTopViewPngFilename('2026-03-01T14:05:09.000Z')).toMatch(
      /^container-topview-\d{8}-\d{6}\.png$/,
    )
  })

  it('exporta JSON con payload, derivedMetrics y nombre esperado', async () => {
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const appendSpy = vi.spyOn(document.body, 'append')
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const stringifySpy = vi.spyOn(JSON, 'stringify')
    const derivedMetrics: ContainerDerivedMetrics = {
      containerAreaMm2: 13876896,
      occupiedFootprintAreaMm2: 9600000,
      occupiedBlockAreaMm2: 10147500,
      freeAreaMm2: 4276896,
      containerVolumeMm3: 33199437888,
      loadVolumeMm3: 11040000000,
      freeVolumeMm3: 22159437888,
    }
    const weightMetrics: ContainerWeightMetrics = {
      weightPerPalletKg: 850.25,
      totalLoadWeightKg: 6802,
      payloadLimitKg: 20000,
      payloadUtilizationRatio: 0.3401,
      payloadMarginKg: 13198,
      tonsPerPallet: 0.85025,
      totalLoadTons: 6.802,
      payloadLimitTons: 20,
      payloadMarginTons: 13.198,
    }

    exportContainerPlanJson({
      input: sampleInput,
      result: sampleResult,
      derivedMetrics,
      weightMetrics,
      generatedAt: '2026-03-01T14:05:09.000Z',
    })

    expect(createObjectURLSpy).toHaveBeenCalledTimes(1)
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:test')
    expect(clickSpy).toHaveBeenCalledTimes(1)

    const link = appendSpy.mock.calls[0]?.[0] as HTMLAnchorElement
    expect(link.download).toMatch(/^container-plan-\d{8}-\d{6}\.json$/)
    expect(stringifySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        derivedMetrics: expect.objectContaining({
          occupiedFootprintAreaMm2: 9600000,
          freeVolumeMm3: 22159437888,
        }),
        weightMetrics: expect.objectContaining({
          weightPerPalletKg: 850.25,
          totalLoadTons: 6.802,
        }),
      }),
      null,
      2,
    )

    createObjectURLSpy.mockRestore()
    revokeObjectURLSpy.mockRestore()
    appendSpy.mockRestore()
    clickSpy.mockRestore()
    stringifySpy.mockRestore()
  })
})
