import {
  buildContainerPlanJsonFilename,
  buildContainerTopViewPngFilename,
  exportContainerPlanJson,
} from './exportContainerPlan'
import { CONTAINER_CLEARANCE_MM } from '../constants'
import type { ContainerInput, ContainerResult } from '../types'

const sampleInput: ContainerInput = {
  preset: '20gp',
  container: { length: 5898, width: 2352, height: 2393 },
  pallet: { length: 1200, width: 1000, height: 1150 },
  allowRotation: true,
  clearance: CONTAINER_CLEARANCE_MM,
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

  it('exporta JSON con payload y nombre esperado', () => {
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const appendSpy = vi.spyOn(document.body, 'append')
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    exportContainerPlanJson({
      input: sampleInput,
      result: sampleResult,
      generatedAt: '2026-03-01T14:05:09.000Z',
    })

    expect(createObjectURLSpy).toHaveBeenCalledTimes(1)
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:test')
    expect(clickSpy).toHaveBeenCalledTimes(1)

    const link = appendSpy.mock.calls[0]?.[0] as HTMLAnchorElement
    expect(link.download).toMatch(/^container-plan-\d{8}-\d{6}\.json$/)

    createObjectURLSpy.mockRestore()
    revokeObjectURLSpy.mockRestore()
    appendSpy.mockRestore()
    clickSpy.mockRestore()
  })
})
