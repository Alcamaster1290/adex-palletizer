import {
  areaMm2ToM2,
  buildContainerDerivedMetrics,
  buildSingleDerivedMetrics,
  formatAreaDualFromMm2,
  formatVolumeDualFromMm3,
  volumeMm3ToM3,
} from './units'
import type { ContainerInput, ContainerResult, SolverInput } from '../types'

describe('metrics/units', () => {
  it('convierte area y volumen desde mm a m con precision estable', () => {
    expect(areaMm2ToM2(1_200_000)).toBe(1.2)
    expect(volumeMm3ToM3(2_750_000_000)).toBe(2.75)
  })

  it('formatea area y volumen en formato dual', () => {
    expect(formatAreaDualFromMm2(1_200_000)).toBe('1,20 m² (1.200.000 mm²)')
    expect(formatVolumeDualFromMm3(2_750_000_000)).toBe('2,75 m³ (2.750.000.000 mm³)')
  })

  it('calcula metricas derivadas de caja unica', () => {
    const input: SolverInput = {
      pallet: { length: 1200, width: 1000, height: 150 },
      box: { length: 600, width: 400, height: 200 },
      maxTotalHeight: 1200,
      allowRotation: true,
      overhang: 0,
    }

    const metrics = buildSingleDerivedMetrics(input, 960000, 240000, 3840000000)

    expect(metrics.palletAreaMm2).toBe(1200000)
    expect(metrics.usedAreaPerLayerMm2).toBe(960000)
    expect(metrics.freeAreaPerLayerMm2).toBe(240000)
    expect(metrics.palletBaseVolumeMm3).toBe(180000000)
    expect(metrics.totalBoxesVolumeMm3).toBe(3840000000)
    expect(metrics.totalUnitizedVolumeMm3).toBe(4020000000)
  })

  it('calcula metricas derivadas de contenedor con huella sumada y volumen', () => {
    const input: ContainerInput = {
      preset: '20gp',
      container: { length: 5898, width: 2352, height: 2393 },
      pallet: { length: 1200, width: 1000, height: 1150 },
      allowRotation: true,
      clearance: 50,
      rearClearance: 0,
      allowAlternatingPattern: true,
    }

    const result: ContainerResult = {
      selected: {
        orientation: 'LxW',
        palletFootprintL: 1200,
        palletFootprintW: 1000,
        pitchLength: 1250,
        pitchWidth: 1050,
        marginToWall: 0,
        nx: 2,
        ny: 2,
        perFloor: 4,
        occupiedLength: 2450,
        occupiedWidth: 2050,
        trailingResidualLength: 0,
        trailingResidualWidth: 0,
        utilizationArea: 0.5,
        residualLength: 0,
        residualWidth: 0,
      },
      candidates: [],
      solverVariant: 'alternating',
      patternLabel: 'Alternado A-B',
      rowPattern: ['LxW', 'WxL'],
      wallClearanceMm: 0,
      rearClearanceMm: 0,
      palletGapMm: 50,
      floors: 1,
      totalPalletsBySpace: 4,
      totalPalletsByWeight: null,
      totalPallets: 4,
      utilizationArea: 0.4,
      utilizationVolume: 0.2,
      heightFits: true,
      availableHeight: 2393,
      freeHeight: 1243,
      weightTotalKg: null,
      containerVolume: 33199437888,
      loadVolume: 5520000000,
      placements: [
        {
          x: -1000,
          y: 575,
          z: -500,
          length: 1200,
          width: 1000,
          height: 1150,
          rotated: false,
          index: 0,
          layer: 0,
        },
        {
          x: 250,
          y: 575,
          z: -500,
          length: 1200,
          width: 1000,
          height: 1150,
          rotated: false,
          index: 1,
          layer: 0,
        },
      ],
      errors: [],
      warnings: [],
    }

    const metrics = buildContainerDerivedMetrics(input, result)

    expect(metrics.containerAreaMm2).toBe(13872096)
    expect(metrics.occupiedFootprintAreaMm2).toBe(2400000)
    expect(metrics.occupiedBlockAreaMm2).toBe(5022500)
    expect(metrics.freeAreaMm2).toBe(11472096)
    expect(metrics.containerVolumeMm3).toBe(33199437888)
    expect(metrics.loadVolumeMm3).toBe(5520000000)
    expect(metrics.freeVolumeMm3).toBe(27679437888)
  })
})
