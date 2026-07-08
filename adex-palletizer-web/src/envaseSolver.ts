import type { DimensionsMM } from './types'

export type EnvaseOrientacion = 'vertical' | 'acostado'

/** Dimension del envase asignada a cada eje interno de la caja. */
export type EnvaseEje = 'length' | 'width' | 'height'

export interface EnvaseAxisAssignment {
  /** Dimension del envase que queda a lo largo del largo interno (eje x). */
  x: EnvaseEje
  /** Dimension del envase que queda a lo alto interno (eje y). */
  y: EnvaseEje
  /** Dimension del envase que queda a lo ancho interno (eje z). */
  z: EnvaseEje
}

export interface EnvasePackingResult {
  cantidadTotal: number
  orientacionUsada: EnvaseOrientacion
  /** Conteo a lo ancho interno de la caja (eje z). */
  filas: number
  /** Conteo a lo largo interno de la caja (eje x). */
  columnas: number
  /** Conteo en altura (eje y). */
  capas: number
  /** Porcentaje 0-100 de volumen interno ocupado por los envases. */
  utilizacionVolumetrica: number
  espacioSobrante: DimensionsMM
  /** Dimensiones del envase ya orientadas segun los ejes de la caja. */
  orientedDims: DimensionsMM
  /** Asignacion de ejes usada (necesaria para rotar el modelo 3D). */
  ejes: EnvaseAxisAssignment
}

export interface EnvaseInstance {
  /** Centro geometrico del envase en mm, mismo sistema que BoxInstance. */
  x: number
  y: number
  z: number
  length: number
  width: number
  height: number
  ejes: EnvaseAxisAssignment
}

const isPositive = (value: number) => Number.isFinite(value) && value > 0

interface CandidatePlan {
  orientacion: EnvaseOrientacion
  ejes: EnvaseAxisAssignment
}

/**
 * Solo dos familias de orientacion, como se acomoda a mano en planta:
 * - vertical: el envase de pie (su alto en el eje y de la caja), con las dos
 *   rotaciones de footprint posibles.
 * - acostado: el envase tumbado sobre un lado (su alto a lo largo del eje x
 *   o z), con las dos opciones para las dimensiones restantes.
 * No se modela boca abajo ni patrones intercalados.
 */
const CANDIDATE_PLANS: CandidatePlan[] = [
  { orientacion: 'vertical', ejes: { x: 'length', y: 'height', z: 'width' } },
  { orientacion: 'vertical', ejes: { x: 'width', y: 'height', z: 'length' } },
  { orientacion: 'acostado', ejes: { x: 'height', y: 'width', z: 'length' } },
  { orientacion: 'acostado', ejes: { x: 'height', y: 'length', z: 'width' } },
  { orientacion: 'acostado', ejes: { x: 'length', y: 'width', z: 'height' } },
  { orientacion: 'acostado', ejes: { x: 'width', y: 'length', z: 'height' } },
]

function evaluatePlan(
  plan: CandidatePlan,
  envase: DimensionsMM,
  cajaInterna: DimensionsMM,
): EnvasePackingResult {
  const orientedDims: DimensionsMM = {
    length: envase[plan.ejes.x],
    height: envase[plan.ejes.y],
    width: envase[plan.ejes.z],
  }

  const columnas = Math.max(0, Math.floor(cajaInterna.length / orientedDims.length))
  const filas = Math.max(0, Math.floor(cajaInterna.width / orientedDims.width))
  const capas = Math.max(0, Math.floor(cajaInterna.height / orientedDims.height))
  const cantidadTotal = columnas * filas * capas

  const volumenCaja = cajaInterna.length * cajaInterna.width * cajaInterna.height
  const volumenEnvases =
    cantidadTotal * envase.length * envase.width * envase.height
  const utilizacionVolumetrica =
    volumenCaja > 0 && cantidadTotal > 0
      ? (volumenEnvases / volumenCaja) * 100
      : 0

  return {
    cantidadTotal,
    orientacionUsada: plan.orientacion,
    filas,
    columnas,
    capas,
    utilizacionVolumetrica,
    espacioSobrante: {
      length: Math.max(0, cajaInterna.length - columnas * orientedDims.length),
      width: Math.max(0, cajaInterna.width - filas * orientedDims.width),
      height: Math.max(0, cajaInterna.height - capas * orientedDims.height),
    },
    orientedDims,
    ejes: plan.ejes,
  }
}

/**
 * Empaquetado de envases en la caja de embalaje: grid/bloque alineado
 * (columnas x filas x capas). Devuelve la combinacion orientacion +
 * permutacion de ejes que maximiza la cantidad total, o null si los datos
 * son invalidos o no cabe ningun envase. En empate de cantidad gana la
 * orientacion vertical (orden de evaluacion estable).
 */
export function solveEnvasePacking(
  envase: DimensionsMM,
  cajaInterna: DimensionsMM,
): EnvasePackingResult | null {
  const dims = [
    envase.length,
    envase.width,
    envase.height,
    cajaInterna.length,
    cajaInterna.width,
    cajaInterna.height,
  ]
  if (!dims.every(isPositive)) {
    return null
  }

  let best: EnvasePackingResult | null = null
  for (const plan of CANDIDATE_PLANS) {
    const candidate = evaluatePlan(plan, envase, cajaInterna)
    if (candidate.cantidadTotal <= 0) {
      continue
    }
    if (best === null || candidate.cantidadTotal > best.cantidadTotal) {
      best = candidate
    }
  }

  return best
}

/**
 * Posiciones de cada envase dentro de la caja para la escena 3D, siguiendo
 * la convencion de buildBoxInstances (mm, y hacia arriba, origen en el
 * centro de la base de la caja).
 */
export function buildEnvaseInstances(
  cajaInterna: DimensionsMM,
  result: EnvasePackingResult,
): EnvaseInstance[] {
  const { columnas, filas, capas, orientedDims, ejes } = result
  if (columnas <= 0 || filas <= 0 || capas <= 0) {
    return []
  }

  const instances: EnvaseInstance[] = []
  for (let layer = 0; layer < capas; layer += 1) {
    for (let ix = 0; ix < columnas; ix += 1) {
      for (let iz = 0; iz < filas; iz += 1) {
        instances.push({
          x:
            -cajaInterna.length / 2 +
            orientedDims.length / 2 +
            ix * orientedDims.length,
          y: orientedDims.height / 2 + layer * orientedDims.height,
          z:
            -cajaInterna.width / 2 +
            orientedDims.width / 2 +
            iz * orientedDims.width,
          length: orientedDims.length,
          width: orientedDims.width,
          height: orientedDims.height,
          ejes,
        })
      }
    }
  }

  return instances
}
