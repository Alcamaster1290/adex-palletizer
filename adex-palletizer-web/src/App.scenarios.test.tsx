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
    fireEvent.change(boxPreset, { target: { value: 'compact-360-260-220' } })
    fireEvent.change(packingMode, { target: { value: 'advanced' } })
    fireEvent.click(screen.getByRole('button', { name: /calcular|recalcular/i }))
    fireEvent.click(screen.getByRole('button', { name: /guardar escenario/i }))

    const storedRaw = window.localStorage.getItem(SCENARIOS_STORAGE_KEY)
    expect(storedRaw).not.toBeNull()
    const stored = JSON.parse(storedRaw ?? '[]') as Array<Record<string, unknown>>
    const singleScenario = stored.find((item) => item.mode === 'single') as
      | {
          single?: { boxPresetId?: string; packingMode?: string }
        }
      | undefined

    expect(singleScenario?.single?.boxPresetId).toBe('compact-360-260-220')
    expect(singleScenario?.single?.packingMode).toBe('advanced')

    fireEvent.change(boxPreset, { target: { value: 'standard-600-400-200' } })
    fireEvent.change(packingMode, { target: { value: 'grid' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cargar' }))

    expect((document.getElementById('single-box-preset') as HTMLSelectElement).value).toBe(
      'compact-360-260-220',
    )
    expect((document.getElementById('single-packing-mode') as HTMLSelectElement).value).toBe(
      'advanced',
    )
    expect((document.getElementById('box-length') as HTMLInputElement).value).toBe('360')
  })

  it('permite agregar SKU en modo multi y guardar escenario con render asociado', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /multiples cajas/i }))
    fireEvent.click(screen.getByRole('button', { name: /agregar sku/i }))

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
      | { input?: { skus?: Array<unknown> } }
      | undefined
    expect(Array.isArray(multi?.input?.skus)).toBe(true)
    expect((multi?.input?.skus ?? []).length).toBeGreaterThanOrEqual(3)
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
    expect(screen.getByText(/patron: 10 x 2/i)).toBeInTheDocument()
  })
})
