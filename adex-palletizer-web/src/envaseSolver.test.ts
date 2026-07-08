import { buildEnvaseInstances, solveEnvasePacking } from './envaseSolver'
import type { DimensionsMM } from './types'

// Envase de referencia: doypack 1kg (fondo 95 x ancho 220 x alto 340).
const ENVASE_1KG: DimensionsMM = { length: 95, width: 220, height: 340 }

describe('solveEnvasePacking', () => {
  it('resuelve un encaje exacto en vertical con grid alineado', () => {
    const caja: DimensionsMM = { length: 475, width: 440, height: 680 }

    const result = solveEnvasePacking(ENVASE_1KG, caja)

    expect(result).not.toBeNull()
    expect(result?.orientacionUsada).toBe('vertical')
    expect(result?.columnas).toBe(5)
    expect(result?.filas).toBe(2)
    expect(result?.capas).toBe(2)
    expect(result?.cantidadTotal).toBe(20)
    expect(result?.utilizacionVolumetrica).toBeCloseTo(100, 5)
    expect(result?.espacioSobrante).toEqual({ length: 0, width: 0, height: 0 })
  })

  it('elige la permutacion de footprint que maximiza cantidad en vertical', () => {
    // Con el ancho del envase a lo largo entran 2x5, contra 4x2 sin rotar.
    const caja: DimensionsMM = { length: 440, width: 475, height: 340 }

    const result = solveEnvasePacking(ENVASE_1KG, caja)

    expect(result?.orientacionUsada).toBe('vertical')
    expect(result?.cantidadTotal).toBe(10)
    expect(result?.columnas).toBe(2)
    expect(result?.filas).toBe(5)
    expect(result?.capas).toBe(1)
    expect(result?.ejes).toEqual({ x: 'width', y: 'height', z: 'length' })
    expect(result?.orientedDims).toEqual({ length: 220, width: 95, height: 340 })
  })

  it('usa acostado cuando la caja es mas baja que el envase de pie', () => {
    const caja: DimensionsMM = { length: 700, width: 250, height: 100 }

    const result = solveEnvasePacking(ENVASE_1KG, caja)

    expect(result?.orientacionUsada).toBe('acostado')
    expect(result?.cantidadTotal).toBe(2)
    expect(result?.columnas).toBe(2)
    expect(result?.filas).toBe(1)
    expect(result?.capas).toBe(1)
    // El alto del envase queda tumbado a lo largo de la caja.
    expect(result?.ejes.x).toBe('height')
    expect(result?.orientedDims.height).toBe(95)
  })

  it('en empate de cantidad prefiere la orientacion vertical', () => {
    const envaseCubo: DimensionsMM = { length: 100, width: 100, height: 100 }
    const caja: DimensionsMM = { length: 200, width: 100, height: 100 }

    const result = solveEnvasePacking(envaseCubo, caja)

    expect(result?.cantidadTotal).toBe(2)
    expect(result?.orientacionUsada).toBe('vertical')
  })

  it('calcula utilizacion volumetrica y espacio sobrante', () => {
    const envase: DimensionsMM = { length: 100, width: 200, height: 300 }
    const caja: DimensionsMM = { length: 250, width: 450, height: 320 }

    const result = solveEnvasePacking(envase, caja)

    expect(result?.cantidadTotal).toBe(4)
    expect(result?.utilizacionVolumetrica).toBeCloseTo((24 / 36) * 100, 5)
    expect(result?.espacioSobrante).toEqual({ length: 50, width: 50, height: 20 })
  })

  it('devuelve null cuando no cabe ningun envase', () => {
    const caja: DimensionsMM = { length: 90, width: 90, height: 90 }

    expect(solveEnvasePacking(ENVASE_1KG, caja)).toBeNull()
  })

  it('devuelve null ante dimensiones invalidas', () => {
    expect(
      solveEnvasePacking(ENVASE_1KG, { length: 0, width: 400, height: 400 }),
    ).toBeNull()
    expect(
      solveEnvasePacking(
        { length: -95, width: 220, height: 340 },
        { length: 400, width: 400, height: 400 },
      ),
    ).toBeNull()
    expect(
      solveEnvasePacking(ENVASE_1KG, {
        length: Number.NaN,
        width: 400,
        height: 400,
      }),
    ).toBeNull()
  })

  it('nunca excede las dimensiones internas de la caja', () => {
    const caja: DimensionsMM = { length: 500, width: 390, height: 700 }

    const result = solveEnvasePacking(ENVASE_1KG, caja)

    expect(result).not.toBeNull()
    if (result) {
      expect(result.columnas * result.orientedDims.length).toBeLessThanOrEqual(
        caja.length,
      )
      expect(result.filas * result.orientedDims.width).toBeLessThanOrEqual(
        caja.width,
      )
      expect(result.capas * result.orientedDims.height).toBeLessThanOrEqual(
        caja.height,
      )
    }
  })
})

describe('buildEnvaseInstances', () => {
  it('genera posiciones centradas en la base de la caja como buildBoxInstances', () => {
    const envase: DimensionsMM = { length: 100, width: 100, height: 100 }
    const caja: DimensionsMM = { length: 200, width: 100, height: 100 }

    const result = solveEnvasePacking(envase, caja)
    expect(result).not.toBeNull()
    if (!result) {
      return
    }

    const instances = buildEnvaseInstances(caja, result)

    expect(instances).toHaveLength(2)
    expect(instances[0]).toMatchObject({ x: -50, y: 50, z: 0 })
    expect(instances[1]).toMatchObject({ x: 50, y: 50, z: 0 })
  })

  it('respeta capas y grid del resultado', () => {
    const caja: DimensionsMM = { length: 475, width: 440, height: 680 }
    const result = solveEnvasePacking(ENVASE_1KG, caja)
    expect(result).not.toBeNull()
    if (!result) {
      return
    }

    const instances = buildEnvaseInstances(caja, result)

    expect(instances).toHaveLength(result.cantidadTotal)
    const alturas = new Set(instances.map((instance) => instance.y))
    expect(alturas.size).toBe(result.capas)
    instances.forEach((instance) => {
      expect(Math.abs(instance.x)).toBeLessThanOrEqual(caja.length / 2)
      expect(Math.abs(instance.z)).toBeLessThanOrEqual(caja.width / 2)
    })
  })
})
