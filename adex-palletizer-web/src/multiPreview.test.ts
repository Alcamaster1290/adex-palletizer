import { buildMultiPreview } from './multiPreview'
import type { MultiPreviewInput } from './types'

describe('buildMultiPreview', () => {
  it('genera cajas para un escenario multicaja base', () => {
    const input: MultiPreviewInput = {
      pallet: { length: 1200, width: 1000, height: 150 },
      maxTotalHeight: 1200,
      overhang: 0,
      allowRotation: true,
      boxTypes: [
        { id: 1, length: 600, width: 400, height: 200, units: 8 },
        { id: 2, length: 600, width: 400, height: 200, units: 12 },
      ],
    }

    const result = buildMultiPreview(input)

    expect(result.errors).toHaveLength(0)
    expect(result.placedTotal).toBe(20)
    expect(result.overflowTotal).toBe(0)
    expect(result.boxes.length).toBe(20)
    expect(result.heightUsed).toBe(1000)
  })

  it('reporta overflow por limite de altura', () => {
    const input: MultiPreviewInput = {
      pallet: { length: 1200, width: 1000, height: 150 },
      maxTotalHeight: 1200,
      overhang: 0,
      allowRotation: true,
      boxTypes: [
        { id: 1, length: 600, width: 400, height: 200, units: 40 },
        { id: 2, length: 600, width: 400, height: 200, units: 10 },
      ],
    }

    const result = buildMultiPreview(input)
    const first = result.byType[0]
    const second = result.byType[1]

    expect(first.placed).toBe(20)
    expect(first.overflow).toBe(20)
    expect(second.placed).toBe(0)
    expect(second.overflow).toBe(10)
    expect(result.overflowTotal).toBe(30)
  })

  it('si un tipo no cabe en planta, todo ese tipo queda como overflow', () => {
    const input: MultiPreviewInput = {
      pallet: { length: 500, width: 300, height: 150 },
      maxTotalHeight: 1200,
      overhang: 0,
      allowRotation: true,
      boxTypes: [{ id: 1, length: 600, width: 400, height: 200, units: 6 }],
    }

    const result = buildMultiPreview(input)

    expect(result.byType[0].perLayer).toBe(0)
    expect(result.byType[0].placed).toBe(0)
    expect(result.byType[0].overflow).toBe(6)
    expect(result.boxes).toHaveLength(0)
  })

  it('allowRotation=true puede mejorar colocacion', () => {
    const baseInput: Omit<MultiPreviewInput, 'allowRotation'> = {
      pallet: { length: 1000, width: 700, height: 150 },
      maxTotalHeight: 1000,
      overhang: 0,
      boxTypes: [{ id: 1, length: 700, width: 400, height: 200, units: 8 }],
    }

    const withoutRotation = buildMultiPreview({
      ...baseInput,
      allowRotation: false,
    })
    const withRotation = buildMultiPreview({
      ...baseInput,
      allowRotation: true,
    })

    expect(withRotation.byType[0].placed).toBeGreaterThan(withoutRotation.byType[0].placed)
  })

  it('mantiene orden determinista por tipo en las cajas renderizadas', () => {
    const input: MultiPreviewInput = {
      pallet: { length: 1200, width: 1000, height: 150 },
      maxTotalHeight: 1200,
      overhang: 0,
      allowRotation: true,
      boxTypes: [
        { id: 1, length: 600, width: 400, height: 200, units: 4 },
        { id: 2, length: 600, width: 400, height: 200, units: 4 },
      ],
    }

    const result = buildMultiPreview(input)

    const firstFour = result.boxes.slice(0, 4).map((box) => box.typeId)
    const nextFour = result.boxes.slice(4, 8).map((box) => box.typeId)

    expect(firstFour.every((typeId) => typeId === 1)).toBe(true)
    expect(nextFour.every((typeId) => typeId === 2)).toBe(true)
  })
})
