import { fireEvent, render, screen } from '@testing-library/react'
import { SCENARIOS_STORAGE_KEY } from './scenarios'
import App from './App'

vi.mock('./scene/Scene', () => ({
  Scene: () => <div data-testid="scene-single">scene-single</div>,
}))

vi.mock('./scene/SceneMulti', () => ({
  SceneMulti: () => <div data-testid="scene-multi">scene-multi</div>,
}))

vi.mock('./scene/SceneContainer', () => ({
  SceneContainer: () => <div data-testid="scene-container">scene-container</div>,
}))

describe('App scenarios storage', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('guarda escenario y lo mantiene tras recargar la app', () => {
    const { unmount } = render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /guardar escenario/i }))

    expect(screen.getByText('Escenario 1')).toBeInTheDocument()

    const storedRaw = window.localStorage.getItem(SCENARIOS_STORAGE_KEY)
    expect(storedRaw).not.toBeNull()

    unmount()
    render(<App />)

    expect(screen.getByText('Escenario 1')).toBeInTheDocument()
  })

  it('aplica limite maximo de 5 escenarios guardados', () => {
    render(<App />)

    const saveButton = screen.getByRole('button', { name: /guardar escenario/i })
    for (let index = 0; index < 5; index += 1) {
      fireEvent.click(saveButton)
    }

    expect(screen.getAllByRole('button', { name: 'Cargar' })).toHaveLength(5)

    fireEvent.click(saveButton)

    expect(screen.getByText(/limite de 5 escenarios alcanzado/i)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Cargar' })).toHaveLength(5)
  })

  it('guarda y carga escenario single preservando boxPresetId', () => {
    render(<App />)

    const boxPreset = document.getElementById('single-box-preset') as HTMLSelectElement
    const packingMode = document.getElementById('single-packing-mode') as HTMLSelectElement
    const skinMode = document.getElementById('global-box-skin-mode') as HTMLSelectElement
    const palletWeight = document.getElementById('pallet-weight') as HTMLInputElement
    const boxUnitWeight = document.getElementById('box-unit-weight') as HTMLInputElement
    fireEvent.change(boxPreset, { target: { value: 'compact-360-260-220' } })
    fireEvent.change(packingMode, { target: { value: 'advanced' } })
    fireEvent.change(skinMode, { target: { value: 'sack' } })
    fireEvent.change(palletWeight, { target: { value: '18' } })
    fireEvent.change(boxUnitWeight, { target: { value: '28' } })
    fireEvent.click(screen.getByRole('button', { name: /calcular|recalcular/i }))
    fireEvent.click(screen.getByRole('button', { name: /guardar escenario/i }))

    const storedRaw = window.localStorage.getItem(SCENARIOS_STORAGE_KEY)
    expect(storedRaw).not.toBeNull()
    const stored = JSON.parse(storedRaw ?? '[]') as Array<Record<string, unknown>>
    const singleScenario = stored.find((item) => item.mode === 'single') as
      | {
          single?: {
            boxPresetId?: string
            packingMode?: string
            boxSkinMode?: string
            input?: { palletWeightKg?: number; boxUnitWeightKg?: number }
          }
        }
      | undefined

    expect(singleScenario?.single?.boxPresetId).toBe('compact-360-260-220')
    expect(singleScenario?.single?.packingMode).toBe('advanced')
    expect(singleScenario?.single?.boxSkinMode).toBe('sack')
    expect(singleScenario?.single?.input?.palletWeightKg).toBe(18)
    expect(singleScenario?.single?.input?.boxUnitWeightKg).toBe(28)

    fireEvent.change(boxPreset, { target: { value: 'standard-600-400-200' } })
    fireEvent.change(packingMode, { target: { value: 'grid' } })
    fireEvent.change(skinMode, { target: { value: 'box' } })
    fireEvent.change(palletWeight, { target: { value: '' } })
    fireEvent.change(boxUnitWeight, { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cargar' }))

    expect((document.getElementById('single-box-preset') as HTMLSelectElement).value).toBe(
      'compact-360-260-220',
    )
    expect((document.getElementById('single-packing-mode') as HTMLSelectElement).value).toBe(
      'advanced',
    )
    expect((document.getElementById('global-box-skin-mode') as HTMLSelectElement).value).toBe(
      'sack',
    )
    expect((document.getElementById('pallet-weight') as HTMLInputElement).value).toBe('18')
    expect((document.getElementById('box-unit-weight') as HTMLInputElement).value).toBe('28')
    expect((document.getElementById('box-length') as HTMLInputElement).value).toBe('360')
  })

  it('permite agregar SKU en modo multi y guardar escenario con render asociado', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /multiples cajas/i }))
    fireEvent.change(document.getElementById('multi-pallet-weight') as HTMLInputElement, {
      target: { value: '25' },
    })
    fireEvent.change(document.getElementById('multi-sku-unitWeight-1') as HTMLInputElement, {
      target: { value: '12' },
    })
    fireEvent.click(screen.getByRole('button', { name: /agregar sku/i }))
    expect((document.getElementById('multi-no-mix-stacking') as HTMLInputElement).checked).toBe(
      true,
    )

    fireEvent.click(screen.getByRole('button', { name: /generar 3d|regenerar 3d/i }))
    fireEvent.click(screen.getByRole('button', { name: /guardar escenario/i }))

    const storedRaw = window.localStorage.getItem(SCENARIOS_STORAGE_KEY)
    expect(storedRaw).not.toBeNull()
    const stored = JSON.parse(storedRaw ?? '[]') as Array<Record<string, unknown>>
    const multiScenario = stored.find((item) => item.mode === 'multi') as
      | Record<string, unknown>
      | undefined

    expect(multiScenario).toBeDefined()
    const multi = multiScenario?.multi as
      | {
          input?: {
            palletWeightKg?: number
            skus?: Array<{ unitWeightKg?: number }>
            noMixedSkuStacking?: boolean
          }
        }
      | undefined
    expect(Array.isArray(multi?.input?.skus)).toBe(true)
    expect((multi?.input?.skus ?? []).length).toBeGreaterThanOrEqual(3)
    expect(multi?.input?.palletWeightKg).toBe(25)
    expect(multi?.input?.noMixedSkuStacking).toBe(true)
    expect((multi?.input?.skus ?? [])[0]?.unitWeightKg).toBe(12)

    fireEvent.click(document.getElementById('multi-no-mix-stacking') as HTMLInputElement)
    fireEvent.change(document.getElementById('multi-pallet-weight') as HTMLInputElement, {
      target: { value: '' },
    })
    expect((document.getElementById('multi-no-mix-stacking') as HTMLInputElement).checked).toBe(
      false,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Cargar' }))
    expect((document.getElementById('multi-no-mix-stacking') as HTMLInputElement).checked).toBe(
      true,
    )
    expect((document.getElementById('multi-pallet-weight') as HTMLInputElement).value).toBe('25')
  })

  it('guarda y carga escenario de container restaurando dimensiones', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /contenedores/i }))
    fireEvent.change(document.getElementById('container-preset') as HTMLSelectElement, {
      target: { value: '40gp' },
    })
    fireEvent.click(screen.getByRole('button', { name: /guardar escenario/i }))

    fireEvent.change(document.getElementById('container-preset') as HTMLSelectElement, {
      target: { value: '20gp' },
    })
    expect((document.getElementById('container-length') as HTMLInputElement).value).toBe('5898')

    fireEvent.click(screen.getByRole('button', { name: 'Cargar' }))

    expect((document.getElementById('container-length') as HTMLInputElement).value).toBe('12032')
    expect(screen.getByText(/patron:/i)).toBeInTheDocument()
  })
})
