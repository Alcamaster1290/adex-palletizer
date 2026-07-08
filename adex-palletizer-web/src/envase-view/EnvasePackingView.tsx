import { useEffect, useMemo, useState } from 'react'
import {
  BOX_PRESET_OPTIONS,
  detectBoxPreset,
  getBoxPresetDimensions,
  type BoxPresetId,
} from '../boxPresets'
import {
  ENVASE_CATEGORIA_OPTIONS,
  ENVASE_MODEL_ATTRIBUTION,
  getEnvasePreset,
  listEnvasePresets,
  type EnvaseCategoriaId,
  type EnvasePreset,
} from '../envasePresets'
import {
  buildEnvaseInstances,
  solveEnvasePacking,
  type EnvasePackingResult,
} from '../envaseSolver'
import { formatVolumeDualFromMm3, formatWeightKg } from '../metrics/units'
import { EnvasePackingScene, preloadEnvaseModel } from '../scene/Envase'
import type { DimensionsMM } from '../types'

export interface EnvaseBoxPushPayload {
  box: DimensionsMM
  /** Peso del contenido (cantidad x peso del envase), sin tara de la caja. */
  contenidoKg: number | null
  envaseNombre: string
  cantidadEnvases: number
}

interface EnvasePackingViewProps {
  /** Caja inicial (p. ej. la caja maestra de Caja unica); null = defaults. */
  initialCaja?: DimensionsMM | null
  onUseInSingle: (payload: EnvaseBoxPushPayload) => void
  onAddToMulti: (payload: EnvaseBoxPushPayload) => void
}

type CajaFieldId = 'envase-caja-length' | 'envase-caja-width' | 'envase-caja-height'

const MIN_CAJA_DIMENSION_MM = 50
const DEFAULT_CAJA: DimensionsMM = { length: 480, width: 450, height: 360 }
const DEFAULT_PRESET_ID = 'cafe-romerito-1kg'

const formatInt = new Intl.NumberFormat('es-ES')
const percentFormatter = new Intl.NumberFormat('es-ES', {
  maximumFractionDigits: 2,
})

interface CajaFieldState {
  value: string
  error: string | null
  parsed: number | null
}

interface AppliedEnvaseCalc {
  preset: EnvasePreset
  caja: DimensionsMM
}

function parseCajaDimension(value: string, label: string): CajaFieldState {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return { value, error: `${label} es obligatorio.`, parsed: null }
  }
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return { value, error: `${label} debe ser un numero entero.`, parsed: null }
  }
  if (parsed < MIN_CAJA_DIMENSION_MM) {
    return {
      value,
      error: `${label} debe ser al menos ${MIN_CAJA_DIMENSION_MM} mm.`,
      parsed: null,
    }
  }
  return { value, error: null, parsed }
}

function buildCajaFields(caja: DimensionsMM): Record<CajaFieldId, CajaFieldState> {
  return {
    'envase-caja-length': {
      value: String(caja.length),
      error: null,
      parsed: caja.length,
    },
    'envase-caja-width': {
      value: String(caja.width),
      error: null,
      parsed: caja.width,
    },
    'envase-caja-height': {
      value: String(caja.height),
      error: null,
      parsed: caja.height,
    },
  }
}

function NumberField({
  id,
  label,
  value,
  error,
  onChange,
}: {
  id: CajaFieldId
  label: string
  value: string
  error: string | null
  onChange: (value: string) => void
}) {
  return (
    <label className="field" htmlFor={id}>
      <span>
        {label}
        <strong>mm</strong>
      </span>
      <input
        id={id}
        type="number"
        step={1}
        min={MIN_CAJA_DIMENSION_MM}
        value={value}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error && (
        <small id={`${id}-error`} className="field-error" role="alert">
          {error}
        </small>
      )}
    </label>
  )
}

function describeOrientacion(result: EnvasePackingResult): string {
  return result.orientacionUsada === 'vertical'
    ? 'Vertical (de pie)'
    : 'Acostado (tumbado)'
}

export function EnvasePackingView({
  initialCaja = null,
  onUseInSingle,
  onAddToMulti,
}: EnvasePackingViewProps) {
  const seedCaja: DimensionsMM = initialCaja ?? DEFAULT_CAJA
  // --- borrador (editable sin recalcular) ---
  const [categoria, setCategoria] = useState<EnvaseCategoriaId>('cafe')
  const presetsDeCategoria = listEnvasePresets(categoria)
  const [presetId, setPresetId] = useState<string>(DEFAULT_PRESET_ID)
  const draftPreset: EnvasePreset | null = getEnvasePreset(presetId)

  const [cajaPreset, setCajaPreset] = useState<BoxPresetId>(() =>
    detectBoxPreset(seedCaja),
  )
  const [fields, setFields] = useState<Record<CajaFieldId, CajaFieldState>>(() =>
    buildCajaFields(seedCaja),
  )

  // --- aplicado (lo que muestran resultados y escena, se fija con Calcular) ---
  const [applied, setApplied] = useState<AppliedEnvaseCalc>(() => {
    const preset = getEnvasePreset(DEFAULT_PRESET_ID)
    if (!preset) {
      throw new Error('Preset de envase por defecto no encontrado en el catalogo.')
    }
    return { preset, caja: { ...seedCaja } }
  })
  const [lastCalculatedAt, setLastCalculatedAt] = useState<Date>(new Date())

  useEffect(() => {
    preloadEnvaseModel(draftPreset?.modelPath)
  }, [draftPreset?.modelPath])

  const draftCaja: DimensionsMM | null = useMemo(() => {
    const length = fields['envase-caja-length'].parsed
    const width = fields['envase-caja-width'].parsed
    const height = fields['envase-caja-height'].parsed
    if (length === null || width === null || height === null) {
      return null
    }
    return { length, width, height }
  }, [fields])

  const hasValidationErrors =
    Object.values(fields).some((field) => field.error !== null) ||
    draftCaja === null ||
    !draftPreset ||
    !draftPreset.disponible

  const hasPendingChanges =
    hasValidationErrors ||
    draftCaja === null ||
    !draftPreset ||
    draftPreset.id !== applied.preset.id ||
    draftCaja.length !== applied.caja.length ||
    draftCaja.width !== applied.caja.width ||
    draftCaja.height !== applied.caja.height

  const result = useMemo(
    () => solveEnvasePacking(applied.preset, applied.caja),
    [applied],
  )

  const instances = useMemo(() => {
    if (!result) {
      return []
    }
    return buildEnvaseInstances(applied.caja, result)
  }, [applied, result])

  const contenidoKg = useMemo(() => {
    if (!result) {
      return null
    }
    return result.cantidadTotal * applied.preset.pesoKg
  }, [applied, result])

  const runCalculation = () => {
    if (hasValidationErrors || !draftPreset || !draftCaja) {
      return
    }
    setApplied({ preset: draftPreset, caja: { ...draftCaja } })
    setLastCalculatedAt(new Date())
  }

  const resetForm = () => {
    const preset = getEnvasePreset(DEFAULT_PRESET_ID)
    if (!preset) {
      return
    }
    setCategoria('cafe')
    setPresetId(DEFAULT_PRESET_ID)
    setCajaPreset('custom')
    setFields(buildCajaFields(DEFAULT_CAJA))
    setApplied({ preset, caja: { ...DEFAULT_CAJA } })
    setLastCalculatedAt(new Date())
  }

  const updateCajaField = (
    fieldId: CajaFieldId,
    label: string,
    value: string,
  ) => {
    const next = {
      ...fields,
      [fieldId]: parseCajaDimension(value, label),
    }
    setFields(next)

    const length = next['envase-caja-length'].parsed
    const width = next['envase-caja-width'].parsed
    const height = next['envase-caja-height'].parsed
    if (length !== null && width !== null && height !== null) {
      setCajaPreset(detectBoxPreset({ length, width, height }))
    }
  }

  const applyCajaPreset = (presetKey: BoxPresetId) => {
    setCajaPreset(presetKey)
    const dimensions = getBoxPresetDimensions(presetKey)
    if (!dimensions) {
      return
    }
    setFields(buildCajaFields(dimensions))
  }

  const pushPayload: EnvaseBoxPushPayload | null = result
    ? {
        box: { ...applied.caja },
        contenidoKg,
        envaseNombre: applied.preset.nombre,
        cantidadEnvases: result.cantidadTotal,
      }
    : null

  return (
    <section className="top-grid">
      <form
        className="panel form-panel"
        onSubmit={(event) => {
          event.preventDefault()
          runCalculation()
        }}
      >
        <div className="form-title-row">
          <h2>Envases → Caja</h2>
          <span className={hasPendingChanges ? 'chip pending' : 'chip ready'}>
            {hasPendingChanges ? 'Cambios sin calcular' : 'Calculo al dia'}
          </span>
        </div>

        <div className="field-group">
          <h3>Envase</h3>
          <label className="field" htmlFor="envase-categoria">
            <span>
              Categoria de producto
              <strong>catalogo</strong>
            </span>
            <select
              id="envase-categoria"
              value={categoria}
              onChange={(event) => {
                const nextCategoria = event.target.value as EnvaseCategoriaId
                setCategoria(nextCategoria)
                const presets = listEnvasePresets(nextCategoria)
                const firstAvailable =
                  presets.find((preset) => preset.disponible) ?? presets[0]
                if (firstAvailable) {
                  setPresetId(firstAvailable.id)
                }
              }}
            >
              {ENVASE_CATEGORIA_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field" htmlFor="envase-presentacion">
            <span>
              Presentacion
              <strong>preset</strong>
            </span>
            <select
              id="envase-presentacion"
              value={presetId}
              onChange={(event) => setPresetId(event.target.value)}
            >
              {presetsDeCategoria.map((option) => (
                <option
                  key={option.id}
                  value={option.id}
                  disabled={!option.disponible}
                >
                  {option.disponible
                    ? option.nombre
                    : `${option.nombre} (proximamente)`}
                </option>
              ))}
            </select>
          </label>
          {draftPreset && (
            <p className="meta-text">
              Dimensiones estimadas del envase: {draftPreset.width} x{' '}
              {draftPreset.height} x {draftPreset.length} mm (ancho x alto x
              fondo), {draftPreset.pesoKg} kg. Pendiente de medicion real.
            </p>
          )}
        </div>

        <div className="field-group">
          <h3>Caja de embalaje (dimensiones internas)</h3>
          <label className="field" htmlFor="envase-caja-preset">
            <span>
              Preset de caja
              <strong>predef.</strong>
            </span>
            <select
              id="envase-caja-preset"
              value={cajaPreset}
              onChange={(event) =>
                applyCajaPreset(event.target.value as BoxPresetId)
              }
            >
              {BOX_PRESET_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <NumberField
            id="envase-caja-length"
            label="Largo interno"
            value={fields['envase-caja-length'].value}
            error={fields['envase-caja-length'].error}
            onChange={(value) =>
              updateCajaField('envase-caja-length', 'El largo interno', value)
            }
          />
          <NumberField
            id="envase-caja-width"
            label="Ancho interno"
            value={fields['envase-caja-width'].value}
            error={fields['envase-caja-width'].error}
            onChange={(value) =>
              updateCajaField('envase-caja-width', 'El ancho interno', value)
            }
          />
          <NumberField
            id="envase-caja-height"
            label="Alto interno"
            value={fields['envase-caja-height'].value}
            error={fields['envase-caja-height'].error}
            onChange={(value) =>
              updateCajaField('envase-caja-height', 'El alto interno', value)
            }
          />
        </div>

        {hasValidationErrors && (
          <p className="form-error">Corrige los campos marcados antes de calcular.</p>
        )}

        <div className="action-row">
          <button
            type="submit"
            className="btn-primary"
            disabled={hasValidationErrors}
          >
            {hasPendingChanges ? 'Calcular' : 'Recalcular'}
          </button>
          <button type="button" className="btn-secondary" onClick={resetForm}>
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

        <div className="field-group">
          <h3>Enviar a palletizado</h3>
          <p className="meta-text">
            Empuja la caja calculada como input de Caja unica o Multiples
            cajas. El flujo manual de esas pestañas sigue disponible; las
            dimensiones se envian tal cual (sin espesor de pared) y el peso por
            caja es solo el contenido.
          </p>
          <div className="button-row">
            <button
              type="button"
              className="btn-primary"
              disabled={!pushPayload}
              onClick={() => {
                if (pushPayload) {
                  onUseInSingle(pushPayload)
                }
              }}
            >
              Usar esta caja en Caja unica
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={!pushPayload}
              onClick={() => {
                if (pushPayload) {
                  onAddToMulti(pushPayload)
                }
              }}
            >
              Añadir como SKU en Multiples cajas
            </button>
          </div>
        </div>
      </form>

      <div className="scene-column">
        <article className="panel scene-panel">
          <div className="scene-panel-stack">
            <EnvasePackingScene
              cajaInterna={applied.caja}
              preset={applied.preset}
              instances={instances}
            />
          </div>
        </article>

        <article className="panel scene-summary-panel">
          <div className="outputs-header">
            <h2>Resultados</h2>
          </div>

          {result ? (
            <div className="kpi-grid summary-kpi-grid">
              <article className="kpi">
                <span>Envases por caja</span>
                <strong>{formatInt.format(result.cantidadTotal)}</strong>
              </article>
              <article className="kpi">
                <span>Orientacion</span>
                <strong>{describeOrientacion(result)}</strong>
              </article>
              <article className="kpi">
                <span>Grid (col x fil x capas)</span>
                <strong>
                  {formatInt.format(result.columnas)} x{' '}
                  {formatInt.format(result.filas)} x{' '}
                  {formatInt.format(result.capas)}
                </strong>
              </article>
              <article className="kpi">
                <span>Utilizacion volumetrica</span>
                <strong>
                  {percentFormatter.format(result.utilizacionVolumetrica)}%
                </strong>
              </article>
              <article className="kpi">
                <span>Espacio sobrante (L x A x H)</span>
                <strong>
                  {formatInt.format(result.espacioSobrante.length)} x{' '}
                  {formatInt.format(result.espacioSobrante.width)} x{' '}
                  {formatInt.format(result.espacioSobrante.height)} mm
                </strong>
              </article>
              <article className="kpi">
                <span>Peso del contenido</span>
                <strong>
                  {contenidoKg !== null ? formatWeightKg(contenidoKg) : '—'}
                </strong>
              </article>
              <article className="kpi">
                <span>Volumen interno de la caja</span>
                <strong>
                  {formatVolumeDualFromMm3(
                    applied.caja.length * applied.caja.width * applied.caja.height,
                  )}
                </strong>
              </article>
            </div>
          ) : (
            <p className="meta-text">
              Ningun envase cabe en la caja calculada. Prueba dimensiones
              internas mayores y vuelve a calcular.
            </p>
          )}

          <p className="meta-text">
            Modelo 3D de referencia: “{ENVASE_MODEL_ATTRIBUTION.assetName}” de{' '}
            {ENVASE_MODEL_ATTRIBUTION.author} (
            <a
              href={ENVASE_MODEL_ATTRIBUTION.url}
              target="_blank"
              rel="noreferrer"
            >
              Sketchfab
            </a>
            ), licencia {ENVASE_MODEL_ATTRIBUTION.license}. Placeholder visual
            hasta contar con el modelo real del envase.
          </p>
        </article>
      </div>
    </section>
  )
}
