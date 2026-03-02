import { exportJson } from './exportJson'
import type { SolverInput, SolverResult, SkuLabelsBySku } from '../types'

const sampleInput: SolverInput = {
  pallet: { length: 1200, width: 1000, height: 150 },
  box: { length: 600, width: 400, height: 200 },
  maxTotalHeight: 1200,
  allowRotation: true,
  overhang: 0,
}

const sampleResult: SolverResult = {
  selected: {
    orientation: 'LxW',
    boxFootprintL: 600,
    boxFootprintW: 400,
    nx: 2,
    ny: 2,
    perLayer: 4,
    utilization: 0.8,
    areaUsed: 960000,
    areaFree: 240000,
    residualLength: 0,
    residualWidth: 200,
  },
  candidates: [],
  layers: 2,
  totalBoxes: 8,
  totalHeight: 550,
  availableHeight: 1050,
  freeHeight: 650,
  palletArea: 1200000,
  usedArea: 960000,
  freeArea: 240000,
  totalBoxVolume: 1,
  maxLoadVolume: 1,
  volumeUtilization: 1,
  errors: [],
}

describe('exportJson', () => {
  it('admite labelsBySku en payload exportado', () => {
    const labelsBySku: SkuLabelsBySku = {
      'SINGLE-BOX': {
        skuId: 'SINGLE-BOX',
        baseColor: '#2f8f9d',
        template: 'export',
        shippingMarks: {
          consignee: 'A',
          destination: 'B',
          product: 'C',
          lot: 'D',
          cartonNo: 'E',
        },
        isoPictograms: ['fragile'],
        frontTextureDataUrl: 'data:image/png;base64,AAA',
        updatedAt: '2026-03-02T00:00:00.000Z',
      },
    }

    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    exportJson({
      input: sampleInput,
      result: sampleResult,
      labelsBySku,
      generatedAt: '2026-03-02T00:00:00.000Z',
    })

    expect(createObjectURLSpy).toHaveBeenCalledTimes(1)
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:test')

    createObjectURLSpy.mockRestore()
    revokeObjectURLSpy.mockRestore()
    clickSpy.mockRestore()
  })
})
