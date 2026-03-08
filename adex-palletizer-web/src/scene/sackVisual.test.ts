import { resolveSackVisualProfile } from './sackVisual'

describe('sackVisual gravity profile', () => {
  it('expande la huella del saco para eliminar separaciones visuales', () => {
    const profile = resolveSackVisualProfile(600, 400, 200, false)

    expect(profile.visualLength).toBeGreaterThan(600)
    expect(profile.visualWidth).toBeGreaterThan(400)
    expect(profile.visualHeight).toBe(200)
    expect(profile.gravityOffsetY).toBe(-100)
  })

  it('agrega asentamiento vertical cuando el saco esta apilado', () => {
    const profile = resolveSackVisualProfile(600, 400, 200, true)

    expect(profile.visualHeight).toBeGreaterThan(200)
    expect(profile.gravityOffsetY).toBeLessThan(-100)
    expect(profile.topSurfaceY).toBe(100)
  })
})
