import { getLabelPatchBlend, getLateralTextureBlend } from './LateralLabelMaterial'

describe('getLateralTextureBlend', () => {
  it('mantiene impresion completa en caras laterales', () => {
    expect(getLateralTextureBlend(0)).toBe(1)
    expect(getLateralTextureBlend(0.2)).toBe(1)
  })

  it('elimina impresion en tapa y fondo', () => {
    expect(getLateralTextureBlend(1)).toBe(0)
    expect(getLateralTextureBlend(-1)).toBe(0)
  })

  it('limita la etiqueta patch a una zona central del lateral', () => {
    expect(getLabelPatchBlend(0.5, 0.4)).toBe(1)
    expect(getLabelPatchBlend(0.1, 0.4)).toBe(0)
    expect(getLabelPatchBlend(0.5, 0.8)).toBe(0)
  })
})
