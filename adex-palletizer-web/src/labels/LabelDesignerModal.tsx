import { useEffect, useMemo, useState } from 'react'
import type { SkuLabelConfig, SkuLabelsBySku } from '../types'
import {
  createDefaultLabelConfig,
  ISO_PICTOGRAM_OPTIONS,
  LABEL_TEMPLATE_OPTIONS,
  normalizeBaseColor,
  normalizeLabelSkuId,
} from './labelModel'
import { LabelPreviewCanvas } from './LabelPreviewCanvas'
import { renderLabelToDataUrl } from './labelRenderer'

interface SkuOption {
  skuId: string
  name: string
  color?: string
}

interface LabelDesignerModalProps {
  isOpen: boolean
  title: string
  mode: 'single' | 'multi'
  labelsBySku: SkuLabelsBySku
  skuOptions: SkuOption[]
  initialSkuId: string
  onClose: () => void
  onSave: (config: SkuLabelConfig) => void
  onReset: (skuId: string) => void
}

function getSkuBaseColor(skuId: string, skuOptions: SkuOption[]) {
  const option = skuOptions.find((item) => item.skuId === skuId)
  return option?.color
}

function buildDraft(
  skuId: string,
  labelsBySku: SkuLabelsBySku,
  skuOptions: SkuOption[],
): Omit<SkuLabelConfig, 'frontTextureDataUrl' | 'updatedAt'> {
  const normalizedSkuId = normalizeLabelSkuId(skuId)
  const existing = labelsBySku[normalizedSkuId]
  if (existing) {
    return {
      skuId: existing.skuId,
      baseColor: existing.baseColor,
      template: existing.template,
      shippingMarks: { ...existing.shippingMarks },
      isoPictograms: [...existing.isoPictograms],
      logoDataUrl: existing.logoDataUrl,
      gs1Text: existing.gs1Text,
    }
  }
  return createDefaultLabelConfig(
    normalizedSkuId,
    getSkuBaseColor(normalizedSkuId, skuOptions),
  )
}

export function LabelDesignerModal({
  isOpen,
  title,
  mode,
  labelsBySku,
  skuOptions,
  initialSkuId,
  onClose,
  onSave,
  onReset,
}: LabelDesignerModalProps) {
  const availableOptions = useMemo(() => {
    if (skuOptions.length > 0) {
      return skuOptions
    }
    return [{ skuId: initialSkuId, name: initialSkuId }]
  }, [skuOptions, initialSkuId])

  const [selectedSkuId, setSelectedSkuId] = useState(() => normalizeLabelSkuId(initialSkuId))
  const [draft, setDraft] = useState<Omit<SkuLabelConfig, 'frontTextureDataUrl' | 'updatedAt'>>(
    () => buildDraft(initialSkuId, labelsBySku, availableOptions),
  )
  const [previewDataUrl, setPreviewDataUrl] = useState('')

  useEffect(() => {
    if (!isOpen) {
      return
    }
    const nextSkuId = normalizeLabelSkuId(initialSkuId)
    setSelectedSkuId(nextSkuId)
    setDraft(buildDraft(nextSkuId, labelsBySku, availableOptions))
  }, [isOpen, initialSkuId, labelsBySku, availableOptions])

  useEffect(() => {
    setDraft(buildDraft(selectedSkuId, labelsBySku, availableOptions))
  }, [selectedSkuId, labelsBySku, availableOptions])

  if (!isOpen) {
    return null
  }

  const handleSave = async () => {
    const resolvedDataUrl =
      previewDataUrl.length > 0 ? previewDataUrl : await renderLabelToDataUrl(draft)

    onSave({
      ...draft,
      frontTextureDataUrl: resolvedDataUrl,
      updatedAt: new Date().toISOString(),
    })
  }

  const handleLogoUpload = async (file: File | null) => {
    if (!file) {
      setDraft((current) => ({
        ...current,
        logoDataUrl: undefined,
      }))
      return
    }
    const dataUrl = await file.arrayBuffer().then((buffer) => {
      const bytes = new Uint8Array(buffer)
      let binary = ''
      bytes.forEach((byte) => {
        binary += String.fromCharCode(byte)
      })
      return `data:${file.type};base64,${window.btoa(binary)}`
    })
    setDraft((current) => ({
      ...current,
      logoDataUrl: dataUrl,
    }))
  }

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="label-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="label-modal-header">
          <h3>{title}</h3>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cerrar
          </button>
        </div>

        <div className="label-modal-content">
          {mode === 'multi' && (
            <label className="field" htmlFor="label-sku-select">
              <span>
                SKU a editar
                <strong>sku</strong>
              </span>
              <select
                id="label-sku-select"
                value={selectedSkuId}
                onChange={(event) => setSelectedSkuId(event.target.value)}
              >
                {availableOptions.map((option) => (
                  <option key={option.skuId} value={option.skuId}>
                    {option.skuId} - {option.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <section className="field-group">
            <h4>Plantilla</h4>
            <label className="field" htmlFor="label-template">
              <span>
                Plantilla
                <strong>layout</strong>
              </span>
              <select
                id="label-template"
                value={draft.template}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    template: event.target.value as SkuLabelConfig['template'],
                  }))
                }
              >
                {LABEL_TEMPLATE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field" htmlFor="label-base-color">
              <span>
                Color base
                <strong>#RRGGBB</strong>
              </span>
              <input
                id="label-base-color"
                type="text"
                value={draft.baseColor}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    baseColor: normalizeBaseColor(event.target.value),
                  }))
                }
              />
            </label>
            <label className="field" htmlFor="label-logo-upload">
              <span>
                Logo (PNG opcional)
                <strong>imagen</strong>
              </span>
              <input
                id="label-logo-upload"
                type="file"
                accept="image/png,image/*"
                onChange={(event) =>
                  void handleLogoUpload(event.target.files?.[0] ?? null)
                }
              />
            </label>
          </section>

          <section className="field-group">
            <h4>Textos (Shipping marks)</h4>
            <label className="field" htmlFor="label-consignee">
              <span>CONSIGNEE</span>
              <input
                id="label-consignee"
                type="text"
                value={draft.shippingMarks.consignee}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    shippingMarks: {
                      ...current.shippingMarks,
                      consignee: event.target.value,
                    },
                  }))
                }
              />
            </label>
            <label className="field" htmlFor="label-destination">
              <span>DESTINATION</span>
              <input
                id="label-destination"
                type="text"
                value={draft.shippingMarks.destination}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    shippingMarks: {
                      ...current.shippingMarks,
                      destination: event.target.value,
                    },
                  }))
                }
              />
            </label>
            <label className="field" htmlFor="label-product">
              <span>SKU / PRODUCT</span>
              <input
                id="label-product"
                type="text"
                value={draft.shippingMarks.product}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    shippingMarks: {
                      ...current.shippingMarks,
                      product: event.target.value,
                    },
                  }))
                }
              />
            </label>
            <div className="field-grid-2">
              <label className="field" htmlFor="label-lot">
                <span>LOT</span>
                <input
                  id="label-lot"
                  type="text"
                  value={draft.shippingMarks.lot}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      shippingMarks: {
                        ...current.shippingMarks,
                        lot: event.target.value,
                      },
                    }))
                  }
                />
              </label>
              <label className="field" htmlFor="label-carton">
                <span>CARTON NO</span>
                <input
                  id="label-carton"
                  type="text"
                  value={draft.shippingMarks.cartonNo}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      shippingMarks: {
                        ...current.shippingMarks,
                        cartonNo: event.target.value,
                      },
                    }))
                  }
                />
              </label>
            </div>
            <label className="field" htmlFor="label-gs1">
              <span>GS1 / SSCC (texto opcional)</span>
              <input
                id="label-gs1"
                type="text"
                value={draft.gs1Text ?? ''}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    gs1Text: event.target.value,
                  }))
                }
              />
            </label>
          </section>

          <section className="field-group">
            <h4>Pictogramas ISO 780</h4>
            <div className="checkbox-grid">
              {ISO_PICTOGRAM_OPTIONS.map((option) => (
                <label key={option.id} className="checkbox-row" htmlFor={`iso-${option.id}`}>
                  <input
                    id={`iso-${option.id}`}
                    type="checkbox"
                    checked={draft.isoPictograms.includes(option.id)}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        isoPictograms: event.target.checked
                          ? [...current.isoPictograms, option.id]
                          : current.isoPictograms.filter((item) => item !== option.id),
                      }))
                    }
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="field-group">
            <h4>Preview 2D</h4>
            <LabelPreviewCanvas draft={draft} onDataUrlReady={setPreviewDataUrl} />
          </section>
        </div>

        <div className="label-modal-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              onReset(draft.skuId)
              onClose()
            }}
          >
            Reset
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" onClick={() => void handleSave()}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}
