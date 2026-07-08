import type { DimensionsMM } from './types'

export type EnvaseCategoriaId = 'cafe'

export interface EnvasePreset {
  id: string
  categoria: EnvaseCategoriaId
  nombre: string
  presentacion: string
  /** Fondo/gusset del envase en mm (eje "largo" de la caja). */
  length: number
  /** Ancho frontal del envase en mm. */
  width: number
  /** Alto del envase de pie en mm. */
  height: number
  pesoKg: number
  modelPath?: string
  /** false = preset visible en el roadmap pero aun no habilitado. */
  disponible: boolean
}

export const ENVASE_CATEGORIA_OPTIONS: Array<{
  id: EnvaseCategoriaId
  label: string
}> = [{ id: 'cafe', label: 'Café' }]

// TODO: dimensiones ESTIMADAS del doypack de 1kg (ancho 220 x alto 340 x
// fondo/gusset 95). Reemplazar con medicion real del envase de produccion
// antes de usar los resultados para planificar embalaje definitivo.
const CAFE_ROMERITO_1KG_DIMS: DimensionsMM = {
  length: 95,
  width: 220,
  height: 340,
}

export const ENVASE_PRESETS: EnvasePreset[] = [
  {
    id: 'cafe-romerito-1kg',
    categoria: 'cafe',
    nombre: 'Café Romerito 1kg',
    presentacion: '1kg',
    ...CAFE_ROMERITO_1KG_DIMS,
    pesoKg: 1,
    modelPath: '/models/cafe-romerito-1kg.glb',
    disponible: true,
  },
  {
    // TODO: habilitar cuando exista la presentacion (dimensiones por definir).
    id: 'cafe-romerito-250gr',
    categoria: 'cafe',
    nombre: 'Café Romerito 250 gr',
    presentacion: '250 gr',
    length: 60,
    width: 140,
    height: 210,
    pesoKg: 0.25,
    disponible: false,
  },
  {
    // TODO: habilitar cuando exista la presentacion (dimensiones por definir).
    id: 'cafe-romerito-340gr',
    categoria: 'cafe',
    nombre: 'Café Romerito 340 gr',
    presentacion: '340 gr',
    length: 70,
    width: 160,
    height: 240,
    pesoKg: 0.34,
    disponible: false,
  },
]

export function listEnvasePresets(categoria: EnvaseCategoriaId): EnvasePreset[] {
  return ENVASE_PRESETS.filter((preset) => preset.categoria === categoria)
}

export function getEnvasePreset(id: string): EnvasePreset | null {
  return ENVASE_PRESETS.find((preset) => preset.id === id) ?? null
}

/**
 * Credito del asset visual de referencia usado mientras no exista el modelo
 * real del envase Cafe Romerito. Mostrar en la UI mientras este en uso.
 */
export const ENVASE_MODEL_ATTRIBUTION = {
  assetName: 'Coffee (1 Kg)',
  author: 'matousekfoto',
  license: 'CC-BY-4.0',
  url: 'https://sketchfab.com/3d-models/coffee-1-kg-cca01dbe14e64777912cb95326df1b25',
}
