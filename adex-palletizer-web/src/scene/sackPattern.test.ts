import { resolveSackLayerIndex, resolveSackPatternTransform } from './sackPattern'

describe('sackPattern helpers', () => {
  it('usa la capa explicita cuando existe', () => {
    expect(
      resolveSackLayerIndex(
        {
          x: 0,
          y: 450,
          z: 0,
          length: 600,
          width: 400,
          height: 200,
          layer: 3,
        },
        150,
      ),
    ).toBe(3)
  })

  it('desplaza capas impares para alternar el patron visual', () => {
    const evenLayer = resolveSackPatternTransform(600, 400, 0, 0)
    const oddLayer = resolveSackPatternTransform(600, 400, 1, 0)

    expect(evenLayer.offsetX).toBe(0)
    expect(evenLayer.offsetZ).toBe(0)
    expect(oddLayer.offsetX).not.toBe(0)
    expect(oddLayer.offsetZ).toBe(0)
  })
})
